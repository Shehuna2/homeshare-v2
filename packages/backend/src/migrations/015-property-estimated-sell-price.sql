ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS estimated_sell_usdc_base_units BIGINT;

ALTER TABLE property_intents
  ADD COLUMN IF NOT EXISTS estimated_sell_usdc_base_units BIGINT;

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_estimated_sell_positive_check;

ALTER TABLE properties
  ADD CONSTRAINT properties_estimated_sell_positive_check
  CHECK (
    estimated_sell_usdc_base_units IS NULL OR estimated_sell_usdc_base_units > 0
  );

ALTER TABLE property_intents
  DROP CONSTRAINT IF EXISTS property_intents_estimated_sell_positive_check;

ALTER TABLE property_intents
  ADD CONSTRAINT property_intents_estimated_sell_positive_check
  CHECK (
    estimated_sell_usdc_base_units IS NULL OR estimated_sell_usdc_base_units > 0
  );
