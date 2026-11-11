import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { query } from '../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';

const sprintSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000),
  status: z.enum(['draft', 'open', 'closed']),
  startsOn: z.iso.date().nullable(),
  endsOn: z.iso.date().nullable(),
}).strict().refine(
  ({ startsOn, endsOn }) => !startsOn || !endsOn || endsOn >= startsOn,
  { message: 'Das Enddatum muss am oder nach dem Startdatum liegen.' },
);

export const PATCH: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const id = z.uuid().safeParse(context.params.id);
    if (!id.success) return json({ error: 'Der Ziel-Sprint wurde nicht gefunden.' }, 404);
    const parsed = sprintSchema.safeParse(await requestJson(context.request, 12_288));
    if (!parsed.success) return json({ error: 'Bitte überprüfe Titel, Beschreibung und Laufzeit.' }, 400);
    const result = await query(
      `UPDATE goal_sprints
       SET title = $2, description = $3, status = $4, starts_on = $5, ends_on = $6, updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, description, status, starts_on AS "startsOn", ends_on AS "endsOn"`,
      [id.data, parsed.data.title, parsed.data.description, parsed.data.status,
        parsed.data.startsOn, parsed.data.endsOn],
    );
    if (!result.rowCount) return json({ error: 'Der Ziel-Sprint wurde nicht gefunden.' }, 404);
    return json({ sprint: result.rows[0] });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Ziel-Sprint konnte nicht aktualisiert werden:', error);
    return json({ error: 'Der Ziel-Sprint konnte nicht aktualisiert werden.' }, 500);
  }
};
