ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_status_check,
  ADD CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'canceled', 'disputed'));

ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_status_check,
  ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded', 'disputed'));

ALTER TABLE entitlements
  ADD COLUMN revocation_reason TEXT,
  ADD CONSTRAINT entitlements_revocation_reason_check
    CHECK (revocation_reason IS NULL OR revocation_reason IN ('refund', 'dispute', 'subscription', 'manual'));

CREATE TABLE payment_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_dispute_id TEXT NOT NULL UNIQUE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX payment_disputes_order_idx ON payment_disputes (order_id, status);
