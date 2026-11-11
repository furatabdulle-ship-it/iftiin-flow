CREATE TABLE IF NOT EXISTS community_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  linkedin_url TEXT NOT NULL DEFAULT '',
  profile_picture_url TEXT NOT NULL DEFAULT '',
  personal_learning_goals TEXT NOT NULL DEFAULT '',
  interests TEXT[] NOT NULL DEFAULT '{}',
  expertise TEXT[] NOT NULL DEFAULT '{}',
  is_visible BOOLEAN NOT NULL DEFAULT FALSE,
  show_display_name BOOLEAN NOT NULL DEFAULT FALSE,
  show_headline BOOLEAN NOT NULL DEFAULT FALSE,
  show_bio BOOLEAN NOT NULL DEFAULT FALSE,
  show_location BOOLEAN NOT NULL DEFAULT FALSE,
  show_website BOOLEAN NOT NULL DEFAULT FALSE,
  show_linkedin BOOLEAN NOT NULL DEFAULT FALSE,
  show_profile_picture BOOLEAN NOT NULL DEFAULT FALSE,
  show_interests BOOLEAN NOT NULL DEFAULT FALSE,
  show_expertise BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_profiles_visible_updated_idx
  ON community_profiles (updated_at DESC)
  WHERE is_visible = TRUE;
