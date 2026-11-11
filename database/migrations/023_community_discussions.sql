CREATE TABLE IF NOT EXISTS community_discussions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'future-skills', 'ai-literacy', 'media-literacy', 'storytelling'
  )),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 5 AND 160),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 20 AND 4000),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_discussions_visible_category_created_idx
  ON community_discussions (category, created_at DESC, id DESC)
  WHERE status = 'visible';
CREATE INDEX IF NOT EXISTS community_discussions_user_created_idx
  ON community_discussions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_discussions_status_created_idx
  ON community_discussions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS community_discussion_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES community_discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_discussion_replies_discussion_created_idx
  ON community_discussion_replies (discussion_id, created_at, id);
CREATE INDEX IF NOT EXISTS community_discussion_replies_user_created_idx
  ON community_discussion_replies (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_discussion_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id UUID NOT NULL REFERENCES community_discussions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (discussion_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_discussion_reports_unreviewed_idx
  ON community_discussion_reports (created_at DESC, discussion_id)
  WHERE reviewed_at IS NULL;
