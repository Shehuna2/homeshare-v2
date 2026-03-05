import { Contract, Interface, JsonRpcProvider, NonceManager, Wallet } from 'ethers';
import { QueryTypes } from 'sequelize';

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { sequelize } = await import('../dist/db/index.js');
await import('../dist/config/env.js');

const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_MAINNET_RPC_URL || '';
const operatorKey =
  process.env.PLATFORM_OPERATOR_PRIVATE_KEY || process.env.PROFIT_OPERATOR_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const batchSize = Number(process.env.CAMPAIGN_LIFECYCLE_BATCH_SIZE || 10);
const pollIntervalMs = Number(process.env.CAMPAIGN_LIFECYCLE_POLL_INTERVAL_MS || 15000);
const continuousMode = process.env.CAMPAIGN_LIFECYCLE_CONTINUOUS === 'true';
const ZERO_PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000000';
const ADVISORY_LOCK_KEY = 424204005;

if (!rpcUrl) {
  throw new Error('Missing BASE_SEPOLIA_RPC_URL (or BASE_MAINNET_RPC_URL)');
}

if (!operatorKey || operatorKey === ZERO_PRIVATE_KEY) {
  throw new Error('Missing valid PLATFORM_OPERATOR_PRIVATE_KEY (or PROFIT_OPERATOR_PRIVATE_KEY / PRIVATE_KEY)');
}

if (!Number.isInteger(batchSize) || batchSize <= 0) {
  throw new Error('CAMPAIGN_LIFECYCLE_BATCH_SIZE must be a positive integer');
}

if (!Number.isInteger(pollIntervalMs) || pollIntervalMs <= 0) {
  throw new Error('CAMPAIGN_LIFECYCLE_POLL_INTERVAL_MS must be > 0');
}

const provider = new JsonRpcProvider(rpcUrl);
const baseSigner = new Wallet(operatorKey, provider);
const signer = new NonceManager(baseSigner);
const operatorAddress = baseSigner.address.toLowerCase();
const crowdfundReadInterface = new Interface([
  'function owner() view returns (address)',
  'function state() view returns (uint8)',
  'function targetAmountUSDC() view returns (uint256)',
  'function raisedAmountUSDC() view returns (uint256)',
  'function endTime() view returns (uint256)',
]);
const crowdfundWriteAbi = ['function finalizeCampaign()'];

const decodeState = (stateIndex) => {
  if (stateIndex === 1) return 'SUCCESS';
  if (stateIndex === 2) return 'FAILED';
  if (stateIndex === 3) return 'WITHDRAWN';
  return 'ACTIVE';
};

const compactErrorMessage = (error) => {
  const raw = error instanceof Error ? error.message : String(error);
  let message = raw.replace(/\s+/g, ' ').trim();
  message = message.replace(/\(transaction="0x[a-f0-9]+".*?\)/gi, '').trim();
  message = message.replace(/\(action="estimateGas".*?\)/gi, '').trim();
  message = message.replace(/\s+\(code=[A-Z_]+.*$/i, '').trim();
  if (!message) return 'unknown-error';
  return message;
};

const acquireWorkerLock = async () => {
  const rows = await sequelize.query('SELECT pg_try_advisory_lock(:key) AS "locked"', {
    type: QueryTypes.SELECT,
    replacements: { key: ADVISORY_LOCK_KEY },
  });
  return Array.isArray(rows) && rows[0] && rows[0].locked === true;
};

const releaseWorkerLock = async () => {
  await sequelize.query('SELECT pg_advisory_unlock(:key)', {
    type: QueryTypes.SELECT,
    replacements: { key: ADVISORY_LOCK_KEY },
  });
};

const loadEligibleCampaigns = async () =>
  sequelize.query(
    `
    SELECT
      LOWER(contract_address) AS "campaignAddress",
      target_usdc_base_units::text AS "targetUsdcBaseUnits",
      raised_usdc_base_units::text AS "raisedUsdcBaseUnits",
      EXTRACT(EPOCH FROM end_time)::bigint::text AS "endTimeUnix",
      state
    FROM campaigns
    WHERE state = 'ACTIVE'
      AND (
        raised_usdc_base_units >= target_usdc_base_units
        OR (end_time IS NOT NULL AND end_time <= NOW())
      )
    ORDER BY updated_at ASC
    LIMIT :limit
    `,
    {
      type: QueryTypes.SELECT,
      replacements: { limit: batchSize },
    }
  );

const sendWithNonceRetry = async (requestFactory) => {
  try {
    return await requestFactory();
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes('nonce has already been used') || message.includes('nonce too low')) {
      signer.reset();
      return requestFactory();
    }
    throw error;
  }
};

const shouldFinalizeNow = async (campaignAddress) => {
  const [ownerRaw, stateRaw, targetRaw, raisedRaw, endRaw] = await Promise.all([
    provider.call({
      to: campaignAddress,
      data: crowdfundReadInterface.encodeFunctionData('owner', []),
    }),
    provider.call({
      to: campaignAddress,
      data: crowdfundReadInterface.encodeFunctionData('state', []),
    }),
    provider.call({
      to: campaignAddress,
      data: crowdfundReadInterface.encodeFunctionData('targetAmountUSDC', []),
    }),
    provider.call({
      to: campaignAddress,
      data: crowdfundReadInterface.encodeFunctionData('raisedAmountUSDC', []),
    }),
    provider.call({
      to: campaignAddress,
      data: crowdfundReadInterface.encodeFunctionData('endTime', []),
    }),
  ]);

  const [ownerAddress] = crowdfundReadInterface.decodeFunctionResult('owner', ownerRaw);
  const [stateIndexRaw] = crowdfundReadInterface.decodeFunctionResult('state', stateRaw);
  const [targetAmountRaw] = crowdfundReadInterface.decodeFunctionResult('targetAmountUSDC', targetRaw);
  const [raisedAmountRaw] = crowdfundReadInterface.decodeFunctionResult('raisedAmountUSDC', raisedRaw);
  const [endTimeRaw] = crowdfundReadInterface.decodeFunctionResult('endTime', endRaw);

  const owner = String(ownerAddress).toLowerCase();
  const state = decodeState(Number(stateIndexRaw));
  const target = BigInt(targetAmountRaw);
  const raised = BigInt(raisedAmountRaw);
  const endTime = Number(endTimeRaw);
  const now = Math.floor(Date.now() / 1000);

  const isTargetReached = raised >= target;
  const isEnded = now >= endTime;
  const canFinalize = state === 'ACTIVE' && (isTargetReached || isEnded);

  return {
    owner,
    state,
    target,
    raised,
    endTime,
    canFinalize,
    isTargetReached,
    isEnded,
  };
};

const processCycle = async () => {
  const locked = await acquireWorkerLock();
  if (!locked) {
    if (!continuousMode) {
      console.log('campaign lifecycle worker lock already held by another process; exiting');
    }
    return;
  }

  try {
    const campaigns = await loadEligibleCampaigns();
    if (campaigns.length === 0) {
      console.log('no lifecycle-eligible active campaigns');
      return;
    }

    console.log(`processing ${campaigns.length} lifecycle-eligible campaign(s)`);

    for (const campaign of campaigns) {
      const campaignAddress = campaign.campaignAddress.toLowerCase();
      try {
        const snapshot = await shouldFinalizeNow(campaignAddress);
        if (snapshot.owner !== operatorAddress) {
          console.log(
            `skip finalize campaign=${campaignAddress}: owner ${snapshot.owner} != operator ${operatorAddress}`
          );
          continue;
        }
        if (!snapshot.canFinalize) {
          console.log(
            `skip finalize campaign=${campaignAddress}: state=${snapshot.state} targetReached=${snapshot.isTargetReached} ended=${snapshot.isEnded}`
          );
          continue;
        }

        const crowdfund = new Contract(campaignAddress, crowdfundWriteAbi, signer);
        const tx = await sendWithNonceRetry(() => crowdfund.finalizeCampaign());
        const receipt = await tx.wait();
        if (!receipt || receipt.status !== 1) {
          throw new Error('finalize transaction reverted');
        }

        console.log(
          `finalized campaign=${campaignAddress} tx=${tx.hash} raised=${snapshot.raised.toString()} target=${snapshot.target.toString()}`
        );
      } catch (error) {
        console.error(`failed finalize campaign=${campaignAddress}: ${compactErrorMessage(error)}`);
      }
    }
  } finally {
    await releaseWorkerLock();
  }
};

if (continuousMode) {
  console.log(`campaign lifecycle worker started (continuous mode, interval=${pollIntervalMs}ms)`);
  while (true) {
    try {
      await processCycle();
    } catch (error) {
      console.error(
        `[campaign-lifecycle-worker] loop error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
} else {
  await processCycle();
}
