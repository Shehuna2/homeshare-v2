-- Add optional media fields for property cards/details and admin property intents.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_embed_url TEXT;

ALTER TABLE property_intents
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_embed_url TEXT;
