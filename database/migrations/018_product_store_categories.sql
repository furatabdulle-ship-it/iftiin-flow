ALTER TABLE products
  ADD COLUMN store_category TEXT
  CHECK (store_category IS NULL OR store_category IN (
    'knowledge_products',
    'creative_skill_kits',
    'new_ways_of_working_kits'
  ));
