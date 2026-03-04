ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS conservative_sell_usdc_base_units BIGINT,
  ADD COLUMN IF NOT EXISTS base_sell_usdc_base_units BIGINT,
  ADD COLUMN IF NOT EXISTS optimistic_sell_usdc_base_units BIGINT,
  ADD COLUMN IF NOT EXISTS conservative_multiplier_bps INTEGER,
  ADD COLUMN IF NOT EXISTS base_multiplier_bps INTEGER,
  ADD COLUMN IF NOT EXISTS optimistic_multiplier_bps INTEGER;

ALTER TABLE property_intents
  ADD COLUMN IF NOT EXISTS conservative_sell_usdc_base_units BIGINT,
  ADD COLUMN IF NOT EXISTS base_sell_usdc_base_units BIGINT,
  ADD COLUMN IF NOT EXISTS optimistic_sell_usdc_base_units BIGINT,
  ADD COLUMN IF NOT EXISTS conservative_multiplier_bps INTEGER,
  ADD COLUMN IF NOT EXISTS base_multiplier_bps INTEGER,
  ADD COLUMN IF NOT EXISTS optimistic_multiplier_bps INTEGER;

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_conservative_sell_positive_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_conservative_sell_positive_check
  CHECK (conservative_sell_usdc_base_units IS NULL OR conservative_sell_usdc_base_units > 0);

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_base_sell_positive_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_base_sell_positive_check
  CHECK (base_sell_usdc_base_units IS NULL OR base_sell_usdc_base_units > 0);

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_optimistic_sell_positive_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_optimistic_sell_positive_check
  CHECK (optimistic_sell_usdc_base_units IS NULL OR optimistic_sell_usdc_base_units > 0);

ALTER TABLE property_intents
  DROP CONSTRAINT IF EXISTS property_intents_conservative_sell_positive_check;
ALTER TABLE property_intents
  ADD CONSTRAINT property_intents_conservative_sell_positive_check
  CHECK (conservative_sell_usdc_base_units IS NULL OR conservative_sell_usdc_base_units > 0);

ALTER TABLE property_intents
  DROP CONSTRAINT IF EXISTS property_intents_base_sell_positive_check;
ALTER TABLE property_intents
  ADD CONSTRAINT property_intents_base_sell_positive_check
  CHECK (base_sell_usdc_base_units IS NULL OR base_sell_usdc_base_units > 0);

ALTER TABLE property_intents
  DROP CONSTRAINT IF EXISTS property_intents_optimistic_sell_positive_check;
ALTER TABLE property_intents
  ADD CONSTRAINT property_intents_optimistic_sell_positive_check
  CHECK (optimistic_sell_usdc_base_units IS NULL OR optimistic_sell_usdc_base_units > 0);

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_conservative_multiplier_range_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_conservative_multiplier_range_check
  CHECK (conservative_multiplier_bps IS NULL OR (conservative_multiplier_bps > 0 AND conservative_multiplier_bps <= 100000));

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_base_multiplier_range_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_base_multiplier_range_check
  CHECK (base_multiplier_bps IS NULL OR (base_multiplier_bps > 0 AND base_multiplier_bps <= 100000));

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_optimistic_multiplier_range_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_optimistic_multiplier_range_check
  CHECK (optimistic_multiplier_bps IS NULL OR (optimistic_multiplier_bps > 0 AND optimistic_multiplier_bps <= 100000));

ALTER TABLE property_intents
  DROP CONSTRAINT IF EXISTS property_intents_conservative_multiplier_range_check;
ALTER TABLE property_intents
  ADD CONSTRAINT property_intents_conservative_multiplier_range_check
  CHECK (conservative_multiplier_bps IS NULL OR (conservative_multiplier_bps > 0 AND conservative_multiplier_bps <= 100000));

ALTER TABLE property_intents
  DROP CONSTRAINT IF EXISTS property_intents_base_multiplier_range_check;
ALTER TABLE property_intents
  ADD CONSTRAINT property_intents_base_multiplier_range_check
  CHECK (base_multiplier_bps IS NULL OR (base_multiplier_bps > 0 AND base_multiplier_bps <= 100000));

ALTER TABLE property_intents
  DROP CONSTRAINT IF EXISTS property_intents_optimistic_multiplier_range_check;
ALTER TABLE property_intents
  ADD CONSTRAINT property_intents_optimistic_multiplier_range_check
  CHECK (optimistic_multiplier_bps IS NULL OR (optimistic_multiplier_bps > 0 AND optimistic_multiplier_bps <= 100000));
