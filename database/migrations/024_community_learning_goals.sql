CREATE TABLE IF NOT EXISTS community_learning_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  skill_area TEXT NOT NULL CHECK (
    skill_area IN ('Future Skills', 'AI Literacy', 'Media Literacy', 'Storytelling & Communication')
  ),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned', 'In Progress', 'Achieved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS community_learning_goals_user_created_idx
  ON community_learning_goals (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS community_learning_goals_active_user_idx
  ON community_learning_goals (user_id)
  WHERE status IN ('Planned', 'In Progress');

CREATE TABLE IF NOT EXISTS community_learning_goal_resources (
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('article', 'learning')),
  resource_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, goal_id, resource_type, resource_id),
  FOREIGN KEY (goal_id, user_id)
    REFERENCES community_learning_goals (id, user_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, resource_type, resource_id)
    REFERENCES saved_resources (user_id, resource_type, resource_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS community_learning_goal_resources_goal_idx
  ON community_learning_goal_resources (user_id, goal_id);
