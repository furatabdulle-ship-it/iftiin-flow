import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { isHttpResponse, requireAdmin } from '../../../../../lib/admin';
import { query } from '../../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../../lib/http';

const registrationSchema = z.object({
  status: z.enum(['approved', 'rejected', 'revoked']),
}).strict();

export const PATCH: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const id = z.uuid().safeParse(context.params.id);
    if (!id.success) return json({ error: 'Die Anmeldung wurde nicht gefunden.' }, 404);
    const parsed = registrationSchema.safeParse(await requestJson(context.request, 4096));
    if (!parsed.success) return json({ error: 'Der Anmeldestatus ist ungültig.' }, 400);
    const result = await query(
      `UPDATE community_goal_sprint_enrollments
       SET status = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $1
       RETURNING id, status`,
      [id.data, parsed.data.status, admin.id],
    );
    if (!result.rowCount) return json({ error: 'Die Anmeldung wurde nicht gefunden.' }, 404);
    return json({ registration: result.rows[0] });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Ziel-Sprint-Anmeldung konnte nicht bearbeitet werden:', error);
    return json({ error: 'Die Anmeldung konnte nicht bearbeitet werden.' }, 500);
  }
};
