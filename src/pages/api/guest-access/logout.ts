import type { APIRoute } from 'astro';
import { revokeGuestAccessSession } from '../../../lib/guest-access';
import { clearGuestAccessCookie, json, rejectCrossOriginWrite } from '../../../lib/http';

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    await revokeGuestAccessSession(context.cookies.get('iftiin_guest_access')?.value);
    clearGuestAccessCookie(context);
    return json({ loggedOut: true });
  } catch (error) {
    console.error('Gast-Zugang konnte nicht abgemeldet werden:', error);
    return json({ error: 'Der Zugang konnte nicht beendet werden. Bitte versuche es erneut.' }, 503);
  }
};
