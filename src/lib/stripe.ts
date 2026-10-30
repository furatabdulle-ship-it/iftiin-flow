import { randomUUID } from 'node:crypto';
import { withTransaction, query } from './db';
import type { CheckoutProduct } from './commerce';

type StripeCheckoutSession = { id: string; url: string | null };

function getStripeSecret(): string {
  if (process.env.STRIPE_CHECKOUT_ENABLED !== 'true') {
    throw new Error('Stripe-Checkout ist nicht aktiviert.');
  }
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error('Stripe ist nicht konfiguriert.');
  if (secret.startsWith('sk_live_') && process.env.STRIPE_LIVE_MODE_ENABLED !== 'true') {
    throw new Error('Live-Zahlungen sind nicht explizit freigegeben.');
  }
  if (!secret.startsWith('sk_test_') && !secret.startsWith('sk_live_')) {
    throw new Error('Der Stripe-Schlüssel hat ein ungültiges Format.');
  }
  return secret;
}

export function isCheckoutConfigured(): boolean {
  const secret = process.env.STRIPE_SECRET_KEY;
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) return false;
  try {
    const origin = new URL(siteUrl);
    if (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') return false;
  } catch {
    return false;
  }
  return process.env.STRIPE_CHECKOUT_ENABLED === 'true'
    && Boolean(process.env.STRIPE_WEBHOOK_SECRET)
    && typeof secret === 'string'
    && (secret.startsWith('sk_test_') || (
      secret.startsWith('sk_live_') && process.env.STRIPE_LIVE_MODE_ENABLED === 'true'
    ));
}

async function stripeRequest<T>(path: string, body: URLSearchParams): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getStripeSecret()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json() as { error?: { message?: string } } & T;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? 'Stripe konnte die Anfrage nicht verarbeiten.');
  }
  return payload;
}

export async function createCheckoutSession(
  userId: string,
  email: string,
  product: CheckoutProduct,
): Promise<{ checkoutUrl: string }> {
  if (!Number.isSafeInteger(product.amountCents) || product.amountCents < 50) {
    throw new Error('Für den Checkout ist ein aktiver Preis von mindestens 0,50 € erforderlich.');
  }
  if (product.currency !== 'eur') {
    throw new Error('Der Checkout ist derzeit nur für Europreise konfiguriert.');
  }
  if (product.billingInterval !== 'one_time' && product.productType !== 'membership') {
    throw new Error('Wiederkehrende Preise sind nur für Membership-Produkte zulässig.');
  }
  const siteUrl = process.env.SITE_URL;
  if (!siteUrl) throw new Error('SITE_URL ist nicht konfiguriert.');
  const origin = new URL(siteUrl);
  if (origin.protocol !== 'https:' && process.env.NODE_ENV === 'production') {
    throw new Error('Checkout erfordert eine HTTPS-SITE_URL.');
  }

  const orderId = randomUUID();
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO orders (id, user_id, status, currency, subtotal_cents, total_cents)
       VALUES ($1, $2, 'pending', $3, $4, $4)`,
      [orderId, userId, product.currency, product.amountCents],
    );
    const item = await client.query<{ id: string }>(
      `INSERT INTO order_items
       (order_id, product_id, price_id, product_name, quantity, unit_amount_cents, currency)
       VALUES ($1, $2, $3, $4, 1, $5, $6)
       RETURNING id`,
      [orderId, product.id, product.priceId, product.name, product.amountCents, product.currency],
    );
    await client.query(
      `INSERT INTO order_item_content (order_item_id, content_item_id)
       SELECT $1, content_item_id FROM product_content WHERE product_id = $2`,
      [item.rows[0].id, product.id],
    );
  });

  const form = new URLSearchParams();
  form.set('mode', product.billingInterval === 'one_time' ? 'payment' : 'subscription');
  form.set('success_url', new URL('/account/?checkout=success', origin).toString());
  form.set('cancel_url', new URL('/store/?checkout=cancelled', origin).toString());
  form.set('customer_email', email);
  form.set('client_reference_id', orderId);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', product.currency);
  form.set('line_items[0][price_data][unit_amount]', String(product.amountCents));
  form.set('line_items[0][price_data][product_data][name]', product.name);
  form.set('line_items[0][price_data][product_data][metadata][product_id]', product.id);
  form.set('metadata[order_id]', orderId);
  form.set('metadata[user_id]', userId);
  form.set('metadata[product_id]', product.id);
  if (product.billingInterval !== 'one_time') {
    form.set('line_items[0][price_data][recurring][interval]', product.billingInterval);
    form.set('subscription_data[metadata][order_id]', orderId);
    form.set('subscription_data[metadata][user_id]', userId);
    form.set('subscription_data[metadata][product_id]', product.id);
  } else {
    form.set('payment_intent_data[metadata][order_id]', orderId);
  }

  try {
    const session = await stripeRequest<StripeCheckoutSession>('checkout/sessions', form);
    if (!session.url || !session.url.startsWith('https://checkout.stripe.com/')) {
      throw new Error('Stripe hat keine gültige Checkout-Adresse zurückgegeben.');
    }
    await query(
      `UPDATE orders SET stripe_checkout_session_id = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [orderId, session.id],
    );
    return { checkoutUrl: session.url };
  } catch (error) {
    await query(
      `UPDATE orders SET status = 'failed', updated_at = NOW()
       WHERE id = $1 AND status = 'pending'`,
      [orderId],
    );
    throw error;
  }
}
