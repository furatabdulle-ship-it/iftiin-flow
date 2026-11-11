import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSessionAccount } from '../../../../../lib/auth';
import { withTransaction } from '../../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../../lib/http';

const idSchema = z.uuid();
const resourceSchema = z.object({
  resourceType: z.enum(['article', 'learning']),
  resourceId: z.uuid(),
}).strict();

async function updateLink(context: Parameters<APIRoute>[0], remove: boolean): Promise<Response> {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    const id = idSchema.safeParse(context.params.id);
    if (!id.success) return json({ error: 'Das Lernziel wurde nicht gefunden.' }, 404);
    const parsed = resourceSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Die gespeicherte Ressource ist ungültig.' }, 400);

    const result = await withTransaction(async (client) => {
      const goal = await client.query(
        'SELECT 1 FROM community_learning_goals WHERE id = $1 AND user_id = $2',
        [id.data, account.id],
      );
      if (!goal.rowCount) return 'goal-missing';
      if (remove) {
        await client.query(
          `DELETE FROM community_learning_goal_resources
           WHERE user_id = $1 AND goal_id = $2 AND resource_type = $3 AND resource_id = $4`,
          [account.id, id.data, parsed.data.resourceType, parsed.data.resourceId],
        );
        return 'ok';
      }

      const saved = await client.query(
        `SELECT 1 FROM saved_resources
         WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3`,
        [account.id, parsed.data.resourceType, parsed.data.resourceId],
      );
      if (!saved.rowCount) return 'resource-missing';
      await client.query(
        `INSERT INTO community_learning_goal_resources (user_id, goal_id, resource_type, resource_id)
         VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
        [account.id, id.data, parsed.data.resourceType, parsed.data.resourceId],
      );
      return 'ok';
    });
    if (result === 'goal-missing') return json({ error: 'Das Lernziel wurde nicht gefunden.' }, 404);
    if (result === 'resource-missing') return json({ error: 'Die Ressource ist nicht in deinen gespeicherten Ressourcen.' }, 404);
    return json({ linked: !remove });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Gespeicherte Ressource konnte nicht verknüpft werden:', error);
    return json({ error: 'Die Ressource konnte nicht verknüpft werden.' }, 500);
  }
}

export const POST: APIRoute = (context) => updateLink(context, false);
export const DELETE: APIRoute = (context) => updateLink(context, true);
