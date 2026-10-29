import type { APIRoute } from 'astro';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { query } from '../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { contentItemInputSchema } from '../../../../lib/validation';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PUT: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const { id } = context.params;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Inhalts-ID.' }, 400);
    const parsed = contentItemInputSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({
      error: 'Die Inhaltsdaten sind ungültig.',
      details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    }, 400);
    const item = parsed.data;
    if (item.contentType === 'download' && !item.storageAssetId) {
      return json({ error: 'Ein Download benötigt eine private Datei.' }, 400);
    }
    if (item.storageAssetId) {
      const asset = await query<{ status: string }>(
        'SELECT status FROM storage_assets WHERE id = $1',
        [item.storageAssetId],
      );
      if (!asset.rowCount) return json({ error: 'Die ausgewählte Datei wurde nicht gefunden.' }, 404);
      if (item.status === 'published' && asset.rows[0].status !== 'ready') {
        return json({ error: 'Die Datei muss vollständig hochgeladen sein, bevor der Inhalt veröffentlicht wird.' }, 400);
      }
    }
    const updated = await query(
      `UPDATE content_items SET content_type = $2, slug = $3, title = $4,
         description = $5, body = $6, storage_asset_id = $7,
         status = $8, position = $9, updated_at = NOW()
       WHERE id = $1 AND article_id IS NULL
       RETURNING id`,
      [
        id, item.contentType, item.slug, item.title, item.description, item.body,
        item.storageAssetId, item.status, item.position,
      ],
    );
    if (!updated.rowCount) return json({ error: 'Inhalt nicht gefunden oder wird über die Artikelverwaltung verwaltet.' }, 404);
    return json({ success: true });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return json({ error: 'Der Inhalts-Slug ist bereits vergeben.' }, 409);
    }
    console.error('Inhalt konnte nicht aktualisiert werden:', error);
    return json({ error: 'Der Inhalt konnte nicht aktualisiert werden.' }, 500);
  }
};
