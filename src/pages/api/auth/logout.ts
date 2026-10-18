import type { APIRoute } from 'astro';
import { deleteSession } from '../../../lib/auth';
import { clearSessionCookie, json, rejectCrossOriginWrite } from '../../../lib/http';

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    await deleteSession(context.cookies.get('iftiin_session')?.value);
    clearSessionCookie(context);
    return json({ success: true });
  } catch (error) {
    console.error('Abmeldung fehlgeschlagen:', error);
    return json({ error: 'Die Abmeldung ist fehlgeschlagen.' }, 500);
  }
};
