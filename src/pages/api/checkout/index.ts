import type { APIRoute } from 'astro';
import { getSessionAccount } from '../../../lib/auth';
import { getCheckoutProduct } from '../../../lib/commerce';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../lib/http';
import { rateLimit } from '../../../lib/rate-limit';
import { createCheckoutSession } from '../../../lib/stripe';
import { z } from 'astro/zod';
import { isGuestAccessEmailConfigured } from '../../../lib/password-reset-email';

const checkoutSchema = z.object({
  productId: z.uuid(),
  priceId: z.uuid(),
  email: z.string().trim().max(254).pipe(z.email()).transform((email) => email.toLowerCase()).optional(),
});

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limited = rateLimit(context, 'checkout', 10, 60_000);
  if (limited) return limited;

  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    const parsed = checkoutSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Das ausgewählte Produkt ist ungültig.' }, 400);
    const email = account?.email ?? parsed.data.email;
    if (!email) return json({ error: 'Bitte gib deine E-Mail-Adresse für den sicheren Zugang ein.' }, 400);
    if (!account && !isGuestAccessEmailConfigured()) {
      return json({ error: 'Der konto-freie Zugang ist derzeit nicht verfügbar. Bitte versuche es später erneut.' }, 503);
    }
    const product = await getCheckoutProduct(parsed.data.productId, parsed.data.priceId);
    if (!product) return json({ error: 'Dieses Produkt ist derzeit nicht verfügbar.' }, 404);
    const result = await createCheckoutSession(account?.id ?? null, email, product);
    return json(result);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    console.error('Checkout konnte nicht gestartet werden:', error);
    const message = error instanceof Error && error.message.includes('nicht aktiviert')
      ? 'Der sichere Checkout ist noch nicht eingerichtet. Bitte versuche es später erneut.'
      : 'Der Checkout konnte nicht gestartet werden. Bitte versuche es später erneut.';
    return json({ error: message }, 503);
  }
};
