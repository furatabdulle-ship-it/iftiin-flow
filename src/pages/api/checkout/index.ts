import type { APIRoute } from 'astro';
import { getSessionAccount } from '../../../lib/auth';
import { getCheckoutProduct } from '../../../lib/commerce';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../lib/http';
import { rateLimit } from '../../../lib/rate-limit';
import { createCheckoutSession } from '../../../lib/stripe';
import { z } from 'astro/zod';
import { isGuestAccessEmailConfigured } from '../../../lib/password-reset-email';
import { t } from '../../../lib/i18n';

const checkoutSchema = z.object({
  productId: z.uuid(),
  priceId: z.uuid(),
  email: z.string().trim().max(254).pipe(z.email()).transform((email) => email.toLowerCase()).optional(),
});

export const POST: APIRoute = async (context) => {
  const copy = (key: Parameters<typeof t>[1]) => t(context.locals.locale, key);
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limited = rateLimit(context, 'checkout', 10, 60_000);
  if (limited) return limited;

  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    const parsed = checkoutSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: copy('store.checkoutInvalid') }, 400);
    const email = account?.email ?? parsed.data.email;
    if (!email) return json({ error: copy('store.checkoutEmailRequired') }, 400);
    if (!account && !isGuestAccessEmailConfigured()) {
      return json({ error: copy('store.guestAccessUnavailable') }, 503);
    }
    const product = await getCheckoutProduct(parsed.data.productId, parsed.data.priceId);
    if (!product) return json({ error: copy('store.productUnavailable') }, 404);
    const result = await createCheckoutSession(account?.id ?? null, email, product, context.locals.locale);
    return json(result);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: copy('store.checkoutStartFailed') }, 400);
    console.error('Checkout konnte nicht gestartet werden:', error);
    const message = error instanceof Error && error.message.includes('nicht aktiviert')
      ? copy('store.secureCheckoutUnavailable')
      : copy('store.checkoutStartFailed');
    return json({ error: message }, 503);
  }
};
