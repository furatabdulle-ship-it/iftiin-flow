import type { APIRoute } from 'astro';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { query, withTransaction } from '../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { contentItemInputSchema } from '../../../../lib/validation';

export const GET: APIRoute = async (context) => {
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const result = await query(
      `SELECT ci.id, ci.content_type AS "contentType", ci.slug, ci.title, ci.description,
              ci.body, ci.article_id AS "articleId", ci.storage_asset_id AS "storageAssetId",
              sa.original_filename AS "originalFilename",
              ci.status, ci.position
       FROM content_items ci
       LEFT JOIN storage_assets sa ON sa.id = ci.storage_asset_id
       ORDER BY ci.content_type, ci.position, ci.title`,
    );
    return json({ content: result.rows });
  } catch (error) {
    console.error('Inhalte konnten nicht geladen werden:', error);
    return json({ error: 'Inhalte konnten nicht geladen werden.' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const parsed = contentItemInputSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({
      error: 'Die Inhaltsdaten sind ungültig.',
      details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    }, 400);
    const item = parsed.data;
    if (item.contentType === 'download' && !item.storageAssetId) {
      return json({ error: 'Ein Download benötigt eine private Datei.' }, 400);
    }

    const result = await withTransaction(async (client) => {
      if (item.storageAssetId) {
        const asset = await client.query<{ status: string }>(
          'SELECT status FROM storage_assets WHERE id = $1 FOR UPDATE',
          [item.storageAssetId],
        );
        if (!asset.rowCount) return { error: 'missing-file' as const };
        if (asset.rows[0].status !== 'ready') return { error: 'file-not-ready' as const };
      }
      const created = await client.query<{ id: string }>(
        `INSERT INTO content_items
         (content_type, slug, title, description, body, storage_asset_id, status, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          item.contentType, item.slug, item.title, item.description, item.body,
          item.storageAssetId, item.status, item.position,
        ],
      );
      return { id: created.rows[0].id };
    });
    if ('error' in result) {
      if (result.error === 'missing-file') return json({ error: 'Die ausgewählte Datei wurde nicht gefunden.' }, 404);
      return json({ error: 'Die Datei muss vollständig hochgeladen sein, bevor sie verknüpft wird.' }, 400);
    }
    return json({ id: result.id }, 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return json({ error: 'Der Inhalts-Slug ist bereits vergeben.' }, 409);
    }
    console.error('Inhalt konnte nicht erstellt werden:', error);
    return json({ error: 'Der Inhalt konnte nicht erstellt werden.' }, 500);
  }
};
