import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSessionAccount } from '../../../../lib/auth';
import { withTransaction } from '../../../../lib/db';
import {
  learningGoalSkillAreas,
  learningGoalStatuses,
  type CommunityLearningGoal,
} from '../../../../lib/community-goals';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';

const idSchema = z.uuid();
const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  skillArea: z.enum(learningGoalSkillAreas).optional(),
  targetDate: z.iso.date().nullable().optional(),
  status: z.enum(learningGoalStatuses).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

export const PATCH: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    const id = idSchema.safeParse(context.params.id);
    if (!id.success) return json({ error: 'Das Lernziel wurde nicht gefunden.' }, 404);
    const parsed = patchSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Bitte überprüfe deine Lernzielangaben.' }, 400);

    const goal = await withTransaction(async (client) => {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [account.id]);
      const current = await client.query<{ status: string }>(
        'SELECT status FROM community_learning_goals WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id.data, account.id],
      );
      if (!current.rowCount) return null;
      if (parsed.data.status && parsed.data.status !== 'Achieved' && current.rows[0].status === 'Achieved') {
        const active = await client.query(
          `SELECT 1 FROM community_learning_goals
           WHERE user_id = $1 AND status IN ('Planned', 'In Progress')
           LIMIT 1 OFFSET 2`,
          [account.id],
        );
        if (active.rowCount) throw new ActiveGoalLimitError();
      }

      const fields: Array<[string, string | null | undefined]> = [
        ['title', parsed.data.title],
        ['description', parsed.data.description],
        ['skill_area', parsed.data.skillArea],
        ['target_date', parsed.data.targetDate],
        ['status', parsed.data.status],
      ].filter((field): field is [string, string | null] => field[1] !== undefined);
      const values: unknown[] = [id.data, account.id];
      const assignments = fields.map(([column, value]) => {
        values.push(value);
        return `${column} = $${values.length}`;
      });
      assignments.push('updated_at = NOW()');
      const result = await client.query<CommunityLearningGoal>(
        `UPDATE community_learning_goals SET ${assignments.join(', ')}
         WHERE id = $1 AND user_id = $2
         RETURNING id, title, description, skill_area AS "skillArea",
                   target_date AS "targetDate", status,
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        values,
      );
      return result.rows[0] ?? null;
    });
    if (!goal) return json({ error: 'Das Lernziel wurde nicht gefunden.' }, 404);
    return json({ goal });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    if (error instanceof ActiveGoalLimitError) {
      return json({ error: 'Du kannst höchstens drei aktive Lernziele haben.' }, 409);
    }
    console.error('Persönliches Lernziel konnte nicht aktualisiert werden:', error);
    return json({ error: 'Das Lernziel konnte nicht gespeichert werden.' }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    const id = idSchema.safeParse(context.params.id);
    if (!id.success) return json({ error: 'Das Lernziel wurde nicht gefunden.' }, 404);
    const deleted = await withTransaction(async (client) => {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [account.id]);
      const result = await client.query(
        'DELETE FROM community_learning_goals WHERE id = $1 AND user_id = $2 RETURNING id',
        [id.data, account.id],
      );
      return Boolean(result.rowCount);
    });
    if (!deleted) return json({ error: 'Das Lernziel wurde nicht gefunden.' }, 404);
    return json({ deleted: true });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Persönliches Lernziel konnte nicht gelöscht werden:', error);
    return json({ error: 'Das Lernziel konnte nicht gelöscht werden.' }, 500);
  }
};

class ActiveGoalLimitError extends Error {}
