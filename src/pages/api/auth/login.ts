import type { APIRoute } from 'astro';
import { authenticateAccount, createSession } from '../../../lib/auth';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError, sessionCookie } from '../../../lib/http';
import { clearRateLimit, rateLimit } from '../../../lib/rate-limit';
import { credentialsSchema } from '../../../lib/validation';

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limitError = rateLimit(context, 'login', 10, 15 * 60 * 1000);
  if (limitError) return limitError;

  try {
    const parsed = credentialsSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'E-Mail-Adresse oder Passwort ist ungültig.' }, 400);

    const account = await authenticateAccount(parsed.data.email, parsed.data.password);
    if (!account) return json({ error: 'E-Mail-Adresse oder Passwort ist falsch.' }, 401);

    const token = await createSession(account.id);
    clearRateLimit(context, 'login');
    sessionCookie(context, token);
    return json({ account: { id: account.id, email: account.email, role: account.role } });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    console.error('Anmeldung fehlgeschlagen:', error);
    return json({ error: 'Die Anmeldung ist fehlgeschlagen. Bitte versuche es später erneut.' }, 500);
  }
};
