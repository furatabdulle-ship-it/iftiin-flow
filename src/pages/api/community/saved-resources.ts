import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSessionAccount } from '../../../lib/auth';
import { query } from '../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../lib/http';
import { hasArticleAccess, hasMemberContentAccess } from '../../../lib/commerce';
import { listSavedResources, type SavedResourceType } from '../../../lib/saved-resources';

const resourceSchema = z.object({
  resourceType: z.enum(['article', 'learning']),
  resourceId: z.uuid(),
});

async function validateResourceAccess(
  userId: string,
  role: 'user' | 'admin',
  resourceType: SavedResourceType,
  resourceId: string,
): Promise<Response | null> {
  if (resourceType === 'article') {
    const article = await query<{ id: string; requiresPurchase: boolean }>(
      `SELECT id, requires_purchase AS "requiresPurchase"
       FROM articles
       WHERE id = $1 AND status = 'published'`,
      [resourceId],
    );
    if (!article.rowCount) return json({ error: 'Artikel nicht gefunden.' }, 404);
    if (article.rows[0].requiresPurchase && role !== 'admin' && !(await hasArticleAccess(userId, resourceId))) {
      return json({ error: 'Du hast keinen Zugriff auf diesen Artikel.' }, 403);
    }
    return null;
  }

  const item = await query<{ id: string; visibility: 'public' | 'community' }>(
    `SELECT id, visibility FROM content_items
     WHERE id = $1 AND status = 'published' AND content_type IN ('lesson', 'video', 'download')`,
    [resourceId],
  );
  if (!item.rowCount) return json({ error: 'Lerninhalt nicht gefunden.' }, 404);
  if (!(await hasMemberContentAccess(userId, resourceId, item.rows[0].visibility, role))) {
    return json({ error: 'Du hast keinen Zugriff auf diesen Lerninhalt.' }, 403);
  }
  return null;
}

export const GET: APIRoute = async (context) => {
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);

    const { searchParams } = new URL(context.request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    if (resourceType === null && resourceId === null) {
      return json({ resources: await listSavedResources(account.id, account.role === 'admin') });
    }
    const parsed = resourceSchema.safeParse({ resourceType, resourceId });
    if (!parsed.success) return json({ error: 'Die Ressource ist ungültig.' }, 400);
    const saved = await query(
      `SELECT 1 FROM saved_resources
       WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3`,
      [account.id, parsed.data.resourceType, parsed.data.resourceId],
    );
    return json({ saved: Boolean(saved.rowCount) });
  } catch (error) {
    console.error('Gespeicherte Ressourcen konnten nicht geladen werden:', error);
    return json({ error: 'Gespeicherte Ressourcen konnten nicht geladen werden.' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    const parsed = resourceSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Die Ressource ist ungültig.' }, 400);

    const accessError = await validateResourceAccess(
      account.id,
      account.role,
      parsed.data.resourceType,
      parsed.data.resourceId,
    );
    if (accessError) return accessError;

    await query(
      `INSERT INTO saved_resources (user_id, resource_type, resource_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, resource_type, resource_id) DO NOTHING`,
      [account.id, parsed.data.resourceType, parsed.data.resourceId],
    );
    return json({ saved: true });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Ressource konnte nicht gespeichert werden:', error);
    return json({ error: 'Die Ressource konnte nicht gespeichert werden.' }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    const parsed = resourceSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Die Ressource ist ungültig.' }, 400);

    await query(
      `DELETE FROM saved_resources
       WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3`,
      [account.id, parsed.data.resourceType, parsed.data.resourceId],
    );
    return json({ saved: false });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Ressource konnte nicht entfernt werden:', error);
    return json({ error: 'Die Ressource konnte nicht entfernt werden.' }, 500);
  }
};
