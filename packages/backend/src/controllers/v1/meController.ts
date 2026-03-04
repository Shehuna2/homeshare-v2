import { Response } from 'express';
import { Interface, JsonRpcProvider } from 'ethers';
import { QueryTypes } from 'sequelize';
import { sequelize } from '../../db/index.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sendError } from '../../lib/apiError.js';
import {
  BASE_SEPOLIA_CHAIN_ID,
  ValidationError,
  normalizeAddress,
  parseEventCursor,
  parseLimit,
} from '../../validators/v1.js';

const handleError = (res: Response, error: unknown) => {
  if (error instanceof ValidationError) {
    return sendError(res, error.status, error.message, 'validation_error');
  }
  console.error(error);
  return sendError(res, 500, 'Internal server error', 'internal_error');
};

const requireUserAddress = (req: AuthenticatedRequest): string => {
  if (!req.user?.address) {
    throw new ValidationError('Unauthorized', 401);
  }
  return normalizeAddress(req.user.address, 'address');
};

type InvestmentRow = {
  propertyId: string;
  campaignAddress: string;
  investorAddress: string;
  usdcAmountBaseUnits: string;
  txHash: string;
  logIndex: number;
  blockNumber: string;
  createdAt: string;
};

type EquityClaimRow = {
  propertyId: string;
  equityTokenAddress: string;
  campaignAddress: string | null;
  claimantAddress: string;
  equityAmountBaseUnits: string;
  txHash: string;
  logIndex: number;
  blockNumber: string;
  createdAt: string;
};

type ProfitClaimRow = {
  propertyId: string;
  profitDistributorAddress: string;
  claimerAddress: string;
  usdcAmountBaseUnits: string;
  txHash: string;
  logIndex: number;
  blockNumber: string;
  createdAt: string;
};

type ProfitStatusRow = {
  propertyId: string;
  profitDistributorAddress: string;
  totalDepositedBaseUnits: string;
  totalClaimedBaseUnits: string;
  unclaimedPoolBaseUnits: string;
  lastDepositAt: string | null;
};

const distributorReadInterface = new Interface([
  'function claimable(address user) view returns (uint256)',
]);

export const listMyInvestments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const investorAddress = requireUserAddress(req);
    const limit = parseLimit(req.query.limit);
    const cursor = parseEventCursor(req.query);
    const eventCursor = cursor
      ? { blockNumber: cursor.cursorBlockNumber, logIndex: cursor.cursorLogIndex }
      : null;
    const limitPlus = limit + 1;

    const rows: InvestmentRow[] = await sequelize.query<InvestmentRow>(
      `
      SELECT
        p.property_id AS "propertyId",
        LOWER(c.contract_address) AS "campaignAddress",
        LOWER(ci.investor_address) AS "investorAddress",
        ci.usdc_amount_base_units::text AS "usdcAmountBaseUnits",
        ci.tx_hash AS "txHash",
        ci.log_index AS "logIndex",
        ci.block_number::text AS "blockNumber",
        ci.created_at AS "createdAt"
      FROM campaign_investments ci
      JOIN campaigns c ON c.id = ci.campaign_id
      JOIN properties p ON p.id = ci.property_id
      WHERE ci.chain_id = :chainId
        AND c.chain_id = :chainId
        AND ci.investor_address = :investorAddress
        ${
          cursor
            ? 'AND (ci.block_number, ci.log_index) > (:cursorBlockNumber, :cursorLogIndex)'
            : ''
        }
      ORDER BY ci.block_number ASC, ci.log_index ASC
      LIMIT :limitPlus
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          investorAddress,
          cursorBlockNumber: eventCursor?.blockNumber,
          cursorLogIndex: eventCursor?.logIndex,
          limitPlus,
        },
      }
    );

    const items = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit
        ? {
            cursorBlockNumber: items[items.length - 1]?.blockNumber,
            cursorLogIndex: items[items.length - 1]?.logIndex,
          }
        : null;

    return res.json({ investments: items, nextCursor });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listMyEquityClaims = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const claimantAddress = requireUserAddress(req);
    const limit = parseLimit(req.query.limit);
    const cursor = parseEventCursor(req.query);
    const eventCursor = cursor
      ? { blockNumber: cursor.cursorBlockNumber, logIndex: cursor.cursorLogIndex }
      : null;
    const limitPlus = limit + 1;

    const rows: EquityClaimRow[] = await sequelize.query<EquityClaimRow>(
      `
      SELECT
        p.property_id AS "propertyId",
        LOWER(et.contract_address) AS "equityTokenAddress",
        LOWER(c.contract_address) AS "campaignAddress",
        LOWER(ec.claimant_address) AS "claimantAddress",
        ec.equity_amount_base_units::text AS "equityAmountBaseUnits",
        ec.tx_hash AS "txHash",
        ec.log_index AS "logIndex",
        ec.block_number::text AS "blockNumber",
        ec.created_at AS "createdAt"
      FROM equity_claims ec
      JOIN equity_tokens et ON et.id = ec.equity_token_id
      JOIN properties p ON p.id = ec.property_id
      LEFT JOIN campaigns c ON c.id = ec.campaign_id
      WHERE ec.chain_id = :chainId
        AND ec.claimant_address = :claimantAddress
        ${
          cursor
            ? 'AND (ec.block_number, ec.log_index) > (:cursorBlockNumber, :cursorLogIndex)'
            : ''
        }
      ORDER BY ec.block_number ASC, ec.log_index ASC
      LIMIT :limitPlus
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          claimantAddress,
          cursorBlockNumber: eventCursor?.blockNumber,
          cursorLogIndex: eventCursor?.logIndex,
          limitPlus,
        },
      }
    );

    const items = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit
        ? {
            cursorBlockNumber: items[items.length - 1]?.blockNumber,
            cursorLogIndex: items[items.length - 1]?.logIndex,
          }
        : null;

    return res.json({ equityClaims: items, nextCursor });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listMyProfitClaims = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const claimerAddress = requireUserAddress(req);
    const limit = parseLimit(req.query.limit);
    const cursor = parseEventCursor(req.query);
    const eventCursor = cursor
      ? { blockNumber: cursor.cursorBlockNumber, logIndex: cursor.cursorLogIndex }
      : null;
    const limitPlus = limit + 1;

    const rows: ProfitClaimRow[] = await sequelize.query<ProfitClaimRow>(
      `
      SELECT
        p.property_id AS "propertyId",
        LOWER(pdistr.contract_address) AS "profitDistributorAddress",
        LOWER(pc.claimer_address) AS "claimerAddress",
        pc.usdc_amount_base_units::text AS "usdcAmountBaseUnits",
        pc.tx_hash AS "txHash",
        pc.log_index AS "logIndex",
        pc.block_number::text AS "blockNumber",
        pc.created_at AS "createdAt"
      FROM profit_claims pc
      JOIN profit_distributors pdistr ON pdistr.id = pc.profit_distributor_id
      JOIN properties p ON p.id = pc.property_id
      WHERE pc.chain_id = :chainId
        AND pc.claimer_address = :claimerAddress
        ${
          cursor
            ? 'AND (pc.block_number, pc.log_index) > (:cursorBlockNumber, :cursorLogIndex)'
            : ''
        }
      ORDER BY pc.block_number ASC, pc.log_index ASC
      LIMIT :limitPlus
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          claimerAddress,
          cursorBlockNumber: eventCursor?.blockNumber,
          cursorLogIndex: eventCursor?.logIndex,
          limitPlus,
        },
      }
    );

    const items = rows.slice(0, limit);
    const nextCursor =
      rows.length > limit
        ? {
            cursorBlockNumber: items[items.length - 1]?.blockNumber,
            cursorLogIndex: items[items.length - 1]?.logIndex,
          }
        : null;

    return res.json({ profitClaims: items, nextCursor });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listMyProfitStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const investorAddress = requireUserAddress(req);
    const rows: ProfitStatusRow[] = await sequelize.query<ProfitStatusRow>(
      `
      WITH invested AS (
        SELECT DISTINCT p.id, p.property_id, LOWER(p.profit_distributor_address) AS profit_distributor_address
        FROM campaign_investments ci
        JOIN properties p ON p.id = ci.property_id
        WHERE ci.chain_id = :chainId
          AND ci.investor_address = :investorAddress
      )
      SELECT
        invested.property_id AS "propertyId",
        invested.profit_distributor_address AS "profitDistributorAddress",
        COALESCE(dep.total_deposited, 0)::text AS "totalDepositedBaseUnits",
        COALESCE(clm.total_claimed, 0)::text AS "totalClaimedBaseUnits",
        (COALESCE(dep.total_deposited, 0) - COALESCE(clm.total_claimed, 0))::text AS "unclaimedPoolBaseUnits",
        dep.last_deposit_at AS "lastDepositAt"
      FROM invested
      LEFT JOIN LATERAL (
        SELECT
          SUM(pd.usdc_amount_base_units) AS total_deposited,
          MAX(pd.created_at) AS last_deposit_at
        FROM profit_deposits pd
        WHERE pd.chain_id = :chainId
          AND pd.property_id = invested.id
      ) dep ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(pc.usdc_amount_base_units) AS total_claimed
        FROM profit_claims pc
        WHERE pc.chain_id = :chainId
          AND pc.property_id = invested.id
      ) clm ON TRUE
      ORDER BY invested.property_id ASC
      `,
      {
        type: QueryTypes.SELECT,
        replacements: {
          chainId: BASE_SEPOLIA_CHAIN_ID,
          investorAddress,
        },
      }
    );

    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_MAINNET_RPC_URL || '';
    if (!rpcUrl) {
      return res.json({
        statuses: rows.map((row) => ({
          ...row,
          claimableBaseUnits: null,
          claimableError: 'RPC unavailable',
        })),
      });
    }

    const provider = new JsonRpcProvider(rpcUrl);
    const statuses = await Promise.all(
      rows.map(async (row) => {
        try {
          const data = distributorReadInterface.encodeFunctionData('claimable', [investorAddress]);
          const raw = await provider.call({
            to: row.profitDistributorAddress,
            data,
          });
          const [claimable] = distributorReadInterface.decodeFunctionResult('claimable', raw);
          return {
            ...row,
            claimableBaseUnits: claimable.toString(),
            claimableError: null,
          };
        } catch (error) {
          return {
            ...row,
            claimableBaseUnits: null,
            claimableError: error instanceof Error ? error.message : 'claimable-read-failed',
          };
        }
      })
    );

    return res.json({ statuses });
  } catch (error) {
    return handleError(res, error);
  }
};
