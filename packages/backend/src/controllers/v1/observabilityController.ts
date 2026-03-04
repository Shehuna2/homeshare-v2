import { Response } from 'express';
import { QueryTypes } from 'sequelize';
import { getRequestMetricsSnapshot } from '../../middleware/requestMetrics.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { sequelize } from '../../db/index.js';
import { sendError } from '../../lib/apiError.js';

export const getAdminMetrics = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const memory = process.memoryUsage();
    const metrics = getRequestMetricsSnapshot();
    const rpcUrlConfigured = Boolean(
      process.env.BASE_SEPOLIA_RPC_URL || process.env.BASE_MAINNET_RPC_URL
    );
    const stateRows = await sequelize.query<{ chain_id: string; last_block: string }>(
      `
      SELECT chain_id::text AS chain_id, last_block::text AS last_block
      FROM indexer_state
      ORDER BY chain_id ASC
      `,
      { type: QueryTypes.SELECT }
    );
    const staleMinutes = 5;
    const staleRows = await sequelize.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM (
        SELECT id, submitted_at FROM property_intents WHERE status = 'submitted'
        UNION ALL
        SELECT id, submitted_at FROM profit_distribution_intents WHERE status = 'submitted'
        UNION ALL
        SELECT id, submitted_at FROM platform_fee_intents WHERE status = 'submitted'
      ) AS intents
      WHERE submitted_at IS NOT NULL
        AND submitted_at < NOW() - (:staleMinutes::text || ' minutes')::interval
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { staleMinutes },
      }
    );
    const staleSubmittedIntents = Number(staleRows[0]?.count ?? '0');
    const intentRows = await sequelize.query<{
      table_name: string;
      pending: string;
      submitted: string;
      confirmed: string;
      failed: string;
    }>(
      `
      SELECT
        'property_intents'::text AS table_name,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::text AS pending,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END)::text AS submitted,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::text AS confirmed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::text AS failed
      FROM property_intents
      UNION ALL
      SELECT
        'profit_distribution_intents'::text AS table_name,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::text AS pending,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END)::text AS submitted,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::text AS confirmed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::text AS failed
      FROM profit_distribution_intents
      UNION ALL
      SELECT
        'platform_fee_intents'::text AS table_name,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END)::text AS pending,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END)::text AS submitted,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END)::text AS confirmed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::text AS failed
      FROM platform_fee_intents
      `,
      { type: QueryTypes.SELECT }
    );

    const toCount = (tableName: string) => {
      const row = intentRows.find((entry) => entry.table_name === tableName);
      return {
        pending: Number(row?.pending ?? '0'),
        submitted: Number(row?.submitted ?? '0'),
        confirmed: Number(row?.confirmed ?? '0'),
        failed: Number(row?.failed ?? '0'),
      };
    };
    const propertyIntents = toCount('property_intents');
    const profitIntents = toCount('profit_distribution_intents');
    const platformFeeIntents = toCount('platform_fee_intents');
    const totals = {
      pending: propertyIntents.pending + profitIntents.pending + platformFeeIntents.pending,
      submitted: propertyIntents.submitted + profitIntents.submitted + platformFeeIntents.submitted,
      confirmed: propertyIntents.confirmed + profitIntents.confirmed + platformFeeIntents.confirmed,
      failed: propertyIntents.failed + profitIntents.failed + platformFeeIntents.failed,
    };

    return res.json({
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      process: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        externalBytes: memory.external,
      },
      indexer: {
        byChain: stateRows.map((row) => ({
          chainId: Number(row.chain_id),
          lastIndexedBlock: Number(row.last_block),
        })),
      },
      health: {
        checks: {
          rpcConfigured: rpcUrlConfigured,
          indexerHealthy: stateRows.length > 0,
          workersHealthy: staleSubmittedIntents === 0,
        },
        staleSubmittedIntents,
      },
      intents: {
        property: propertyIntents,
        profit: profitIntents,
        platformFee: platformFeeIntents,
        totals,
      },
      api: metrics,
    });
  } catch (error) {
    console.error('[observability.metrics] failed', error);
    return sendError(res, 500, 'Failed to fetch admin metrics', 'internal_error');
  }
};
