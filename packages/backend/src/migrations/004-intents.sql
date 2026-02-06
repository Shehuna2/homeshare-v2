-- Intent tables for admin-driven property and profit distribution workflows.

CREATE TABLE IF NOT EXISTS property_intents (
  id UUID PRIMARY KEY,
  chain_id BIGINT NOT NULL,
  property_id TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  description TEXT NOT NULL,
  target_usdc_base_units BIGINT NOT NULL,
  crowdfund_contract_address TEXT,
  created_by_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS property_intents_property_id_idx ON property_intents(property_id);
CREATE INDEX IF NOT EXISTS property_intents_chain_id_idx ON property_intents(chain_id);

CREATE TABLE IF NOT EXISTS profit_distribution_intents (
  id UUID PRIMARY KEY,
  chain_id BIGINT NOT NULL,
  property_id TEXT NOT NULL,
  profit_distributor_address TEXT NOT NULL,
  usdc_amount_base_units BIGINT NOT NULL,
  created_by_address TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profit_distribution_intents_property_id_idx ON profit_distribution_intents(property_id);
CREATE INDEX IF NOT EXISTS profit_distribution_intents_distributor_idx ON profit_distribution_intents(profit_distributor_address);
