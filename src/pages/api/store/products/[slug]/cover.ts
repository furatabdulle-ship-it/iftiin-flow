import type { APIRoute } from 'astro';
import { getSessionAccount } from '../../../../../lib/auth';
import { availableProductTypes } from '../../../../../lib/commerce';
import { query } from '../../../../../lib/db';
import { createPrivateDownloadUrl, isAllowedImageAssetType } from '../../../../../lib/storage';

export const GET: APIRoute = async (context) => {
  const { slug } = context.params;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return new Response(null, { status: 404 });
  }

  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    const isAdmin = account?.role === 'admin';
    const result = await query<{ id: string; content_type: string }>(
      `SELECT a.id, a.content_type
       FROM products p
       JOIN LATERAL (
         SELECT active FROM prices
         WHERE product_id = p.id
         ORDER BY active DESC, created_at DESC
         LIMIT 1
       ) pr ON TRUE
       JOIN storage_assets a ON a.id = p.cover_asset_id AND a.status = 'ready'
       WHERE p.slug = $1
         AND a.content_type = ANY($3::text[])
         AND (
           $4::boolean OR (
             p.status = 'active' AND pr.active = TRUE
             AND p.product_type = ANY($2::text[])
             AND NOT EXISTS (
               SELECT 1 FROM product_content pc
               JOIN content_items ci ON ci.id = pc.content_item_id
               WHERE pc.product_id = p.id AND ci.status <> 'published'
             )
           )
         )
       LIMIT 1`,
      [slug, availableProductTypes, ['image/jpeg', 'image/png', 'image/webp'], isAdmin],
    );
    const asset = result.rows[0];
    if (!asset || !isAllowedImageAssetType(asset.content_type)) {
      return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: await createPrivateDownloadUrl(asset.id, true),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Produktcover konnte nicht bereitgestellt werden:', error);
    return new Response(null, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
};
