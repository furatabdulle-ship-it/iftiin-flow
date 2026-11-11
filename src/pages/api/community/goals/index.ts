import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSessionAccount } from '../../../../lib/auth';
import { withTransaction } from '../../../../lib/db';
import {
  learningGoalSkillAreas,
  learningGoalStatuses,
  type CommunityLearningGoal,
  listCommunityLearningGoals,
} from '../../../../lib/community-goals';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { listSavedResources } from '../../../../lib/saved-resources';

const goalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000),
  skillArea: z.enum(learningGoalSkillAreas),
  targetDate: z.iso.date().nullable(),
  status: z.enum(learningGoalStatuses).default('Planned'),
}).strict();

export const GET: APIRoute = async (context) => {
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    const [{ goals, links }, savedResources] = await Promise.all([
      listCommunityLearningGoals(account.id),
      listSavedResources(account.id, account.role === 'admin'),
    ]);
    const resourcesByKey = new Map(
      savedResources.map((resource) => [`${resource.resourceType}:${resource.resourceId}`, resource]),
    );
    const response = json({
      goals: goals.map((goal) => ({
        ...goal,
        resources: (links[goal.id] ?? []).map((link) => ({
          ...link,
          savedResource: resourcesByKey.get(`${link.resourceType}:${link.resourceId}`) ?? null,
        })),
      })),
      savedResources,
    });
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  } catch (error) {
    console.error('Persönliche Lernziele konnten nicht geladen werden:', error);
    return json({ error: 'Die Lernziele konnten nicht geladen werden.' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    const parsed = goalSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Bitte überprüfe deine Lernzielangaben.' }, 400);

    const goal = await withTransaction(async (client) => {
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [account.id]);
      if (parsed.data.status !== 'Achieved') {
        const active = await client.query(
          `SELECT 1 FROM community_learning_goals
           WHERE user_id = $1 AND status IN ('Planned', 'In Progress')
           LIMIT 1 OFFSET 2`,
          [account.id],
        );
        if (active.rowCount) throw new ActiveGoalLimitError();
      }
      const result = await client.query<CommunityLearningGoal>(
        `INSERT INTO community_learning_goals
           (user_id, title, description, skill_area, target_date, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, description, skill_area AS "skillArea",
                   target_date AS "targetDate", status,
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [account.id, parsed.data.title, parsed.data.description, parsed.data.skillArea,
          parsed.data.targetDate, parsed.data.status],
      );
      return result.rows[0];
    });
    return json({ goal }, 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    if (error instanceof ActiveGoalLimitError) {
      return json({ error: 'Du kannst höchstens drei aktive Lernziele haben.' }, 409);
    }
    console.error('Persönliches Lernziel konnte nicht erstellt werden:', error);
    return json({ error: 'Das Lernziel konnte nicht erstellt werden.' }, 500);
  }
};

class ActiveGoalLimitError extends Error {}
