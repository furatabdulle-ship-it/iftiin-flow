import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withTransaction } from './db';

type StripeRecord = Record<string, unknown>;

function record(value: unknown): StripeRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as StripeRecord
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function idFrom(value: unknown): string | null {
  return typeof value === 'string' ? value : text(record(value)?.id);
}

function metadataText(object: StripeRecord, key: string): string | null {
  return text(record(object.metadata)?.[key]);
}

function asDate(value: unknown): Date | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function verifyStripeSignature(payload: string, header: string | null): boolean {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  const fields = header.split(',').map((field) => field.split('=', 2));
  const timestampText = fields.find(([key]) => key === 't')?.[1];
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const signedPayload = `${timestampText}.${payload}`;
  const expected = createHmac('sha256', secret).update(signedPayload).digest();
  return fields
    .filter(([key]) => key === 'v1')
    .some(([, signature]) => {
      if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
      const actual = Buffer.from(signature, 'hex');
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    });
}

async function grantOrderEntitlements(client: PoolClient, orderId: string): Promise<void> {
  const granted = await client.query<{ id: string; product_id: string }>(
    `INSERT INTO entitlements (user_id, product_id, order_id, source, status)
     SELECT o.user_id, oi.product_id, o.id, 'purchase', 'active'
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE o.id = $1 AND o.status = 'paid' AND p.product_type <> 'membership'
     ON CONFLICT (order_id, product_id) DO UPDATE
       SET status = 'active', starts_at = NOW(), expires_at = NULL, revoked_at = NULL
     RETURNING id, product_id`,
    [orderId],
  );
  for (const entitlement of granted.rows) {
    await client.query(
      `INSERT INTO entitlement_content (entitlement_id, content_item_id)
       SELECT $1, oic.content_item_id
       FROM order_items oi
       JOIN order_item_content oic ON oic.order_item_id = oi.id
       WHERE oi.order_id = $2 AND oi.product_id = $3
       ON CONFLICT DO NOTHING`,
      [entitlement.id, orderId, entitlement.product_id],
    );
    await client.query(
      `INSERT INTO entitlement_content (entitlement_id, content_item_id)
       SELECT $1, pc.content_item_id
       FROM product_content pc
       WHERE pc.product_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM order_items oi
           JOIN order_item_content oic ON oic.order_item_id = oi.id
           WHERE oi.order_id = $3 AND oi.product_id = $2
         )
       ON CONFLICT DO NOTHING`,
      [entitlement.id, entitlement.product_id, orderId],
    );
  }
}

async function refreshSubscriptionEntitlement(client: PoolClient, subscriptionId: string): Promise<void> {
  const result = await client.query<{
    user_id: string;
    product_id: string;
    status: string;
    current_period_end: Date | null;
  }>(
    `SELECT user_id, product_id, status, current_period_end
     FROM subscriptions WHERE stripe_subscription_id = $1`,
    [subscriptionId],
  );
  const subscription = result.rows[0];
  if (!subscription) return;
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    const granted = await client.query<{ id: string }>(
      `INSERT INTO entitlements
       (user_id, product_id, source, status, expires_at)
       VALUES ($1, $2, 'subscription', 'active', $3)
       ON CONFLICT (user_id, product_id)
       WHERE source = 'subscription' AND order_id IS NULL
       DO UPDATE SET status = 'active', starts_at = NOW(),
         expires_at = EXCLUDED.expires_at, revoked_at = NULL
       RETURNING id`,
      [subscription.user_id, subscription.product_id, subscription.current_period_end],
    );
    if (granted.rows[0]) {
      await client.query(
        `INSERT INTO entitlement_content (entitlement_id, content_item_id)
         SELECT $1, content_item_id FROM product_content WHERE product_id = $2
         ON CONFLICT DO NOTHING`,
        [granted.rows[0].id, subscription.product_id],
      );
    }
  } else {
    await client.query(
      `UPDATE entitlements
       SET status = 'revoked', revoked_at = COALESCE(revoked_at, NOW()), expires_at = NULL
       WHERE user_id = $1 AND product_id = $2
         AND source = 'subscription' AND order_id IS NULL`,
      [subscription.user_id, subscription.product_id],
    );
  }
}

async function applySubscription(
  client: PoolClient,
  subscription: StripeRecord,
  eventType: string,
): Promise<void> {
  const stripeId = idFrom(subscription);
  if (!stripeId) throw new Error('Stripe-Subscription ohne ID.');
  const metadataUserId = metadataText(subscription, 'user_id');
  const metadataProductId = metadataText(subscription, 'product_id');
  const userId = metadataUserId && /^[0-9a-f-]{36}$/i.test(metadataUserId) ? metadataUserId : null;
  const productId = metadataProductId && /^[0-9a-f-]{36}$/i.test(metadataProductId) ? metadataProductId : null;
  const status = eventType === 'customer.subscription.deleted'
    ? 'canceled'
    : text(subscription.status);
  const allowedStatuses = new Set(['incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused']);
  if (!status || !allowedStatuses.has(status)) throw new Error('Unbekannter Stripe-Subscription-Status.');

  const existing = await client.query<{ user_id: string; product_id: string }>(
    'SELECT user_id, product_id FROM subscriptions WHERE stripe_subscription_id = $1',
    [stripeId],
  );
  const finalUserId = userId ?? existing.rows[0]?.user_id;
  const finalProductId = productId ?? existing.rows[0]?.product_id;
  if (!finalUserId || !finalProductId) throw new Error('Subscription-Metadaten fehlen.');

  const metadataOrderId = metadataText(subscription, 'order_id');
  const orderId = metadataOrderId && /^[0-9a-f-]{36}$/i.test(metadataOrderId) ? metadataOrderId : null;
  const customerId = idFrom(subscription.customer);
  await client.query(
    `INSERT INTO subscriptions
       (user_id, product_id, order_id, stripe_subscription_id, stripe_customer_id, status,
        current_period_start, current_period_end, cancel_at_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (stripe_subscription_id) DO UPDATE SET
       status = EXCLUDED.status,
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at = NOW()`,
    [
      finalUserId, finalProductId, orderId, stripeId, customerId, status,
      asDate(subscription.current_period_start), asDate(subscription.current_period_end),
      subscription.cancel_at_period_end === true,
    ],
  );
  await refreshSubscriptionEntitlement(client, stripeId);
}

async function applyCheckoutSession(client: PoolClient, session: StripeRecord): Promise<void> {
  const sessionId = text(session.id);
  const metadataOrderId = metadataText(session, 'order_id');
  const orderId = metadataOrderId && /^[0-9a-f-]{36}$/i.test(metadataOrderId) ? metadataOrderId : null;
  if (!sessionId) throw new Error('Stripe-Checkout-Session ohne ID.');
  const orderResult = orderId
    ? await client.query<{ id: string; total_cents: string; currency: string; status: string }>(
      'SELECT id, total_cents, currency, status FROM orders WHERE id = $1 FOR UPDATE',
      [orderId],
    )
    : await client.query<{ id: string; total_cents: string; currency: string; status: string }>(
      'SELECT id, total_cents, currency, status FROM orders WHERE stripe_checkout_session_id = $1 FOR UPDATE',
      [sessionId],
    );
  const order = orderResult.rows[0];
  if (!order) throw new Error('Zugehörige Bestellung nicht gefunden.');
  if (order.status === 'refunded' || order.status === 'canceled') return;

  const sessionCurrency = text(session.currency);
  const sessionAmount = typeof session.amount_total === 'number' ? session.amount_total : null;
  if (sessionCurrency !== order.currency || sessionAmount !== Number(order.total_cents)) {
    throw new Error('Stripe-Betrag stimmt nicht mit der Bestellung überein.');
  }

  const paymentStatus = text(session.payment_status);
  if (paymentStatus !== 'paid' && paymentStatus !== 'no_payment_required') return;

  const customerId = idFrom(session.customer);
  const paymentIntentId = idFrom(session.payment_intent);
  const amount = sessionAmount;
  await client.query(
    `UPDATE orders SET status = 'paid', stripe_customer_id = COALESCE($2, stripe_customer_id),
       updated_at = NOW() WHERE id = $1 AND status IN ('pending', 'paid')`,
    [order.id, customerId],
  );
  if (paymentIntentId) {
    await client.query(
      `INSERT INTO payments
       (order_id, provider_payment_intent_id, status, amount_cents, currency)
       VALUES ($1, $2, 'succeeded', $3, $4)
       ON CONFLICT (provider_payment_intent_id) DO UPDATE
       SET status = 'succeeded', amount_cents = EXCLUDED.amount_cents,
           currency = EXCLUDED.currency, updated_at = NOW()`,
      [order.id, paymentIntentId, amount, order.currency],
    );
  } else {
    await client.query(
      `INSERT INTO payments (order_id, status, amount_cents, currency)
       VALUES ($1, 'succeeded', $2, $3)`,
      [order.id, amount, order.currency],
    );
  }

  const subscriptionId = idFrom(session.subscription);
  if (subscriptionId && text(session.mode) === 'subscription') {
    const userId = metadataText(session, 'user_id');
    const productId = metadataText(session, 'product_id');
    if (!userId || !productId) throw new Error('Subscription-Metadaten im Checkout fehlen.');
    await client.query(
      `INSERT INTO subscriptions
       (user_id, product_id, order_id, stripe_subscription_id, stripe_customer_id, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       ON CONFLICT (stripe_subscription_id) DO UPDATE SET
         order_id = COALESCE(subscriptions.order_id, EXCLUDED.order_id),
         stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
         updated_at = NOW()`,
      [userId, productId, order.id, subscriptionId, customerId],
    );
    await refreshSubscriptionEntitlement(client, subscriptionId);
  }
  await grantOrderEntitlements(client, order.id);
}

async function applyRefund(client: PoolClient, charge: StripeRecord): Promise<void> {
  const paymentIntentId = idFrom(charge.payment_intent);
  if (!paymentIntentId) return;
  const refunded = typeof charge.amount_refunded === 'number' ? charge.amount_refunded : 0;
  const total = typeof charge.amount === 'number' ? charge.amount : 0;
  const paymentStatus = refunded >= total ? 'refunded' : 'partially_refunded';
  const result = await client.query<{ order_id: string }>(
    `UPDATE payments SET refunded_cents = $2, status = $3, provider_charge_id = $4, updated_at = NOW()
     WHERE provider_payment_intent_id = $1 RETURNING order_id`,
    [paymentIntentId, refunded, paymentStatus, text(charge.id)],
  );
  if (result.rowCount && refunded >= total && total > 0) {
    const orderId = result.rows[0].order_id;
    await client.query(
      `UPDATE orders SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
      [orderId],
    );
    await client.query(
      `UPDATE entitlements SET status = 'revoked', revoked_at = NOW()
       WHERE order_id = $1 AND status = 'active'`,
      [orderId],
    );
  }
}

export async function processStripeWebhook(payload: string): Promise<'processed' | 'duplicate'> {
  const event = record(JSON.parse(payload) as unknown);
  const eventId = text(event?.id);
  const eventType = text(event?.type);
  const data = record(event?.data);
  const object = record(data?.object);
  if (!eventId || !eventType || !object) throw new Error('Ungültiges Stripe-Event-Format.');

  return withTransaction(async (client) => {
    const claimed = await client.query(
      `INSERT INTO webhook_events (provider, event_id, event_type, status, attempts)
       VALUES ('stripe', $1, $2, 'received', 1)
       ON CONFLICT (provider, event_id) DO UPDATE SET
         status = 'received', attempts = webhook_events.attempts + 1, last_error = NULL
       WHERE webhook_events.status <> 'processed'
       RETURNING event_id`,
      [eventId, eventType],
    );
    if (!claimed.rowCount) return 'duplicate';

    switch (eventType) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await applyCheckoutSession(client, object);
        break;
      case 'checkout.session.expired': {
        const orderId = metadataText(object, 'order_id');
        if (orderId && /^[0-9a-f-]{36}$/i.test(orderId)) {
          await client.query(
            `UPDATE orders SET status = 'canceled', updated_at = NOW()
             WHERE id = $1 AND status = 'pending'`,
            [orderId],
          );
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await applySubscription(client, object, eventType);
        break;
      case 'invoice.paid': {
        const subscriptionId = idFrom(object.subscription);
        if (subscriptionId) {
          await client.query(
            `UPDATE subscriptions SET status = 'active', updated_at = NOW()
             WHERE stripe_subscription_id = $1`,
            [subscriptionId],
          );
          await refreshSubscriptionEntitlement(client, subscriptionId);
        }
        break;
      }
      case 'charge.refunded':
        await applyRefund(client, object);
        break;
      default:
        break;
    }

    await client.query(
      `UPDATE webhook_events SET status = 'processed', processed_at = NOW(), last_error = NULL
       WHERE provider = 'stripe' AND event_id = $1`,
      [eventId],
    );
    return 'processed';
  });
}
