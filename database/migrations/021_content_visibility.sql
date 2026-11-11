ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'community'));

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public', 'community'));

UPDATE content_items ci
SET visibility = a.visibility
FROM articles a
WHERE ci.article_id = a.id
  AND ci.visibility IS DISTINCT FROM a.visibility;

CREATE OR REPLACE FUNCTION sync_article_content_item() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO content_items (
    content_type, slug, title, description, body,
    title_en, description_en, body_en, article_id, status, visibility
  )
  VALUES (
    'article', NEW.slug, NEW.title, NEW.description, NEW.body,
    NEW.title_en, NEW.description_en, NEW.body_en, NEW.id,
    CASE WHEN NEW.status = 'published' THEN 'published' ELSE 'draft' END,
    NEW.visibility
  )
  ON CONFLICT (article_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    body = EXCLUDED.body,
    title_en = EXCLUDED.title_en,
    description_en = EXCLUDED.description_en,
    body_en = EXCLUDED.body_en,
    status = EXCLUDED.status,
    visibility = EXCLUDED.visibility,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_sync_content_item ON articles;
CREATE TRIGGER articles_sync_content_item
AFTER INSERT OR UPDATE OF slug, title, description, body, title_en, description_en, body_en, status, visibility ON articles
FOR EACH ROW EXECUTE FUNCTION sync_article_content_item();
