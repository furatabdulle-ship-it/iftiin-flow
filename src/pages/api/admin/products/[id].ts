import type { APIRoute } from 'astro';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { withTransaction } from '../../../../lib/db';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { validateProductContentLinks } from '../../../../lib/product-validation';
import { productInputSchema } from '../../../../lib/validation';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PUT: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const { id } = context.params;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Produkt-ID.' }, 400);
    const parsed = productInputSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({
      error: 'Die Produktdaten sind ungültig.',
      details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    }, 400);
    const product = parsed.data;
    const contentError = await validateProductContentLinks(
      product.contentIds,
      product.productType,
      product.status === 'active',
    );
    if (contentError) return contentError;

    const updated = await withTransaction(async (client) => {
      const current = await client.query<{ product_type: string }>(
        'SELECT product_type FROM products WHERE id = $1 FOR UPDATE',
        [id],
      );
      if (!current.rowCount) return false;
      const productResult = await client.query(
        `UPDATE products SET slug = $2, product_type = $3, name = $4, description = $5,
           status = $6, updated_at = NOW()
         WHERE id = $1`,
        [id, product.slug, product.productType, product.name, product.description, product.status],
      );
      if (!productResult.rowCount) return false;

      const price = await client.query<{
        amount_cents: string;
        currency: string;
        billing_interval: string;
      }>(
        `SELECT amount_cents, currency, billing_interval
         FROM prices WHERE product_id = $1 AND active = TRUE FOR UPDATE`,
        [id],
      );
      const activePrice = price.rows[0];
      if (
        !activePrice ||
        Number(activePrice.amount_cents) !== product.amountCents ||
        activePrice.currency.trim() !== product.currency ||
        activePrice.billing_interval !== product.billingInterval
      ) {
        await client.query('UPDATE prices SET active = FALSE WHERE product_id = $1 AND active = TRUE', [id]);
        await client.query(
          `INSERT INTO prices (product_id, currency, amount_cents, billing_interval)
           VALUES ($1, $2, $3, $4)`,
          [id, product.currency, product.amountCents, product.billingInterval],
        );
      }

      await client.query('DELETE FROM product_content WHERE product_id = $1', [id]);
      for (const contentId of product.contentIds) {
        await client.query(
          'INSERT INTO product_content (product_id, content_item_id) VALUES ($1, $2)',
          [id, contentId],
        );
      }
      return true;
    });
    if (!updated) return json({ error: 'Produkt nicht gefunden.' }, 404);
    return json({ success: true });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return json({ error: 'Der Produkt-Slug ist bereits vergeben.' }, 409);
    }
    console.error('Produkt konnte nicht aktualisiert werden:', error);
    return json({ error: 'Das Produkt konnte nicht aktualisiert werden.' }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const { id } = context.params;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Produkt-ID.' }, 400);
    const result = await withTransaction(async (client) => {
      const archived = await client.query(
        `UPDATE products SET status = 'archived', updated_at = NOW()
         WHERE id = $1 AND status <> 'archived' RETURNING id`,
        [id],
      );
      if (archived.rowCount) {
        await client.query(
          'UPDATE prices SET active = FALSE WHERE product_id = $1 AND active = TRUE',
          [id],
        );
      }
      return archived.rowCount ?? 0;
    });
    if (!result) return json({ error: 'Aktives Produkt nicht gefunden.' }, 404);
    return json({ success: true });
  } catch (error) {
    console.error('Produkt konnte nicht archiviert werden:', error);
    return json({ error: 'Das Produkt konnte nicht archiviert werden.' }, 500);
  }
};
