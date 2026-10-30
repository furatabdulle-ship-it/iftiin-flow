import type { APIRoute } from 'astro';
import { cancelPasswordReset, issuePasswordReset } from '../../../../lib/auth';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { rateLimit } from '../../../../lib/rate-limit';
import { sendPasswordResetEmail } from '../../../../lib/password-reset-email';
import { passwordResetRequestSchema } from '../../../../lib/validation';

const confirmationMessage = 'Falls die Adresse zu einem Konto gehört, erhältst du in Kürze eine E-Mail mit einem Link zum Zurücksetzen.';

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limitError = rateLimit(context, 'password-reset-request', 5, 15 * 60 * 1000);
  if (limitError) return limitError;
  if (!process.env.RESEND_API_KEY || !process.env.PASSWORD_RESET_FROM) {
    return json({ error: 'Der Passwort-Reset ist derzeit nicht verfügbar.' }, 503);
  }

  try {
    const parsed = passwordResetRequestSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Bitte gib eine gültige E-Mail-Adresse ein.' }, 400);

    const reset = await issuePasswordReset(parsed.data.email);
    if (reset) {
      void sendPasswordResetEmail(reset.email, reset.token).catch(async (error: unknown) => {
        console.error('E-Mail zum Passwort-Reset konnte nicht versendet werden:', error);
        try {
          await cancelPasswordReset(reset.token);
        } catch (cleanupError) {
          console.error('Ungesendeter Passwort-Reset-Token konnte nicht entfernt werden:', cleanupError);
        }
      });
    }

    return json({ message: confirmationMessage });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    console.error('Passwort-Reset-Anfrage fehlgeschlagen:', error);
    return json({ error: 'Die Anfrage ist fehlgeschlagen. Bitte versuche es später erneut.' }, 500);
  }
};
