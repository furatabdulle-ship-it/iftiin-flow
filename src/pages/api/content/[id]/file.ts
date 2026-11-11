import type { APIRoute } from 'astro';
import { getSessionAccount } from '../../../../lib/auth';
import { hasGuestContentAccess, hasMemberContentAccess } from '../../../../lib/commerce';
import { query } from '../../../../lib/db';
import { getGuestAccessEmail } from '../../../../lib/guest-access';
import { json } from '../../../../lib/http';
import { createPrivateDownloadUrl } from '../../../../lib/storage';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async (context) => {
  const { id } = context.params;
  if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Inhalts-ID.' }, 400);
  const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
  const guestEmail = await getGuestAccessEmail(context.cookies.get('iftiin_guest_access')?.value);
  if (!account && !guestEmail) return json({ error: 'Bitte öffne deinen persönlichen Zugangslink.' }, 401);

  try {
    const result = await query<{ storage_asset_id: string | null; content_type: string; visibility: 'public' | 'community' }>(
      `SELECT storage_asset_id, content_type, visibility FROM content_items
       WHERE id = $1 AND status = 'published'
         AND content_type IN ('download', 'video')`,
      [id],
    );
    if (result.rows[0]?.visibility === 'community' && !account) {
      return json({ error: 'Bitte melde dich mit einem Community-Konto an.' }, 403);
    }
    const assetId = result.rows[0]?.storage_asset_id;
    if (!assetId) return json({ error: 'Datei nicht gefunden.' }, 404);
    const accountAllowed = Boolean(account && (
      await hasMemberContentAccess(account.id, id, result.rows[0].visibility, account.role)
    ));
    const guestAllowed = Boolean(
      result.rows[0].visibility === 'public' && guestEmail && await hasGuestContentAccess(guestEmail, id),
    );
    if (!accountAllowed && !guestAllowed) {
      return json({ error: 'Für diese Datei besitzt dein Konto keinen Zugriff.' }, 403);
    }
    return new Response(null, {
      status: 302,
      headers: {
        Location: await createPrivateDownloadUrl(assetId, result.rows[0].content_type === 'video'),
        'Cache-Control': 'private, no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    console.error('Privater Dateiabruf konnte nicht erstellt werden:', error);
    return json({ error: 'Die Datei ist derzeit nicht verfügbar.' }, 503);
  }
};
