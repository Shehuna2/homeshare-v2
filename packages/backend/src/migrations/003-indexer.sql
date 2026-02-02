-- Indexer schema for on-chain PropertyCrowdfund, EquityToken, and ProfitDistributor.
-- Idempotent-friendly: uses IF NOT EXISTS and unique tx_hash/log_index where applicable.

-- Extend properties for on-chain linkage.
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_id TEXT,
  ADD COLUMN IF NOT EXISTS chain_id BIGINT,
  ADD COLUMN IF NOT EXISTS crowdfund_contract_address TEXT,
  ADD COLUMN IF NOT EXISTS equity_token_address TEXT,
  ADD COLUMN IF NOT EXISTS profit_distributor_address TEXT;

CREATE INDEX IF NOT EXISTS properties_property_id_idx ON properties(property_id);
CREATE INDEX IF NOT EXISTS properties_crowdfund_address_idx ON properties(crowdfund_contract_address);
CREATE INDEX IF NOT EXISTS properties_equity_address_idx ON properties(equity_token_address);
CREATE INDEX IF NOT EXISTS properties_profit_distributor_address_idx ON properties(profit_distributor_address);

-- Campaigns map to PropertyCrowdfund deployment + Finalized/Withdrawn state changes.
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL,
  target_amount_usdc NUMERIC(20, 6) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'SUCCESS', 'FAILED', 'WITHDRAWN')),
  raised_amount_usdc NUMERIC(20, 6) NOT NULL DEFAULT 0,
  created_block BIGINT,
  created_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (contract_address)
);

CREATE INDEX IF NOT EXISTS campaigns_contract_address_idx ON campaigns(contract_address);
CREATE INDEX IF NOT EXISTS campaigns_property_id_idx ON campaigns(property_id);

COMMENT ON TABLE campaigns IS 'Derived from PropertyCrowdfund constructor + Finalized/Withdrawn events.';

-- Investments map to PropertyCrowdfund.Invested events.
ALTER TABLE investments
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS usdc_amount NUMERIC(20, 6),
  ADD COLUMN IF NOT EXISTS investor_address TEXT,
  ADD COLUMN IF NOT EXISTS tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS log_index INTEGER,
  ADD COLUMN IF NOT EXISTS block_number BIGINT;

CREATE INDEX IF NOT EXISTS investments_campaign_id_idx ON investments(campaign_id);
CREATE INDEX IF NOT EXISTS investments_investor_address_idx ON investments(investor_address);
CREATE UNIQUE INDEX IF NOT EXISTS investments_tx_log_idx ON investments(tx_hash, log_index);

COMMENT ON TABLE investments IS 'Derived from PropertyCrowdfund.Invested events.';

-- Equity tokens map to EquityToken deployments.
CREATE TABLE IF NOT EXISTS equity_tokens (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL UNIQUE,
  property_id_string TEXT,
  admin_address TEXT,
  initial_holder_address TEXT,
  total_supply NUMERIC(38, 18) NOT NULL,
  created_block BIGINT,
  created_tx_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS equity_tokens_contract_address_idx ON equity_tokens(contract_address);
CREATE INDEX IF NOT EXISTS equity_tokens_property_id_idx ON equity_tokens(property_id);

COMMENT ON TABLE equity_tokens IS 'Derived from EquityToken constructor deployment.';

-- Equity balances track holder balances from EquityToken Transfer events.
CREATE TABLE IF NOT EXISTS equity_balances (
  id UUID PRIMARY KEY,
  equity_token_id UUID NOT NULL REFERENCES equity_tokens(id) ON DELETE CASCADE,
  holder_address TEXT NOT NULL,
  balance NUMERIC(38, 18) NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (equity_token_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS equity_balances_holder_idx ON equity_balances(holder_address);
CREATE INDEX IF NOT EXISTS equity_balances_equity_token_idx ON equity_balances(equity_token_id);

COMMENT ON TABLE equity_balances IS 'Derived from EquityToken.Transfer events; stores balance snapshots.';

-- Profit distributors map to ProfitDistributor deployments.
CREATE TABLE IF NOT EXISTS profit_distributors (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contract_address TEXT NOT NULL UNIQUE,
  usdc_token_address TEXT NOT NULL,
  equity_token_address TEXT NOT NULL,
  acc_profit_per_share NUMERIC(38, 18) NOT NULL DEFAULT 0,
  created_block BIGINT,
  created_tx_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profit_distributors_contract_address_idx ON profit_distributors(contract_address);
CREATE INDEX IF NOT EXISTS profit_distributors_property_id_idx ON profit_distributors(property_id);

COMMENT ON TABLE profit_distributors IS 'Derived from ProfitDistributor deployment and Deposited events.';

-- Profit claims map to ProfitDistributor.Claimed events.
CREATE TABLE IF NOT EXISTS profit_claims (
  id UUID PRIMARY KEY,
  profit_distributor_id UUID NOT NULL REFERENCES profit_distributors(id) ON DELETE CASCADE,
  claimer_address TEXT NOT NULL,
  amount_usdc NUMERIC(20, 6) NOT NULL,
  block_number BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS profit_claims_claimer_idx ON profit_claims(claimer_address);
CREATE INDEX IF NOT EXISTS profit_claims_distributor_idx ON profit_claims(profit_distributor_id);

COMMENT ON TABLE profit_claims IS 'Derived from ProfitDistributor.Claimed events.';
