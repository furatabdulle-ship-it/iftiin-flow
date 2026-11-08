CREATE TABLE skills_navigator_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  locale TEXT NOT NULL CHECK (locale IN ('de', 'en')),
  consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  confirmation_token_hash CHAR(64) UNIQUE,
  confirmation_expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  last_update_sent_at TIMESTAMPTZ,
  retention_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (status = 'pending' AND confirmation_token_hash IS NOT NULL AND confirmed_at IS NULL)
    OR (status = 'confirmed' AND confirmation_token_hash IS NULL AND confirmed_at IS NOT NULL)
  )
);

CREATE INDEX skills_navigator_waitlist_status_idx
  ON skills_navigator_waitlist (status, created_at DESC);
CREATE INDEX skills_navigator_waitlist_retention_idx
  ON skills_navigator_waitlist (retention_until)
  WHERE status = 'confirmed';

CREATE TABLE skills_navigator_waitlist_unsubscribe_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  signup_id UUID NOT NULL REFERENCES skills_navigator_waitlist (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX skills_navigator_waitlist_unsubscribe_signup_idx
  ON skills_navigator_waitlist_unsubscribe_tokens (signup_id);
