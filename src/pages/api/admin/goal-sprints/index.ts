import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { query } from '../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';

const sprintSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).default(''),
  status: z.enum(['draft', 'open', 'closed']).default('draft'),
  startsOn: z.iso.date().nullable().default(null),
  endsOn: z.iso.date().nullable().default(null),
}).strict().refine(
  ({ startsOn, endsOn }) => !startsOn || !endsOn || endsOn >= startsOn,
  { message: 'Das Enddatum muss am oder nach dem Startdatum liegen.' },
);

export const GET: APIRoute = async (context) => {
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const result = await query(
      `SELECT sprint.id, sprint.title, sprint.description, sprint.status,
              sprint.starts_on AS "startsOn", sprint.ends_on AS "endsOn",
              sprint.created_at AS "createdAt",
              COALESCE(
                json_agg(json_build_object(
                  'id', enrollment.id,
                  'displayName', COALESCE(NULLIF(users.display_name, ''), 'Community member'),
                  'email', users.email,
                  'motivation', enrollment.motivation,
                  'status', enrollment.status,
                  'requestedAt', enrollment.requested_at
                ) ORDER BY enrollment.requested_at DESC)
                FILTER (WHERE enrollment.id IS NOT NULL),
                '[]'::json
              ) AS enrollments
       FROM goal_sprints sprint
       LEFT JOIN community_goal_sprint_enrollments enrollment ON enrollment.sprint_id = sprint.id
       LEFT JOIN users ON users.id = enrollment.user_id
       GROUP BY sprint.id
       ORDER BY sprint.created_at DESC`,
    );
    return json({ sprints: result.rows });
  } catch (error) {
    console.error('Ziel-Sprints konnten nicht geladen werden:', error);
    return json({ error: 'Ziel-Sprints konnten nicht geladen werden.' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const parsed = sprintSchema.safeParse(await requestJson(context.request, 12_288));
    if (!parsed.success) return json({ error: 'Bitte überprüfe Titel, Beschreibung und Laufzeit.' }, 400);
    const result = await query(
      `INSERT INTO goal_sprints (title, description, status, starts_on, ends_on, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, status, starts_on AS "startsOn", ends_on AS "endsOn"`,
      [parsed.data.title, parsed.data.description, parsed.data.status,
        parsed.data.startsOn, parsed.data.endsOn, admin.id],
    );
    return json({ sprint: result.rows[0] }, 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Ziel-Sprint konnte nicht angelegt werden:', error);
    return json({ error: 'Der Ziel-Sprint konnte nicht angelegt werden.' }, 500);
  }
};
