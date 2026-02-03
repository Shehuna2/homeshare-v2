-- Equity token and profit distribution schema (base-unit accounting).

CREATE TABLE IF NOT EXISTS equity_tokens (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  chain_id BIGINT NOT NULL,
  contract_address TEXT NOT NULL UNIQUE,
  property_id_string TEXT,
  admin_address TEXT,
  initial_holder_address TEXT,
  total_supply_base_units NUMERIC(78, 0) NOT NULL,
  created_tx_hash TEXT NOT NULL,
  created_log_index INTEGER NOT NULL,
  created_block_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (created_tx_hash, created_log_index)
);

CREATE INDEX IF NOT EXISTS equity_tokens_contract_address_idx ON equity_tokens(contract_address);
CREATE INDEX IF NOT EXISTS equity_tokens_property_id_idx ON equity_tokens(property_id);

COMMENT ON TABLE equity_tokens IS 'Derived from EquityToken deployment (constructor args).';

CREATE TABLE IF NOT EXISTS equity_claims (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  equity_token_id UUID NOT NULL REFERENCES equity_tokens(id) ON DELETE CASCADE,
  chain_id BIGINT NOT NULL,
  claimant_address TEXT NOT NULL,
  equity_amount_base_units NUMERIC(78, 0) NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS equity_claims_claimant_idx ON equity_claims(claimant_address);
CREATE INDEX IF NOT EXISTS equity_claims_equity_token_idx ON equity_claims(equity_token_id);

COMMENT ON TABLE equity_claims IS 'Derived from PropertyCrowdfund.TokensClaimed events.';

CREATE TABLE IF NOT EXISTS profit_distributors (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  chain_id BIGINT NOT NULL,
  contract_address TEXT NOT NULL UNIQUE,
  usdc_token_address TEXT NOT NULL,
  equity_token_address TEXT NOT NULL,
  created_tx_hash TEXT NOT NULL,
  created_log_index INTEGER NOT NULL,
  created_block_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (created_tx_hash, created_log_index)
);

CREATE INDEX IF NOT EXISTS profit_distributors_contract_address_idx ON profit_distributors(contract_address);
CREATE INDEX IF NOT EXISTS profit_distributors_property_id_idx ON profit_distributors(property_id);

COMMENT ON TABLE profit_distributors IS 'Derived from ProfitDistributor deployment.';

CREATE TABLE IF NOT EXISTS profit_deposits (
  id UUID PRIMARY KEY,
  profit_distributor_id UUID NOT NULL REFERENCES profit_distributors(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  chain_id BIGINT NOT NULL,
  depositor_address TEXT NOT NULL,
  usdc_amount_base_units BIGINT NOT NULL,
  acc_profit_per_share NUMERIC(78, 0) NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS profit_deposits_distributor_idx ON profit_deposits(profit_distributor_id);
CREATE INDEX IF NOT EXISTS profit_deposits_depositor_idx ON profit_deposits(depositor_address);

COMMENT ON TABLE profit_deposits IS 'Derived from ProfitDistributor.Deposited events.';

CREATE TABLE IF NOT EXISTS profit_claims (
  id UUID PRIMARY KEY,
  profit_distributor_id UUID NOT NULL REFERENCES profit_distributors(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  chain_id BIGINT NOT NULL,
  claimer_address TEXT NOT NULL,
  usdc_amount_base_units BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS profit_claims_claimer_idx ON profit_claims(claimer_address);
CREATE INDEX IF NOT EXISTS profit_claims_distributor_idx ON profit_claims(profit_distributor_id);

COMMENT ON TABLE profit_claims IS 'Derived from ProfitDistributor.Claimed events.';
