import { createHmac, timingSafeEqual } from 'node:crypto';
import type { PoolClient } from 'pg';
import { withTransaction } from './db';
import { createGuestAccessToken } from './guest-access';
import { sendGuestAccessEmail } from './password-reset-email';

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
     JOIN prices pr ON pr.id = oi.price_id AND pr.product_id = oi.product_id
     WHERE o.id = $1 AND o.status = 'paid' AND o.user_id IS NOT NULL
       AND (p.product_type <> 'membership' OR pr.billing_interval = 'one_time')
     ON CONFLICT (order_id, product_id) DO UPDATE
       SET status = 'active', starts_at = NOW(), expires_at = NULL,
           revoked_at = NULL, revocation_reason = NULL
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
    user_id: string | null;
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
  if (!subscription.user_id) return;
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    const granted = await client.query<{ id: string }>(
      `INSERT INTO entitlements
       (user_id, product_id, source, status, expires_at)
       VALUES ($1, $2, 'subscription', 'active', $3)
       ON CONFLICT (user_id, product_id)
       WHERE source = 'subscription' AND order_id IS NULL
       DO UPDATE SET status = 'active', starts_at = NOW(),
         expires_at = EXCLUDED.expires_at, revoked_at = NULL, revocation_reason = NULL
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
       SET status = 'revoked', revoked_at = COALESCE(revoked_at, NOW()),
           expires_at = NULL, revocation_reason = 'subscription'
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

  const existing = await client.query<{
    user_id: string | null;
    guest_email: string | null;
    product_id: string;
  }>(
    'SELECT user_id, guest_email, product_id FROM subscriptions WHERE stripe_subscription_id = $1',
    [stripeId],
  );
  const finalUserId = userId ?? existing.rows[0]?.user_id;
  const finalProductId = productId ?? existing.rows[0]?.product_id;
  const metadataEmail = metadataText(subscription, 'guest_email')?.toLowerCase();
  const finalEmail = metadataEmail ?? existing.rows[0]?.guest_email;
  if ((!finalUserId && !finalEmail) || !finalProductId) {
    throw new Error('Subscription-Metadaten fehlen.');
  }

  const metadataOrderId = metadataText(subscription, 'order_id');
  const orderId = metadataOrderId && /^[0-9a-f-]{36}$/i.test(metadataOrderId) ? metadataOrderId : null;
  const customerId = idFrom(subscription.customer);
  await client.query(
    `INSERT INTO subscriptions
       (user_id, guest_email, product_id, order_id, stripe_subscription_id, stripe_customer_id, status,
        current_period_start, current_period_end, cancel_at_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (stripe_subscription_id) DO UPDATE SET
       user_id = COALESCE(EXCLUDED.user_id, subscriptions.user_id),
       guest_email = COALESCE(EXCLUDED.guest_email, subscriptions.guest_email),
       status = EXCLUDED.status,
       stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       cancel_at_period_end = EXCLUDED.cancel_at_period_end,
       updated_at = NOW()`,
    [
      finalUserId, finalEmail, finalProductId, orderId, stripeId, customerId, status,
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
    ? await client.query<{
      id: string; user_id: string | null; guest_email: string | null;
      total_cents: string; currency: string; status: string;
      stripe_checkout_session_id: string | null;
    }>(
      `SELECT id, user_id, guest_email, total_cents, currency, status, stripe_checkout_session_id
       FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId],
    )
    : await client.query<{
      id: string; user_id: string | null; guest_email: string | null;
      total_cents: string; currency: string; status: string;
      stripe_checkout_session_id: string | null;
    }>(
      `SELECT id, user_id, guest_email, total_cents, currency, status, stripe_checkout_session_id
       FROM orders WHERE stripe_checkout_session_id = $1 FOR UPDATE`,
      [sessionId],
    );
  const order = orderResult.rows[0];
  if (!order) throw new Error('Zugehörige Bestellung nicht gefunden.');
  if (order.stripe_checkout_session_id && order.stripe_checkout_session_id !== sessionId) {
    throw new Error('Checkout-Session stimmt nicht mit der Bestellung überein.');
  }
  if (['refunded', 'canceled', 'failed', 'disputed'].includes(order.status)) return;
  const alreadyPaid = order.status === 'paid';

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
  const customerDetailsEmail = text(record(session.customer_details)?.email)?.toLowerCase();
  const guestEmail = order.user_id
    ? null
    : customerDetailsEmail ?? metadataText(session, 'guest_email')?.toLowerCase() ?? order.guest_email;
  if (!order.user_id && !guestEmail) throw new Error('Die Gast-E-Mail-Adresse der Bestellung fehlt.');
  await client.query(
    `UPDATE orders SET status = 'paid', guest_email = COALESCE($3, guest_email),
       stripe_customer_id = COALESCE($2, stripe_customer_id), updated_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'paid')`,
    [order.id, customerId, guestEmail],
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
    const userId = order.user_id ?? metadataText(session, 'user_id');
    const productId = metadataText(session, 'product_id');
    if ((!userId && !guestEmail) || !productId) throw new Error('Subscription-Metadaten im Checkout fehlen.');
    await client.query(
      `INSERT INTO subscriptions
       (user_id, guest_email, product_id, order_id, stripe_subscription_id, stripe_customer_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       ON CONFLICT (stripe_subscription_id) DO UPDATE SET
         order_id = COALESCE(subscriptions.order_id, EXCLUDED.order_id),
         guest_email = COALESCE(EXCLUDED.guest_email, subscriptions.guest_email),
         stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
         updated_at = NOW()`,
      [userId, guestEmail, productId, order.id, subscriptionId, customerId],
    );
    await refreshSubscriptionEntitlement(client, subscriptionId);
  }
  await grantOrderEntitlements(client, order.id);
  if (guestEmail && !alreadyPaid) {
    const accessToken = await createGuestAccessToken(client, guestEmail);
    await sendGuestAccessEmail(guestEmail, accessToken);
  }
}

async function updatePendingCheckoutStatus(
  client: PoolClient,
  session: StripeRecord,
  status: 'failed' | 'canceled',
): Promise<void> {
  const sessionId = text(session.id);
  const metadataOrderId = metadataText(session, 'order_id');
  const orderId = metadataOrderId && /^[0-9a-f-]{36}$/i.test(metadataOrderId) ? metadataOrderId : null;
  if (!sessionId && !orderId) throw new Error('Checkout-Session ohne Bestellreferenz.');

  const result = orderId
    ? await client.query<{ id: string; status: string; stripe_checkout_session_id: string | null }>(
      `SELECT id, status, stripe_checkout_session_id FROM orders
       WHERE id = $1 FOR UPDATE`,
      [orderId],
    )
    : await client.query<{ id: string; status: string; stripe_checkout_session_id: string | null }>(
      `SELECT id, status, stripe_checkout_session_id FROM orders
       WHERE stripe_checkout_session_id = $1 FOR UPDATE`,
      [sessionId],
    );
  const order = result.rows[0];
  if (!order) throw new Error('Zugehörige Bestellung nicht gefunden.');
  if (order.stripe_checkout_session_id && sessionId && order.stripe_checkout_session_id !== sessionId) {
    throw new Error('Checkout-Session stimmt nicht mit der Bestellung überein.');
  }
  if (order.status !== 'pending') return;

  await client.query(
    `UPDATE orders SET status = $2, updated_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [order.id, status],
  );
}

async function applyRefund(client: PoolClient, charge: StripeRecord): Promise<void> {
  const paymentIntentId = idFrom(charge.payment_intent);
  const chargeId = text(charge.id);
  if (!paymentIntentId && !chargeId) throw new Error('Stripe-Refund ohne Zahlungsreferenz.');
  const refunded = typeof charge.amount_refunded === 'number' ? charge.amount_refunded : 0;
  const total = typeof charge.amount === 'number' ? charge.amount : 0;
  if (total <= 0 || refunded < 0 || refunded > total) {
    throw new Error('Stripe-Refund enthält ungültige Beträge.');
  }
  const result = await client.query<{
    id: string;
    order_id: string;
  }>(
    `SELECT id, order_id FROM payments
     WHERE ($1::text IS NOT NULL AND provider_payment_intent_id = $1)
        OR ($2::text IS NOT NULL AND provider_charge_id = $2)
     FOR UPDATE`,
    [paymentIntentId, chargeId],
  );
  const payment = result.rows[0];
  if (!payment) throw new Error('Zugehörige Zahlung zum Refund nicht gefunden.');

  const totalRefunded = Math.max(refunded, 0);
  const fullRefund = totalRefunded >= total;
  const activeDispute = await client.query<{ active: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM payment_disputes
       WHERE payment_id = $1
         AND status NOT IN ('won', 'lost', 'warning_closed')
     ) AS active`,
    [payment.id],
  );
  const paymentStatus = activeDispute.rows[0]?.active
    ? 'disputed'
    : fullRefund ? 'refunded' : 'partially_refunded';
  await client.query(
    `UPDATE payments
     SET refunded_cents = $2, status = $3,
         provider_charge_id = COALESCE($4, provider_charge_id), updated_at = NOW()
     WHERE id = $1`,
    [payment.id, totalRefunded, paymentStatus, chargeId],
  );

  if (fullRefund) {
    await client.query(
      `UPDATE orders SET status = 'refunded', updated_at = NOW()
       WHERE id = $1 AND status IN ('paid', 'disputed')`,
      [payment.order_id],
    );
    await client.query(
      `UPDATE entitlements
       SET status = 'revoked', revoked_at = COALESCE(revoked_at, NOW()),
           revocation_reason = 'refund'
       WHERE order_id = $1 AND status IN ('active', 'revoked')
         AND (revocation_reason IS NULL OR revocation_reason = 'dispute')`,
      [payment.order_id],
    );
  } else if (activeDispute.rows[0]?.active) {
    await client.query(
      `UPDATE orders SET status = 'disputed', updated_at = NOW()
       WHERE id = $1 AND status = 'paid'`,
      [payment.order_id],
    );
  }
}

async function applyDisputeCreated(client: PoolClient, dispute: StripeRecord): Promise<void> {
  const disputeId = text(dispute.id);
  const chargeId = idFrom(dispute.charge);
  const paymentIntentId = idFrom(dispute.payment_intent);
  if (!disputeId || (!chargeId && !paymentIntentId)) {
    throw new Error('Stripe-Dispute ohne Zahlungsreferenz.');
  }

  const paymentResult = await client.query<{
    id: string;
    order_id: string;
    status: string;
  }>(
    `SELECT id, order_id, status FROM payments
     WHERE ($1::text IS NOT NULL AND provider_payment_intent_id = $1)
        OR ($2::text IS NOT NULL AND provider_charge_id = $2)
     FOR UPDATE`,
    [paymentIntentId, chargeId],
  );
  const payment = paymentResult.rows[0];
  if (!payment) throw new Error('Zugehörige Zahlung zum Dispute nicht gefunden.');

  const disputeStatus = text(dispute.status);
  if (!disputeStatus) throw new Error('Stripe-Dispute ohne Status.');
  await client.query(
    `INSERT INTO payment_disputes (stripe_dispute_id, payment_id, order_id, status)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (stripe_dispute_id) DO UPDATE SET
       status = EXCLUDED.status, updated_at = NOW()`,
    [disputeId, payment.id, payment.order_id, disputeStatus],
  );
  await client.query(
    `UPDATE payments SET status = 'disputed',
       provider_charge_id = COALESCE($2, provider_charge_id), updated_at = NOW()
     WHERE id = $1 AND status <> 'refunded'`,
    [payment.id, chargeId],
  );
  await client.query(
    `UPDATE orders SET status = 'disputed', updated_at = NOW()
     WHERE id = $1 AND status = 'paid'`,
    [payment.order_id],
  );
  await client.query(
    `UPDATE entitlements
     SET status = 'revoked', revoked_at = NOW(), revocation_reason = 'dispute'
     WHERE order_id = $1 AND status = 'active'`,
    [payment.order_id],
  );
}

async function applyDisputeClosed(client: PoolClient, dispute: StripeRecord): Promise<void> {
  const disputeId = text(dispute.id);
  const status = text(dispute.status);
  if (!disputeId || !status) throw new Error('Abgeschlossener Stripe-Dispute ohne ID oder Status.');
  const result = await client.query<{
    payment_id: string;
    order_id: string;
    amount_cents: string;
    refunded_cents: string;
  }>(
    `SELECT d.payment_id, d.order_id, p.amount_cents, p.refunded_cents
     FROM payment_disputes d
     JOIN payments p ON p.id = d.payment_id
     WHERE d.stripe_dispute_id = $1
     FOR UPDATE OF d, p`,
    [disputeId],
  );
  const disputeRow = result.rows[0];
  if (!disputeRow) throw new Error('Zugehöriger Stripe-Dispute nicht gefunden.');
  await client.query(
    `UPDATE payment_disputes SET status = $2, updated_at = NOW()
     WHERE stripe_dispute_id = $1`,
    [disputeId, status],
  );

  if (!['won', 'warning_closed', 'prevented'].includes(status)) return;

  const otherDisputes = await client.query<{ unresolved: boolean; lost: boolean }>(
    `SELECT
       EXISTS (
         SELECT 1 FROM payment_disputes
         WHERE payment_id = $1
           AND status NOT IN ('won', 'warning_closed', 'prevented', 'lost')
       ) AS unresolved,
       EXISTS (
         SELECT 1 FROM payment_disputes
         WHERE payment_id = $1 AND status = 'lost'
       ) AS lost`,
    [disputeRow.payment_id],
  );
  if (otherDisputes.rows[0]?.unresolved || otherDisputes.rows[0]?.lost) return;

  const fullyRefunded = Number(disputeRow.refunded_cents) >= Number(disputeRow.amount_cents);
  if (fullyRefunded) {
    await client.query(
      `UPDATE payments SET status = 'refunded', updated_at = NOW() WHERE id = $1`,
      [disputeRow.payment_id],
    );
    await client.query(
      `UPDATE orders SET status = 'refunded', updated_at = NOW()
       WHERE id = $1 AND status = 'disputed'`,
      [disputeRow.order_id],
    );
    return;
  }

  const paymentStatus = Number(disputeRow.refunded_cents) > 0 ? 'partially_refunded' : 'succeeded';
  await client.query(
    `UPDATE payments SET status = $2, updated_at = NOW() WHERE id = $1`,
    [disputeRow.payment_id, paymentStatus],
  );
  const restored = await client.query(
    `UPDATE orders SET status = 'paid', updated_at = NOW()
     WHERE id = $1 AND status = 'disputed'`,
    [disputeRow.order_id],
  );
  if (restored.rowCount) {
    await client.query(
      `UPDATE entitlements
       SET status = 'active', starts_at = NOW(), expires_at = NULL,
           revoked_at = NULL, revocation_reason = NULL
       WHERE order_id = $1 AND status = 'revoked' AND revocation_reason = 'dispute'`,
      [disputeRow.order_id],
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
      case 'checkout.session.async_payment_failed':
        await updatePendingCheckoutStatus(client, object, 'failed');
        break;
      case 'checkout.session.expired': {
        await updatePendingCheckoutStatus(client, object, 'canceled');
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
      case 'invoice.payment_failed': {
        const subscriptionId = idFrom(object.subscription);
        if (subscriptionId) {
          await client.query(
            `UPDATE subscriptions SET status = 'past_due', updated_at = NOW()
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
      case 'charge.dispute.created':
        await applyDisputeCreated(client, object);
        break;
      case 'charge.dispute.closed':
        await applyDisputeClosed(client, object);
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
