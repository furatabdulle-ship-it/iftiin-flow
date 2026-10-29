ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS requires_purchase BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS storage_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  checksum_sha256 TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'deleted')),
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  product_type TEXT NOT NULL CHECK (product_type IN (
    'digital_download', 'premium_article', 'online_course', 'bundle', 'membership'
  )),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  stripe_product_id TEXT UNIQUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS products_public_listing_idx
  ON products (status, product_type, created_at DESC);

CREATE TABLE IF NOT EXISTS prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  currency CHAR(3) NOT NULL DEFAULT 'eur' CHECK (currency = lower(currency) AND currency ~ '^[a-z]{3}$'),
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  billing_interval TEXT NOT NULL DEFAULT 'one_time'
    CHECK (billing_interval IN ('one_time', 'month', 'year')),
  stripe_price_id TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, product_id),
  CHECK (
    (billing_interval = 'one_time' AND product_id IS NOT NULL)
    OR billing_interval IN ('month', 'year')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS prices_one_active_per_product_idx
  ON prices (product_id) WHERE active = TRUE;

CREATE TABLE IF NOT EXISTS content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type TEXT NOT NULL CHECK (content_type IN ('article', 'download', 'lesson', 'video')),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  article_id UUID UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
  storage_asset_id UUID REFERENCES storage_assets(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((content_type = 'article' AND article_id IS NOT NULL AND storage_asset_id IS NULL)
    OR (content_type IN ('download', 'lesson', 'video') AND article_id IS NULL))
);

CREATE INDEX IF NOT EXISTS content_items_public_idx
  ON content_items (content_type, status, position, created_at DESC);

INSERT INTO content_items (content_type, slug, title, description, body, article_id, status)
SELECT 'article', slug, title, description, body, id,
       CASE WHEN status = 'published' THEN 'published' ELSE 'draft' END
FROM articles
ON CONFLICT (article_id) DO NOTHING;

CREATE OR REPLACE FUNCTION sync_article_content_item() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO content_items (content_type, slug, title, description, body, article_id, status)
  VALUES (
    'article', NEW.slug, NEW.title, NEW.description, NEW.body, NEW.id,
    CASE WHEN NEW.status = 'published' THEN 'published' ELSE 'draft' END
  )
  ON CONFLICT (article_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    body = EXCLUDED.body,
    status = EXCLUDED.status,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_sync_content_item ON articles;
CREATE TRIGGER articles_sync_content_item
AFTER INSERT OR UPDATE OF slug, title, description, body, status ON articles
FOR EACH ROW EXECUTE FUNCTION sync_article_content_item();

CREATE TABLE IF NOT EXISTS product_content (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (product_id, content_item_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  currency CHAR(3) NOT NULL CHECK (currency = lower(currency) AND currency ~ '^[a-z]{3}$'),
  subtotal_cents BIGINT NOT NULL CHECK (subtotal_cents >= 0),
  total_cents BIGINT NOT NULL CHECK (total_cents >= 0),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_user_history_idx
  ON orders (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  price_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount_cents BIGINT NOT NULL CHECK (unit_amount_cents >= 0),
  currency CHAR(3) NOT NULL CHECK (currency = lower(currency) AND currency ~ '^[a-z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (price_id, product_id) REFERENCES prices(id, product_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS order_item_content (
  order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_item_id, content_item_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe')),
  provider_payment_intent_id TEXT UNIQUE,
  provider_charge_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
  refunded_cents BIGINT NOT NULL DEFAULT 0 CHECK (refunded_cents >= 0),
  currency CHAR(3) NOT NULL CHECK (currency = lower(currency) AND currency ~ '^[a-z]{3}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (refunded_cents <= amount_cents)
);

CREATE INDEX IF NOT EXISTS payments_order_idx ON payments (order_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused'
  )),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (user_id, status);

CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES orders(id) ON DELETE RESTRICT,
  source TEXT NOT NULL CHECK (source IN ('purchase', 'manual', 'subscription')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, product_id),
  CHECK ((status = 'revoked' AND revoked_at IS NOT NULL) OR status <> 'revoked')
);

CREATE INDEX IF NOT EXISTS entitlements_user_active_idx
  ON entitlements (user_id, status, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS entitlements_product_idx ON entitlements (product_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS entitlements_subscription_unique_idx
  ON entitlements (user_id, product_id)
  WHERE source = 'subscription' AND order_id IS NULL;

CREATE TABLE IF NOT EXISTS entitlement_content (
  entitlement_id UUID NOT NULL REFERENCES entitlements(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entitlement_id, content_item_id)
);

CREATE TABLE IF NOT EXISTS learning_progress (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_item_id UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  progress_percent SMALLINT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  completed_at TIMESTAMPTZ,
  last_position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (last_position_seconds >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, content_item_id),
  CHECK ((progress_percent = 100 AND completed_at IS NOT NULL) OR progress_percent < 100)
);

CREATE INDEX IF NOT EXISTS learning_progress_user_idx
  ON learning_progress (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS webhook_events (
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe')),
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  PRIMARY KEY (provider, event_id)
);

CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx
  ON webhook_events (received_at) WHERE status <> 'processed';
