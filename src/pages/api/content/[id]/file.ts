import type { APIRoute } from 'astro';
import { getSessionAccount } from '../../../../lib/auth';
import { hasContentAccess } from '../../../../lib/commerce';
import { query } from '../../../../lib/db';
import { json } from '../../../../lib/http';
import { createPrivateDownloadUrl } from '../../../../lib/storage';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Inhalts-ID.' }, 400);
  const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
  if (!account) return json({ error: 'Bitte melde dich an.' }, 401);

  try {
    const result = await query<{ storage_asset_id: string | null; content_type: string }>(
      `SELECT storage_asset_id, content_type FROM content_items
       WHERE id = $1 AND status = 'published'
         AND content_type IN ('download', 'video')`,
      [id],
    );
    const assetId = result.rows[0]?.storage_asset_id;
    if (!assetId) return json({ error: 'Datei nicht gefunden.' }, 404);
    if (account.role !== 'admin' && !(await hasContentAccess(account.id, id))) {
      return json({ error: 'Für diese Datei besitzt dein Konto keinen Zugriff.' }, 403);
    }
    return Response.redirect(
      await createPrivateDownloadUrl(assetId, result.rows[0].content_type === 'video'),
      302,
    );
  } catch (error) {
    console.error('Privater Dateiabruf konnte nicht erstellt werden:', error);
    return json({ error: 'Die Datei ist derzeit nicht verfügbar.' }, 503);
  }
};
