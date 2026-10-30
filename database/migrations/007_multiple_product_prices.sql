DROP INDEX IF EXISTS prices_one_active_per_product_idx;

CREATE UNIQUE INDEX IF NOT EXISTS prices_one_active_per_product_interval_idx
  ON prices (product_id, billing_interval)
  WHERE active = TRUE;
