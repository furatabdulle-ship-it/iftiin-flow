import type { APIRoute } from 'astro';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { query } from '../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { studioInquiryUpdateSchema } from '../../../../lib/validation';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PATCH: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const id = context.params.id;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Anfrage-ID.' }, 400);

    const parsed = studioInquiryUpdateSchema.safeParse(await requestJson(context.request, 8192));
    if (!parsed.success) return json({ error: 'Bitte prüfe Status, Notizen und Kontaktzeitpunkt.' }, 400);

    const updated = await query(
      `UPDATE studio_inquiries
       SET status = $2, internal_notes = $3, last_contacted_at = $4, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id, parsed.data.status, parsed.data.internalNotes || null, parsed.data.lastContactedAt],
    );
    if (!updated.rowCount) return json({ error: 'Anfrage nicht gefunden.' }, 404);
    return json({ success: true });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Studio-Anfrage konnte nicht aktualisiert werden:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Die Anfrage konnte nicht aktualisiert werden.' }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const id = context.params.id;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Anfrage-ID.' }, 400);
    const deleted = await query('DELETE FROM studio_inquiries WHERE id = $1 RETURNING id', [id]);
    if (!deleted.rowCount) return json({ error: 'Anfrage nicht gefunden.' }, 404);
    return json({ success: true });
  } catch (error) {
    console.error('Studio-Anfrage konnte nicht gelöscht werden:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Die Anfrage konnte nicht gelöscht werden.' }, 500);
  }
};
