-- Optional transfer amount for platform fee intents.
-- When set (> 0), the platform fee worker transfers USDC to recipient.

ALTER TABLE platform_fee_intents
  ADD COLUMN IF NOT EXISTS usdc_amount_base_units BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'platform_fee_intents_usdc_amount_nonnegative'
  ) THEN
    ALTER TABLE platform_fee_intents
      ADD CONSTRAINT platform_fee_intents_usdc_amount_nonnegative
      CHECK (usdc_amount_base_units IS NULL OR usdc_amount_base_units >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS platform_fee_intents_usdc_amount_idx
  ON platform_fee_intents(usdc_amount_base_units);
