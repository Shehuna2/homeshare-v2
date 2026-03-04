-- Soft-delete support for property management in admin console.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS properties_archived_at_idx
  ON properties(archived_at);
