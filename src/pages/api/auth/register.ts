import type { APIRoute } from 'astro';
import { createSession, registerAccount } from '../../../lib/auth';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError, sessionCookie } from '../../../lib/http';
import { rateLimit } from '../../../lib/rate-limit';
import { credentialsSchema } from '../../../lib/validation';

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limitError = rateLimit(context, 'register', 5, 60 * 60 * 1000);
  if (limitError) return limitError;

  try {
    const parsed = credentialsSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) {
      return json({ error: 'Bitte gib eine gültige E-Mail-Adresse und ein Passwort mit mindestens 12 Zeichen ein.' }, 400);
    }

    const account = await registerAccount(parsed.data.email, parsed.data.password);
    const token = await createSession(account.id);
    sessionCookie(context, token);
    return json({ account: { id: account.id, email: account.email, role: account.role } }, 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return json({ error: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.' }, 409);
    }
    console.error('Registrierung fehlgeschlagen:', error);
    return json({ error: 'Die Registrierung ist fehlgeschlagen. Bitte versuche es später erneut.' }, 500);
  }
};
