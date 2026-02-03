-- Core schema for PropertyCrowdfund indexer (base-unit accounting).

CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY,
  property_id TEXT NOT NULL,
  chain_id BIGINT NOT NULL,
  name TEXT,
  location TEXT,
  description TEXT,
  crowdfund_contract_address TEXT NOT NULL UNIQUE,
  target_usdc_base_units BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS properties_property_id_idx ON properties(property_id);
CREATE INDEX IF NOT EXISTS properties_crowdfund_address_idx ON properties(crowdfund_contract_address);

COMMENT ON TABLE properties IS 'Derived from PropertyCrowdfund deployment (constructor args).';

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  chain_id BIGINT NOT NULL,
  contract_address TEXT NOT NULL UNIQUE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('ACTIVE', 'SUCCESS', 'FAILED', 'WITHDRAWN')),
  target_usdc_base_units BIGINT NOT NULL,
  raised_usdc_base_units BIGINT NOT NULL DEFAULT 0,
  finalized_tx_hash TEXT,
  finalized_log_index INTEGER,
  finalized_block_number BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaigns_contract_address_idx ON campaigns(contract_address);
CREATE INDEX IF NOT EXISTS campaigns_property_id_idx ON campaigns(property_id);

COMMENT ON TABLE campaigns IS 'State derived from PropertyCrowdfund.Finalized/Withdrawn events.';

CREATE TABLE IF NOT EXISTS campaign_investments (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  chain_id BIGINT NOT NULL,
  investor_address TEXT NOT NULL,
  usdc_amount_base_units BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS campaign_investments_investor_idx ON campaign_investments(investor_address);
CREATE INDEX IF NOT EXISTS campaign_investments_campaign_idx ON campaign_investments(campaign_id);

COMMENT ON TABLE campaign_investments IS 'Derived from PropertyCrowdfund.Invested events.';

CREATE TABLE IF NOT EXISTS campaign_refunds (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  chain_id BIGINT NOT NULL,
  investor_address TEXT NOT NULL,
  usdc_amount_base_units BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS campaign_refunds_investor_idx ON campaign_refunds(investor_address);
CREATE INDEX IF NOT EXISTS campaign_refunds_campaign_idx ON campaign_refunds(campaign_id);

COMMENT ON TABLE campaign_refunds IS 'Derived from PropertyCrowdfund.Refunded events.';
