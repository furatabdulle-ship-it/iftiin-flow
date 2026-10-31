import type { APIRoute } from 'astro';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { withTransaction } from '../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { deleteUnreferencedAssetObject } from '../../../../lib/storage';
import { contentItemInputSchema } from '../../../../lib/validation';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DELETE: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const { id } = context.params;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Inhalts-ID.' }, 400);

    const deletion = await withTransaction(async (client) => {
      const selected = await client.query<{
        id: string;
        title: string;
        article_id: string | null;
        storage_asset_id: string | null;
      }>(
        `SELECT id, title, article_id, storage_asset_id
         FROM content_items WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const item = selected.rows[0];
      if (!item) return { error: 'not-found' as const };
      if (item.article_id) return { error: 'article-managed-elsewhere' as const };

      const linkedProducts = await client.query<{ name: string }>(
        `SELECT p.name FROM product_content pc
         JOIN products p ON p.id = pc.product_id
         WHERE pc.content_item_id = $1
         ORDER BY p.name`,
        [id],
      );
      if (linkedProducts.rowCount) {
        return { error: 'linked-products' as const, products: linkedProducts.rows.map(({ name }) => name) };
      }

      const historicalAccess = await client.query<{ has_access: boolean }>(
        `SELECT (
           EXISTS (SELECT 1 FROM order_item_content WHERE content_item_id = $1)
           OR EXISTS (SELECT 1 FROM entitlement_content WHERE content_item_id = $1)
           OR EXISTS (SELECT 1 FROM learning_progress WHERE content_item_id = $1)
         ) AS has_access`,
        [id],
      );
      if (historicalAccess.rows[0]?.has_access) return { error: 'historical-access' as const };

      let cleanupAsset: { id: string; object_key: string } | null = null;
      if (item.storage_asset_id) {
        const asset = await client.query<{ id: string; object_key: string }>(
          `SELECT id, object_key FROM storage_assets
           WHERE id = $1 AND status = 'ready' FOR UPDATE`,
          [item.storage_asset_id],
        );
        if (asset.rows[0]) {
          const references = await client.query<{ referenced: boolean }>(
            `SELECT (
               EXISTS (SELECT 1 FROM content_items WHERE storage_asset_id = $1 AND id <> $2)
               OR EXISTS (SELECT 1 FROM products WHERE cover_asset_id = $1)
             ) AS referenced`,
            [item.storage_asset_id, id],
          );
          if (!references.rows[0]?.referenced) {
            await client.query(
              `UPDATE storage_assets SET status = 'deleted', updated_at = NOW()
               WHERE id = $1`,
              [item.storage_asset_id],
            );
            cleanupAsset = asset.rows[0];
          }
        }
      }

      await client.query('DELETE FROM content_items WHERE id = $1', [id]);
      return { title: item.title, cleanupAsset };
    });

    if ('error' in deletion) {
      if (deletion.error === 'not-found') return json({ error: 'Inhalt nicht gefunden.' }, 404);
      if (deletion.error === 'article-managed-elsewhere') {
        return json({ error: 'Dieser Artikel wird über die Artikelverwaltung verwaltet.' }, 409);
      }
      if (deletion.error === 'linked-products') {
        return json({
          error: 'Der Inhalt kann noch nicht gelöscht werden. Entferne zuerst die Zuordnung zu diesen Produkten.',
          products: deletion.products,
        }, 409);
      }
      return json({
        error: 'Der Inhalt wird noch für frühere Käufe, Zugänge oder Lernfortschritte benötigt und kann deshalb nicht gelöscht werden.',
      }, 409);
    }

    let cleanupWarning: string | undefined;
    if (deletion.cleanupAsset) {
      try {
        await deleteUnreferencedAssetObject(deletion.cleanupAsset.id, deletion.cleanupAsset.object_key);
      } catch (error) {
        console.error('Nicht mehr referenzierte Inhaltsdatei konnte nicht bereinigt werden:', {
          name: error instanceof Error ? error.name : 'UnknownError',
        });
        cleanupWarning = 'Der Inhalt wurde gelöscht, aber die zugehörige Datei konnte nicht bereinigt werden.';
      }
    }
    return json({ success: true, title: deletion.title, ...(cleanupWarning ? { warning: cleanupWarning } : {}) });
  } catch (error) {
    console.error('Inhalt konnte nicht gelöscht werden:', error);
    return json({ error: 'Der Inhalt konnte nicht gelöscht werden.' }, 500);
  }
};

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
    const updated = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT id FROM content_items WHERE id = $1 AND article_id IS NULL FOR UPDATE',
        [id],
      );
      if (!current.rowCount) return { error: 'not-found' as const };
      if (item.storageAssetId) {
        const asset = await client.query<{ status: string }>(
          'SELECT status FROM storage_assets WHERE id = $1 FOR UPDATE',
          [item.storageAssetId],
        );
        if (!asset.rowCount) return { error: 'missing-file' as const };
        if (asset.rows[0].status !== 'ready') return { error: 'file-not-ready' as const };
      }
      await client.query(
        `UPDATE content_items SET content_type = $2, slug = $3, title = $4, title_en = $5,
           description = $6, description_en = $7, body = $8, body_en = $9,
           storage_asset_id = $10, status = $11, position = $12, updated_at = NOW()
         WHERE id = $1`,
        [
          id, item.contentType, item.slug, item.title, item.titleEn, item.description,
          item.descriptionEn, item.body, item.bodyEn, item.storageAssetId, item.status,
          item.position,
        ],
      );
      return { success: true as const };
    });
    if ('error' in updated) {
      if (updated.error === 'not-found') return json({ error: 'Inhalt nicht gefunden oder wird über die Artikelverwaltung verwaltet.' }, 404);
      if (updated.error === 'missing-file') return json({ error: 'Die ausgewählte Datei wurde nicht gefunden.' }, 404);
      return json({ error: 'Die Datei muss vollständig hochgeladen sein, bevor sie verknüpft wird.' }, 400);
    }
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
