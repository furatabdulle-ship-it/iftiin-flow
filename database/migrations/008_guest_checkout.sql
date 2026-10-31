ALTER TABLE orders
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN guest_email TEXT;

ALTER TABLE orders
  ADD CONSTRAINT orders_buyer_required_check
  CHECK (user_id IS NOT NULL OR guest_email IS NOT NULL);

CREATE INDEX orders_guest_email_idx
  ON orders (guest_email, created_at DESC)
  WHERE user_id IS NULL;

ALTER TABLE subscriptions
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN guest_email TEXT;

CREATE INDEX subscriptions_guest_email_idx
  ON subscriptions (guest_email, status)
  WHERE user_id IS NULL;

CREATE TABLE guest_access_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX guest_access_tokens_email_idx
  ON guest_access_tokens (email, created_at DESC);

CREATE TABLE guest_access_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX guest_access_sessions_expires_at_idx
  ON guest_access_sessions (expires_at);
