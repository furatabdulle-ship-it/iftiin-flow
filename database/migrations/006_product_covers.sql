ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cover_asset_id UUID REFERENCES storage_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS products_cover_asset_idx
  ON products (cover_asset_id)
  WHERE cover_asset_id IS NOT NULL;
