import { Interface, JsonRpcProvider } from 'ethers';
import type { Sequelize, Transaction } from 'sequelize';
import PropertyCrowdfundAbi from './abis/PropertyCrowdfund.json' assert { type: 'json' };
import ProfitDistributorAbi from './abis/ProfitDistributor.json' assert { type: 'json' };

const REORG_DEPTH = 15;
const DEFAULT_BATCH_SIZE = 1000;

const CROWDFUND_STATES = ['ACTIVE', 'SUCCESS', 'FAILED', 'WITHDRAWN'] as const;

type CrowdfundState = (typeof CROWDFUND_STATES)[number];

type CampaignRow = {
  id: string;
  property_id: string;
  contract_address: string;
};

type ProfitDistributorRow = {
  id: string;
  property_id: string;
  contract_address: string;
};

export class Indexer {
  private provider: JsonRpcProvider;
  private db: Sequelize;
  private crowdfundInterface = new Interface(PropertyCrowdfundAbi);
  private profitInterface = new Interface(ProfitDistributorAbi);
  private dryRun: boolean;
  private deploymentBlock: number;
  private batchSize: number;
  private txSenderCache = new Map<string, string>();

  constructor(provider: JsonRpcProvider, db: Sequelize, options?: { dryRun?: boolean; deploymentBlock?: number; batchSize?: number }) {
    this.provider = provider;
    this.db = db;
    this.dryRun = options?.dryRun ?? false;
    this.deploymentBlock = options?.deploymentBlock ?? 0;
    this.batchSize = options?.batchSize ?? DEFAULT_BATCH_SIZE;
  }

  async sync(): Promise<void> {
    const network = await this.provider.getNetwork();
    const chainId = Number(network.chainId);
    await this.ensureIndexerState();

    const lastBlock = await this.getLastIndexedBlock(chainId);
    const latestBlock = await this.provider.getBlockNumber();
    const fromBlock = Math.max(this.deploymentBlock, lastBlock - REORG_DEPTH);

    await this.pruneReorgRange(fromBlock);

    for (let start = fromBlock; start <= latestBlock; start += this.batchSize) {
      const end = Math.min(latestBlock, start + this.batchSize - 1);
      await this.processBatch(chainId, start, end);
      await this.updateLastIndexedBlock(chainId, end);
    }
  }

  private async ensureIndexerState(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS indexer_state (
        chain_id BIGINT PRIMARY KEY,
        last_block BIGINT NOT NULL
      );
    `);
  }

  private async getLastIndexedBlock(chainId: number): Promise<number> {
    const [rows] = await this.db.query<{ last_block: string }>(
      'SELECT last_block FROM indexer_state WHERE chain_id = :chainId',
      { replacements: { chainId } }
    );
    if (rows.length === 0) {
      return this.deploymentBlock;
    }
    return Number(rows[0].last_block);
  }

  private async updateLastIndexedBlock(chainId: number, lastBlock: number): Promise<void> {
    if (this.dryRun) {
      return;
    }

    await this.db.query(
      `
      INSERT INTO indexer_state (chain_id, last_block)
      VALUES (:chainId, :lastBlock)
      ON CONFLICT (chain_id)
      DO UPDATE SET last_block = EXCLUDED.last_block;
    `,
      { replacements: { chainId, lastBlock } }
    );
  }

  private async pruneReorgRange(fromBlock: number): Promise<void> {
    if (this.dryRun) {
      return;
    }

    const tables = [
      'campaign_investments',
      'campaign_refunds',
      'equity_claims',
      'profit_deposits',
      'profit_claims',
    ];

    for (const table of tables) {
      await this.db.query(`DELETE FROM ${table} WHERE block_number >= :fromBlock`, {
        replacements: { fromBlock },
      });
    }

    await this.db.query(
      `
      UPDATE campaigns
      SET state = 'ACTIVE',
          finalized_tx_hash = NULL,
          finalized_log_index = NULL,
          finalized_block_number = NULL
      WHERE finalized_block_number IS NOT NULL AND finalized_block_number >= :fromBlock;
    `,
      { replacements: { fromBlock } }
    );
  }

  async processBatch(chainId: number, fromBlock: number, toBlock: number): Promise<void> {
    const campaigns = await this.getCampaigns();
    const distributors = await this.getProfitDistributors();
    const campaignMap = new Map(campaigns.map((c) => [c.contract_address.toLowerCase(), c]));
    const distributorMap = new Map(distributors.map((d) => [d.contract_address.toLowerCase(), d]));

    const crowdfundAddresses = campaigns.map((c) => c.contract_address);
    const distributorAddresses = distributors.map((d) => d.contract_address);

    const crowdfundLogs = await this.fetchLogs(
      crowdfundAddresses,
      [
        this.crowdfundInterface.getEvent('Invested').topicHash,
        this.crowdfundInterface.getEvent('Refunded').topicHash,
        this.crowdfundInterface.getEvent('Finalized').topicHash,
        this.crowdfundInterface.getEvent('Withdrawn').topicHash,
        this.crowdfundInterface.getEvent('TokensClaimed').topicHash,
        this.crowdfundInterface.getEvent('EquityTokenSet').topicHash,
      ],
      fromBlock,
      toBlock
    );

    const profitLogs = await this.fetchLogs(
      distributorAddresses,
      [
        this.profitInterface.getEvent('Deposited').topicHash,
        this.profitInterface.getEvent('Claimed').topicHash,
      ],
      fromBlock,
      toBlock
    );

    const affectedCampaigns = new Set<string>();

    const inserts = {
      campaignInvestments: 0,
      campaignRefunds: 0,
      equityClaims: 0,
      profitDeposits: 0,
      profitClaims: 0,
      campaignsUpdated: 0,
    };

    await this.db.transaction(async (transaction) => {
      for (const log of crowdfundLogs) {
        const parsed = this.crowdfundInterface.parseLog({ topics: log.topics, data: log.data });
        const contractAddress = log.address.toLowerCase();
        const campaign = campaignMap.get(contractAddress);
        if (!campaign) {
          continue;
        }

        switch (parsed.name) {
          case 'Invested': {
            const investor = String(parsed.args.investor).toLowerCase();
            const amount = parsed.args.amountUSDC as bigint;
            inserts.campaignInvestments += await this.insertCampaignInvestment(
              transaction,
              campaign,
              chainId,
              investor,
              amount,
              log
            );
            affectedCampaigns.add(campaign.id);
            break;
          }
          case 'Refunded': {
            const investor = String(parsed.args.investor).toLowerCase();
            const amount = parsed.args.amountUSDC as bigint;
            inserts.campaignRefunds += await this.insertCampaignRefund(
              transaction,
              campaign,
              chainId,
              investor,
              amount,
              log
            );
            affectedCampaigns.add(campaign.id);
            break;
          }
          case 'Finalized': {
            const stateIndex = Number(parsed.args.state);
            const state = CROWDFUND_STATES[stateIndex] ?? 'ACTIVE';
            const raised = parsed.args.raisedAmountUSDC as bigint;
            await this.updateCampaignFinalized(
              transaction,
              campaign,
              state,
              raised,
              log
            );
            inserts.campaignsUpdated += 1;
            break;
          }
          case 'Withdrawn': {
            await this.updateCampaignState(transaction, campaign, 'WITHDRAWN');
            inserts.campaignsUpdated += 1;
            break;
          }
          case 'TokensClaimed': {
            const investor = String(parsed.args.investor).toLowerCase();
            const amount = parsed.args.amountEquityTokens as bigint;
            const equityTokenId = await this.lookupEquityTokenId(transaction, campaign.property_id);
            if (!equityTokenId) {
              continue;
            }
            inserts.equityClaims += await this.insertEquityClaim(
              transaction,
              campaign,
              equityTokenId,
              chainId,
              investor,
              amount,
              log
            );
            break;
          }
          case 'EquityTokenSet': {
            break;
          }
        }
      }

      for (const log of profitLogs) {
        const parsed = this.profitInterface.parseLog({ topics: log.topics, data: log.data });
        const contractAddress = log.address.toLowerCase();
        const distributor = distributorMap.get(contractAddress);
        if (!distributor) {
          continue;
        }

        switch (parsed.name) {
          case 'Deposited': {
            const amount = parsed.args.amountUSDC as bigint;
            const accProfitPerShare = parsed.args.accProfitPerShare as bigint;
            const depositor = await this.getTransactionSender(log.transactionHash);
            inserts.profitDeposits += await this.insertProfitDeposit(
              transaction,
              distributor,
              chainId,
              depositor,
              amount,
              accProfitPerShare,
              log
            );
            break;
          }
          case 'Claimed': {
            const claimer = String(parsed.args.user).toLowerCase();
            const amount = parsed.args.amountUSDC as bigint;
            inserts.profitClaims += await this.insertProfitClaim(
              transaction,
              distributor,
              chainId,
              claimer,
              amount,
              log
            );
            break;
          }
        }
      }

      for (const campaignId of affectedCampaigns) {
        await this.recalculateRaised(transaction, campaignId);
      }
    });

    console.log(
      `[Indexer] ${fromBlock}-${toBlock} inserted: investments=${inserts.campaignInvestments}, refunds=${inserts.campaignRefunds}, equityClaims=${inserts.equityClaims}, profitDeposits=${inserts.profitDeposits}, profitClaims=${inserts.profitClaims}, campaignsUpdated=${inserts.campaignsUpdated}`
    );
  }

  private async fetchLogs(
    addresses: string[],
    topic0: string[],
    fromBlock: number,
    toBlock: number
  ) {
    if (addresses.length === 0) {
      return [];
    }
    return this.provider.getLogs({
      address: addresses,
      fromBlock,
      toBlock,
      topics: [topic0],
    });
  }

  private async getCampaigns(): Promise<CampaignRow[]> {
    const [rows] = await this.db.query<CampaignRow>(
      'SELECT id, property_id, contract_address FROM campaigns'
    );
    return rows;
  }

  private async getProfitDistributors(): Promise<ProfitDistributorRow[]> {
    const [rows] = await this.db.query<ProfitDistributorRow>(
      'SELECT id, property_id, contract_address FROM profit_distributors'
    );
    return rows;
  }

  private async getTransactionSender(txHash: string): Promise<string> {
    const cached = this.txSenderCache.get(txHash);
    if (cached) {
      return cached;
    }
    const tx = await this.provider.getTransaction(txHash);
    const sender = tx?.from?.toLowerCase() ?? '0x0000000000000000000000000000000000000000';
    this.txSenderCache.set(txHash, sender);
    return sender;
  }

  private async insertCampaignInvestment(
    transaction: Transaction,
    campaign: CampaignRow,
    chainId: number,
    investor: string,
    amount: bigint,
    log: { transactionHash: string; logIndex: number; blockNumber: number }
  ): Promise<number> {
    if (this.dryRun) {
      return 0;
    }

    const [result] = await this.db.query<{ id: string }>(
      `
      INSERT INTO campaign_investments (
        id,
        campaign_id,
        property_id,
        chain_id,
        investor_address,
        usdc_amount_base_units,
        tx_hash,
        log_index,
        block_number
      ) VALUES (
        gen_random_uuid(),
        :campaignId,
        :propertyId,
        :chainId,
        :investor,
        :amount,
        :txHash,
        :logIndex,
        :blockNumber
      ) ON CONFLICT (tx_hash, log_index) DO NOTHING
      RETURNING id;
    `,
      {
        replacements: {
          campaignId: campaign.id,
          propertyId: campaign.property_id,
          chainId,
          investor,
          amount: amount.toString(),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
        },
        transaction,
      }
    );

    return result.length;
  }

  private async insertCampaignRefund(
    transaction: Transaction,
    campaign: CampaignRow,
    chainId: number,
    investor: string,
    amount: bigint,
    log: { transactionHash: string; logIndex: number; blockNumber: number }
  ): Promise<number> {
    if (this.dryRun) {
      return 0;
    }

    const [result] = await this.db.query<{ id: string }>(
      `
      INSERT INTO campaign_refunds (
        id,
        campaign_id,
        property_id,
        chain_id,
        investor_address,
        usdc_amount_base_units,
        tx_hash,
        log_index,
        block_number
      ) VALUES (
        gen_random_uuid(),
        :campaignId,
        :propertyId,
        :chainId,
        :investor,
        :amount,
        :txHash,
        :logIndex,
        :blockNumber
      ) ON CONFLICT (tx_hash, log_index) DO NOTHING
      RETURNING id;
    `,
      {
        replacements: {
          campaignId: campaign.id,
          propertyId: campaign.property_id,
          chainId,
          investor,
          amount: amount.toString(),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
        },
        transaction,
      }
    );

    return result.length;
  }

  private async updateCampaignFinalized(
    transaction: Transaction,
    campaign: CampaignRow,
    state: CrowdfundState,
    raised: bigint,
    log: { transactionHash: string; logIndex: number; blockNumber: number }
  ): Promise<void> {
    if (this.dryRun) {
      return;
    }

    await this.db.query(
      `
      UPDATE campaigns
      SET state = :state,
          raised_usdc_base_units = :raised,
          finalized_tx_hash = :txHash,
          finalized_log_index = :logIndex,
          finalized_block_number = :blockNumber,
          updated_at = NOW()
      WHERE id = :campaignId;
    `,
      {
        replacements: {
          campaignId: campaign.id,
          state,
          raised: raised.toString(),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
        },
        transaction,
      }
    );
  }

  private async updateCampaignState(
    transaction: Transaction,
    campaign: CampaignRow,
    state: CrowdfundState
  ): Promise<void> {
    if (this.dryRun) {
      return;
    }

    await this.db.query(
      `
      UPDATE campaigns
      SET state = :state,
          updated_at = NOW()
      WHERE id = :campaignId;
    `,
      {
        replacements: { campaignId: campaign.id, state },
        transaction,
      }
    );
  }

  private async lookupEquityTokenId(transaction: Transaction, propertyId: string): Promise<string | null> {
    const [rows] = await this.db.query<{ id: string }>(
      'SELECT id FROM equity_tokens WHERE property_id = :propertyId LIMIT 1',
      { replacements: { propertyId }, transaction }
    );
    if (rows.length === 0) {
      return null;
    }
    return rows[0].id;
  }

  private async insertEquityClaim(
    transaction: Transaction,
    campaign: CampaignRow,
    equityTokenId: string,
    chainId: number,
    investor: string,
    amount: bigint,
    log: { transactionHash: string; logIndex: number; blockNumber: number }
  ): Promise<number> {
    if (this.dryRun) {
      return 0;
    }

    const [result] = await this.db.query<{ id: string }>(
      `
      INSERT INTO equity_claims (
        id,
        campaign_id,
        property_id,
        equity_token_id,
        chain_id,
        claimant_address,
        equity_amount_base_units,
        tx_hash,
        log_index,
        block_number
      ) VALUES (
        gen_random_uuid(),
        :campaignId,
        :propertyId,
        :equityTokenId,
        :chainId,
        :claimant,
        :amount,
        :txHash,
        :logIndex,
        :blockNumber
      ) ON CONFLICT (tx_hash, log_index) DO NOTHING
      RETURNING id;
    `,
      {
        replacements: {
          campaignId: campaign.id,
          propertyId: campaign.property_id,
          equityTokenId,
          chainId,
          claimant: investor,
          amount: amount.toString(),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
        },
        transaction,
      }
    );

    return result.length;
  }

  private async insertProfitDeposit(
    transaction: Transaction,
    distributor: ProfitDistributorRow,
    chainId: number,
    depositor: string,
    amount: bigint,
    accProfitPerShare: bigint,
    log: { transactionHash: string; logIndex: number; blockNumber: number }
  ): Promise<number> {
    if (this.dryRun) {
      return 0;
    }

    const [result] = await this.db.query<{ id: string }>(
      `
      INSERT INTO profit_deposits (
        id,
        profit_distributor_id,
        property_id,
        chain_id,
        depositor_address,
        usdc_amount_base_units,
        acc_profit_per_share,
        tx_hash,
        log_index,
        block_number
      ) VALUES (
        gen_random_uuid(),
        :distributorId,
        :propertyId,
        :chainId,
        :depositor,
        :amount,
        :accProfitPerShare,
        :txHash,
        :logIndex,
        :blockNumber
      ) ON CONFLICT (tx_hash, log_index) DO NOTHING
      RETURNING id;
    `,
      {
        replacements: {
          distributorId: distributor.id,
          propertyId: distributor.property_id,
          chainId,
          depositor,
          amount: amount.toString(),
          accProfitPerShare: accProfitPerShare.toString(),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
        },
        transaction,
      }
    );

    return result.length;
  }

  private async insertProfitClaim(
    transaction: Transaction,
    distributor: ProfitDistributorRow,
    chainId: number,
    claimer: string,
    amount: bigint,
    log: { transactionHash: string; logIndex: number; blockNumber: number }
  ): Promise<number> {
    if (this.dryRun) {
      return 0;
    }

    const [result] = await this.db.query<{ id: string }>(
      `
      INSERT INTO profit_claims (
        id,
        profit_distributor_id,
        property_id,
        chain_id,
        claimer_address,
        usdc_amount_base_units,
        tx_hash,
        log_index,
        block_number
      ) VALUES (
        gen_random_uuid(),
        :distributorId,
        :propertyId,
        :chainId,
        :claimer,
        :amount,
        :txHash,
        :logIndex,
        :blockNumber
      ) ON CONFLICT (tx_hash, log_index) DO NOTHING
      RETURNING id;
    `,
      {
        replacements: {
          distributorId: distributor.id,
          propertyId: distributor.property_id,
          chainId,
          claimer,
          amount: amount.toString(),
          txHash: log.transactionHash,
          logIndex: log.logIndex,
          blockNumber: log.blockNumber,
        },
        transaction,
      }
    );

    return result.length;
  }

  private async recalculateRaised(transaction: Transaction, campaignId: string): Promise<void> {
    if (this.dryRun) {
      return;
    }

    await this.db.query(
      `
      UPDATE campaigns
      SET raised_usdc_base_units = (
        SELECT COALESCE(SUM(usdc_amount_base_units), 0)
        FROM campaign_investments
        WHERE campaign_id = :campaignId
      )
      WHERE id = :campaignId;
    `,
      { replacements: { campaignId }, transaction }
    );
  }
}
