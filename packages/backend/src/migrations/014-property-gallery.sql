-- Property gallery support (multiple images per property).

ALTER TABLE property_intents
  ADD COLUMN IF NOT EXISTS gallery_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS property_images (
  id UUID PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS property_images_property_id_idx
  ON property_images(property_id);

CREATE INDEX IF NOT EXISTS property_images_sort_order_idx
  ON property_images(property_id, sort_order);

-- Backfill one gallery row from existing cover image where missing.
INSERT INTO property_images (id, property_id, image_url, sort_order, created_at)
SELECT p.id, p.id, p.image_url, 0, NOW()
FROM properties p
WHERE p.image_url IS NOT NULL
  AND p.image_url <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM property_images pi
    WHERE pi.property_id = p.id
  );
