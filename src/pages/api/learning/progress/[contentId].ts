import type { APIRoute } from 'astro';
import { getSessionAccount } from '../../../../lib/auth';
import { hasContentAccess } from '../../../../lib/commerce';
import { query } from '../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { learningProgressSchema } from '../../../../lib/validation';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PUT: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    const { contentId } = context.params;
    if (!contentId || !uuidPattern.test(contentId)) return json({ error: 'Ungültige Inhalts-ID.' }, 400);
    const parsed = learningProgressSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Der Lernfortschritt ist ungültig.' }, 400);
    const item = await query<{ id: string }>(
      `SELECT id FROM content_items
       WHERE id = $1 AND status = 'published' AND content_type IN ('lesson', 'video')`,
      [contentId],
    );
    if (!item.rowCount) return json({ error: 'Lektion nicht gefunden.' }, 404);
    if (account.role !== 'admin' && !(await hasContentAccess(account.id, contentId))) {
      return json({ error: 'Für diese Lektion besitzt dein Konto keinen Zugriff.' }, 403);
    }

    await query(
      `INSERT INTO learning_progress
       (user_id, content_item_id, progress_percent, completed_at, last_position_seconds)
       VALUES ($1, $2, $3, CASE WHEN $3 = 100 THEN NOW() ELSE NULL END, $4)
       ON CONFLICT (user_id, content_item_id) DO UPDATE SET
         progress_percent = GREATEST(learning_progress.progress_percent, EXCLUDED.progress_percent),
         completed_at = CASE
           WHEN GREATEST(learning_progress.progress_percent, EXCLUDED.progress_percent) = 100
           THEN COALESCE(learning_progress.completed_at, NOW())
           ELSE NULL
         END,
         last_position_seconds = EXCLUDED.last_position_seconds,
         updated_at = NOW()`,
      [
        account.id,
        contentId,
        parsed.data.progressPercent,
        parsed.data.lastPositionSeconds,
      ],
    );
    return json({ success: true });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    console.error('Lernfortschritt konnte nicht gespeichert werden:', error);
    return json({ error: 'Der Lernfortschritt konnte nicht gespeichert werden.' }, 500);
  }
};
