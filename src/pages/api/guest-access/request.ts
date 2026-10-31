import type { APIRoute } from 'astro';
import { discardGuestAccessToken, hasGuestOrders, sendGuestAccessToken } from '../../../lib/guest-access';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../lib/http';
import { sendGuestAccessEmail } from '../../../lib/password-reset-email';
import { rateLimit } from '../../../lib/rate-limit';
import { z } from 'astro/zod';
import { t } from '../../../lib/i18n';

const requestSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform((email) => email.toLowerCase()),
});
export const POST: APIRoute = async (context) => {
  const confirmationMessage = t(context.locals.locale, 'guest.accessLinkSent');
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limited = rateLimit(context, 'guest-access-request', 5, 15 * 60_000);
  if (limited) return limited;

  try {
    const parsed = requestSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' }, 400);
    if (!(await hasGuestOrders(parsed.data.email))) return json({ message: confirmationMessage });

    const token = await sendGuestAccessToken(parsed.data.email);
    if (token) {
      try {
        await sendGuestAccessEmail(parsed.data.email, token, context.locals.locale);
      } catch (error) {
        await discardGuestAccessToken(token);
        throw error;
      }
    }
    return json({ message: confirmationMessage });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    console.error('Gast-Zugangslink konnte nicht versendet werden:', error);
    return json({ error: 'Der Zugangslink konnte gerade nicht versendet werden. Bitte versuche es später erneut.' }, 503);
  }
};
