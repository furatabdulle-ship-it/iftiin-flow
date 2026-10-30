import type { APIRoute } from 'astro';
import { completePasswordReset } from '../../../../lib/auth';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { rateLimit } from '../../../../lib/rate-limit';
import { passwordResetConfirmSchema } from '../../../../lib/validation';

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limitError = rateLimit(context, 'password-reset-confirm', 10, 15 * 60 * 1000);
  if (limitError) return limitError;

  try {
    const parsed = passwordResetConfirmSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) {
      return json({ error: 'Der Link ist ungültig oder abgelaufen. Fordere bitte einen neuen an.' }, 400);
    }

    const completed = await completePasswordReset(parsed.data.token, parsed.data.password);
    if (!completed) {
      return json({ error: 'Der Link ist ungültig oder abgelaufen. Fordere bitte einen neuen an.' }, 400);
    }

    return json({ message: 'Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.' });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    console.error('Passwort-Reset konnte nicht abgeschlossen werden:', error);
    return json({ error: 'Das Passwort konnte nicht geändert werden. Bitte versuche es später erneut.' }, 500);
  }
};
