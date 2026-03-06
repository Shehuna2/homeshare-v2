-- Optional geolocation coordinates for property creation/display.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

ALTER TABLE property_intents
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6);

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_latitude_range_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_latitude_range_check
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE properties
  DROP CONSTRAINT IF EXISTS properties_longitude_range_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_longitude_range_check
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE property_intents
  DROP CONSTRAINT IF EXISTS property_intents_latitude_range_check;
ALTER TABLE property_intents
  ADD CONSTRAINT property_intents_latitude_range_check
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE property_intents
  DROP CONSTRAINT IF EXISTS property_intents_longitude_range_check;
ALTER TABLE property_intents
  ADD CONSTRAINT property_intents_longitude_range_check
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

