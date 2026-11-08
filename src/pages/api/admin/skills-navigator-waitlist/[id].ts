import type { APIRoute } from 'astro';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { deleteWaitlistSignup } from '../../../../lib/skills-navigator-waitlist';
import { json, rejectCrossOriginWrite } from '../../../../lib/http';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DELETE: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const id = context.params.id;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Anmeldung.' }, 400);
    if (!await deleteWaitlistSignup(id)) return json({ error: 'Anmeldung nicht gefunden.' }, 404);
    return json({ success: true });
  } catch (error) {
    console.error('Skills-Navigator-Anmeldung konnte nicht gelöscht werden:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Die Anmeldung konnte nicht gelöscht werden.' }, 500);
  }
};
