import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { localeHref } from '../../../lib/i18n';
import { json, rejectCrossOriginWrite, requestForm, requestJson, RequestInputError } from '../../../lib/http';
import { rateLimit } from '../../../lib/rate-limit';
import { confirmWaitlistSignup } from '../../../lib/skills-navigator-waitlist';

const tokenSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

function isJsonRequest(request: Request): boolean {
  return request.headers.get('content-type')?.toLowerCase().startsWith('application/json') ?? false;
}

function redirectToResult(context: Parameters<APIRoute>[0], result: 'confirmed' | 'invalid'): Response {
  const path = `${import.meta.env.BASE_URL.replace(/\/$/, '/')}` + `skills-navigator/confirm/?status=${result}`;
  return new Response(null, {
    status: 303,
    headers: { Location: localeHref(path, context.locals.locale), 'Cache-Control': 'no-store' },
  });
}

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limited = rateLimit(context, 'skills-navigator-confirm', 10, 15 * 60_000);
  if (limited) return limited;
  const jsonRequest = isJsonRequest(context.request);

  try {
    const raw = jsonRequest
      ? await requestJson(context.request, 4_096)
      : await requestForm(context.request, 4_096);
    const parsed = tokenSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonRequest ? json({ error: 'Der Bestätigungslink ist ungültig oder abgelaufen.' }, 400) : redirectToResult(context, 'invalid');
    }

    const confirmed = await confirmWaitlistSignup(parsed.data.token);
    if (!confirmed) {
      return jsonRequest ? json({ error: 'Der Bestätigungslink ist ungültig oder abgelaufen.' }, 400) : redirectToResult(context, 'invalid');
    }
    return jsonRequest ? json({ success: true }) : redirectToResult(context, 'confirmed');
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Skills-Navigator-Anmeldung konnte nicht bestätigt werden:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Die Anmeldung konnte nicht bestätigt werden.' }, 500);
  }
};
