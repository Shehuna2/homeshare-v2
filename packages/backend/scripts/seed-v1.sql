-- Dev seed for local v1 API testing.
-- Inserts one property and one campaign on Base Sepolia (chain_id = 84532).

INSERT INTO properties (
  id,
  property_id,
  chain_id,
  name,
  location,
  description,
  crowdfund_contract_address,
  target_usdc_base_units
)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'prop-001',
  84532,
  'Homeshare Sample Property',
  'Seattle, WA',
  'Sample property for v1 API testing.',
  '0x1111111111111111111111111111111111111111',
  100000000
)
ON CONFLICT (crowdfund_contract_address) DO NOTHING;

INSERT INTO campaigns (
  id,
  property_id,
  chain_id,
  contract_address,
  start_time,
  end_time,
  state,
  target_usdc_base_units,
  raised_usdc_base_units
)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  84532,
  '0x2222222222222222222222222222222222222222',
  NOW() - INTERVAL '1 day',
  NOW() + INTERVAL '29 days',
  'ACTIVE',
  100000000,
  0
)
ON CONFLICT (contract_address) DO NOTHING;
