import type { APIRoute } from 'astro';
import { redeemGuestAccessToken } from '../../../lib/guest-access';
import { guestAccessCookie, json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../lib/http';
import { z } from 'astro/zod';

const redeemSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const parsed = redeemSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Der Zugangslink ist ungültig oder abgelaufen.' }, 400);
    const session = await redeemGuestAccessToken(parsed.data.token);
    if (!session) return json({ error: 'Der Zugangslink ist ungültig, abgelaufen oder wurde bereits verwendet.' }, 400);
    guestAccessCookie(context, session.sessionToken);
    return json({ redirectUrl: '/guest-library/' });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    console.error('Gast-Zugangslink konnte nicht eingelöst werden:', error);
    return json({ error: 'Der Zugang konnte gerade nicht geöffnet werden. Bitte fordere einen neuen Link an.' }, 503);
  }
};
