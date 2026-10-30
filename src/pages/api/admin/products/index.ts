import type { APIRoute } from 'astro';
import { listAdminProducts } from '../../../../lib/commerce';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { withTransaction } from '../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import {
  lockProductReferences,
  validateProductContentLinks,
  validateProductCoverAsset,
} from '../../../../lib/product-validation';
import { productInputSchema } from '../../../../lib/validation';

class ProductReferenceChangedError extends Error {}

export const GET: APIRoute = async (context) => {
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    return json({ products: await listAdminProducts() });
  } catch (error) {
    console.error('Produkte konnten nicht geladen werden:', error);
    return json({ error: 'Produkte konnten nicht geladen werden.' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const parsed = productInputSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({
      error: 'Die Produktdaten sind ungültig.',
      details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    }, 400);
    const product = parsed.data;
    const coverError = await validateProductCoverAsset(product.coverAssetId);
    if (coverError) return coverError;
    const contentError = await validateProductContentLinks(
      product.contentIds,
      product.productType,
      product.status === 'active',
    );
    if (contentError) return contentError;

    const id = await withTransaction(async (client) => {
      const referenceError = await lockProductReferences(
        client,
        product.contentIds,
        product.coverAssetId,
        product.status === 'active',
      );
      if (referenceError) throw new ProductReferenceChangedError(referenceError);
      const created = await client.query<{ id: string }>(
        `INSERT INTO products (slug, product_type, name, description, status, cover_asset_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [product.slug, product.productType, product.name, product.description, product.status, product.coverAssetId, admin.id],
      );
      const productId = created.rows[0].id;
      for (const price of product.prices) {
        await client.query(
          `INSERT INTO prices (product_id, currency, amount_cents, billing_interval)
           VALUES ($1, $2, $3, $4)`,
          [productId, product.currency, price.amountCents, price.billingInterval],
        );
      }
      for (const contentId of product.contentIds) {
        await client.query(
          'INSERT INTO product_content (product_id, content_item_id) VALUES ($1, $2)',
          [productId, contentId],
        );
      }
      return productId;
    });
    return json({ id }, 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    if (error instanceof ProductReferenceChangedError) return json({ error: error.message }, 409);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return json({ error: 'Der Produkt-Slug ist bereits vergeben.' }, 409);
    }
    console.error('Produkt konnte nicht erstellt werden:', error);
    return json({ error: 'Das Produkt konnte nicht erstellt werden.' }, 500);
  }
};
