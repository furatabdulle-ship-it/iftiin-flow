CREATE TABLE IF NOT EXISTS goal_sprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  starts_on DATE,
  ends_on DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS goal_sprints_status_created_idx
  ON goal_sprints (status, created_at DESC);

CREATE TABLE IF NOT EXISTS community_goal_sprint_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id UUID NOT NULL REFERENCES goal_sprints(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  motivation TEXT NOT NULL DEFAULT '' CHECK (char_length(motivation) <= 1000),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (sprint_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_goal_sprint_enrollments_user_status_idx
  ON community_goal_sprint_enrollments (user_id, status);
CREATE INDEX IF NOT EXISTS community_goal_sprint_enrollments_review_idx
  ON community_goal_sprint_enrollments (status, requested_at DESC);
