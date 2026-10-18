ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS login_required BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE articles
  DROP CONSTRAINT IF EXISTS articles_format_check;

ALTER TABLE articles
  ADD CONSTRAINT articles_format_check CHECK (format IN (
    'essay', 'note', 'map', 'deconstruct', 'research',
    'ai-domain', 'capability', 'field-note', 'question', 'video'
  ));

ALTER TABLE articles
  DROP CONSTRAINT IF EXISTS articles_video_fields_check;

ALTER TABLE articles
  ADD CONSTRAINT articles_video_fields_check CHECK (
    (format = 'video' AND video_url IS NOT NULL)
    OR (format <> 'video' AND video_url IS NULL AND login_required = FALSE)
  );

ALTER TABLE articles
  DROP CONSTRAINT IF EXISTS articles_video_url_check;

ALTER TABLE articles
  ADD CONSTRAINT articles_video_url_check CHECK (
    video_url IS NULL
    OR video_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be|vimeo\.com)(/|$)'
    OR video_url ~* '^https?://player\.vimeo\.com/video/'
  );
