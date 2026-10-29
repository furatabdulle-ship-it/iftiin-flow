import type { APIRoute } from 'astro';
import { json } from '../../../lib/http';
import { processStripeWebhook, verifyStripeSignature } from '../../../lib/stripe-webhook';

export const POST: APIRoute = async (context) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'Stripe-Webhook ist nicht konfiguriert.' }, 503);
  }
  try {
    const payload = await context.request.text();
    if (payload.length > 1_000_000) return json({ error: 'Webhook-Anfrage ist zu groß.' }, 413);
    if (!verifyStripeSignature(payload, context.request.headers.get('stripe-signature'))) {
      return json({ error: 'Ungültige Stripe-Signatur.' }, 400);
    }
    const result = await processStripeWebhook(payload);
    return json({ received: true, duplicate: result === 'duplicate' });
  } catch (error) {
    console.error('Stripe-Webhook konnte nicht verarbeitet werden:', error);
    return json({ error: 'Stripe-Webhook konnte nicht verarbeitet werden.' }, 500);
  }
};
