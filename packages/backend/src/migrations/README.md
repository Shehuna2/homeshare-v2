# Indexer Schema Overview

This folder contains SQL migrations consumed by `src/db/migrate.ts`. The indexer listens to on-chain events from
`PropertyCrowdfund`, `EquityToken`, and `ProfitDistributor`, then upserts rows using `tx_hash`/`log_index` for
idempotency.

## Event-to-Table Mapping

- **PropertyCrowdfund constructor + Finalized/Withdrawn** → `campaigns`
- **PropertyCrowdfund.Invested** → `investments`
- **EquityToken deployment** → `equity_tokens`
- **EquityToken.Transfer** → `equity_balances` (balance snapshots)
- **ProfitDistributor deployment + Deposited** → `profit_distributors` (`acc_profit_per_share` updated)
- **ProfitDistributor.Claimed** → `profit_claims`

## Indexing Flow (high level)

1. Detect contract deployments and insert base rows (campaigns, equity_tokens, profit_distributors).
2. For each relevant event, insert or update rows keyed by `tx_hash` + `log_index`.
3. Update aggregate fields (`raised_amount_usdc`, `acc_profit_per_share`) as events are processed.
4. Maintain address and `property_id` indexes to support API query patterns.
