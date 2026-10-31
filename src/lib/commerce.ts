import type { QueryResultRow } from 'pg';
import { query } from './db';

export const availableProductTypes = [
  'digital_download',
  'premium_article',
  'online_course',
  'bundle',
  'membership',
] as const;
export type ProductType = 'digital_download' | 'premium_article' | 'online_course' | 'bundle' | 'membership';
export type BillingInterval = 'one_time' | 'month' | 'year';
export type ProductPrice = {
  priceId: string;
  amountCents: number;
  currency: string;
  billingInterval: BillingInterval;
};

export type ProductRecord = {
  id: string;
  slug: string;
  productType: ProductType;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  coverAssetId: string | null;
  prices: ProductPrice[];
  content: { id: string; slug: string; title: string; contentType: string }[];
};

export type CheckoutProduct = Omit<ProductRecord, 'prices'> & ProductPrice;

export type AccountContent = {
  id: string;
  slug: string;
  title: string;
  contentType: string;
  progressPercent: number | null;
  completedAt: Date | string | null;
};

export type AccountEntitlement = {
  id: string;
  productId: string;
  productName: string;
  source: string;
  startsAt: Date | string;
  expiresAt: Date | string | null;
  content: AccountContent[];
};

type ProductRow = QueryResultRow & {
  id: string;
  slug: string;
  product_type: ProductType;
  name: string;
  description: string;
  status: ProductRecord['status'];
  cover_asset_id: string | null;
  prices: ProductRecord['prices'];
  content: ProductRecord['content'];
};

const productSelection = `
  SELECT p.id, p.slug, p.product_type, p.name, p.description, p.status,
         p.cover_asset_id,
         COALESCE((
           SELECT json_agg(json_build_object(
             'priceId', pr.id, 'amountCents', pr.amount_cents, 'currency', pr.currency,
             'billingInterval', pr.billing_interval
           ) ORDER BY pr.created_at)
           FROM prices pr
           WHERE pr.product_id = p.id
             AND (
               pr.active = TRUE
               OR (
                 NOT EXISTS (
                   SELECT 1 FROM prices active_price
                   WHERE active_price.product_id = p.id AND active_price.active = TRUE
                 )
                 AND pr.id = (
                   SELECT latest_price.id FROM prices latest_price
                   WHERE latest_price.product_id = p.id
                   ORDER BY latest_price.created_at DESC LIMIT 1
                 )
               )
             )
         ), '[]'::json) AS prices,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id', ci.id, 'slug', ci.slug, 'title', ci.title, 'contentType', ci.content_type
           ) ORDER BY ci.position, ci.title)
           FROM product_content pc
           JOIN content_items ci ON ci.id = pc.content_item_id
           WHERE pc.product_id = p.id
         ), '[]'::json) AS content
  FROM products p
`;

function mapProduct(row: ProductRow): ProductRecord {
  return {
    id: row.id,
    slug: row.slug,
    productType: row.product_type,
    name: row.name,
    description: row.description,
    status: row.status,
    coverAssetId: row.cover_asset_id,
    prices: (row.prices ?? []).map((price) => ({
      ...price,
      amountCents: Number(price.amountCents),
    })),
    content: row.content ?? [],
  };
}

export async function listPublicProducts(): Promise<ProductRecord[]> {
  const result = await query<ProductRow>(
    `${productSelection}
     WHERE p.status = 'active'
       AND EXISTS (SELECT 1 FROM prices pr WHERE pr.product_id = p.id AND pr.active = TRUE)
       AND p.product_type = ANY($1::text[])
       AND NOT EXISTS (
         SELECT 1 FROM product_content pending_pc
         JOIN content_items pending_ci ON pending_ci.id = pending_pc.content_item_id
         WHERE pending_pc.product_id = p.id AND pending_ci.status <> 'published'
       )
     ORDER BY p.created_at DESC`,
    [availableProductTypes],
  );
  return result.rows.map(mapProduct);
}

export async function listAdminProducts(): Promise<ProductRecord[]> {
  const result = await query<ProductRow>(
    `${productSelection}
     ORDER BY p.updated_at DESC`,
  );
  return result.rows.map(mapProduct);
}

export async function getCheckoutProduct(productId: string, priceId: string): Promise<CheckoutProduct | null> {
  const result = await query<ProductRow>(
    `${productSelection}
     WHERE p.id = $1 AND p.status = 'active'
       AND EXISTS (
         SELECT 1 FROM prices selected_price
         WHERE selected_price.id = $2 AND selected_price.product_id = p.id AND selected_price.active = TRUE
       )
       AND p.product_type = ANY($3::text[])
       AND NOT EXISTS (
         SELECT 1 FROM product_content pending_pc
         JOIN content_items pending_ci ON pending_ci.id = pending_pc.content_item_id
         WHERE pending_pc.product_id = p.id AND pending_ci.status <> 'published'
       )`,
    [productId, priceId, availableProductTypes],
  );
  if (!result.rows[0]) return null;
  const product = mapProduct(result.rows[0]);
  const selectedPrice = product.prices.find((price) => price.priceId === priceId);
  if (!selectedPrice) return null;
  const { prices, ...checkoutProduct } = product;
  return { ...checkoutProduct, ...selectedPrice };
}

export async function hasContentAccess(userId: string, contentItemId: string): Promise<boolean> {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM entitlement_content ec
       JOIN entitlements e ON e.id = ec.entitlement_id
       WHERE ec.content_item_id = $1
         AND e.user_id = $2
         AND e.status = 'active'
         AND e.starts_at <= NOW()
         AND (e.expires_at IS NULL OR e.expires_at > NOW())
     ) AS allowed`,
    [contentItemId, userId],
  );
  return result.rows[0]?.allowed === true;
}

export async function hasArticleAccess(userId: string, articleId: string): Promise<boolean> {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM content_items ci
       JOIN entitlement_content ec ON ec.content_item_id = ci.id
       JOIN entitlements e ON e.id = ec.entitlement_id
       WHERE ci.article_id = $1
         AND e.user_id = $2
         AND e.status = 'active'
         AND e.starts_at <= NOW()
         AND (e.expires_at IS NULL OR e.expires_at > NOW())
     ) AS allowed`,
    [articleId, userId],
  );
  return result.rows[0]?.allowed === true;
}

export async function hasGuestContentAccess(email: string, contentItemId: string): Promise<boolean> {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM order_item_content oic
       JOIN order_items oi ON oi.id = oic.order_item_id
       JOIN orders o ON o.id = oi.order_id
       JOIN prices pr ON pr.id = oi.price_id
       WHERE o.user_id IS NULL AND o.guest_email = $1 AND o.status = 'paid'
         AND oic.content_item_id = $2
         AND (
           pr.billing_interval = 'one_time'
           OR EXISTS (
             SELECT 1 FROM subscriptions s
             WHERE s.order_id = o.id AND s.product_id = oi.product_id
               AND s.status IN ('active', 'trialing')
               AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
           )
         )
     ) AS allowed`,
    [email, contentItemId],
  );
  return result.rows[0]?.allowed === true;
}

export async function hasGuestArticleAccess(email: string, articleId: string): Promise<boolean> {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM content_items ci
       JOIN order_item_content oic ON oic.content_item_id = ci.id
       JOIN order_items oi ON oi.id = oic.order_item_id
       JOIN orders o ON o.id = oi.order_id
       JOIN prices pr ON pr.id = oi.price_id
       WHERE ci.article_id = $1 AND o.user_id IS NULL
         AND o.guest_email = $2 AND o.status = 'paid'
         AND (
           pr.billing_interval = 'one_time'
           OR EXISTS (
             SELECT 1 FROM subscriptions s
             WHERE s.order_id = o.id AND s.product_id = oi.product_id
               AND s.status IN ('active', 'trialing')
               AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
           )
         )
     ) AS allowed`,
    [articleId, email],
  );
  return result.rows[0]?.allowed === true;
}

export async function listGuestLibrary(email: string) {
  const result = await query<{
    orderId: string;
    productName: string;
    productType: ProductType;
    createdAt: Date;
    content: AccountContent[];
  }>(
    `SELECT o.id AS "orderId", oi.product_name AS "productName",
            p.product_type AS "productType", o.created_at AS "createdAt",
            COALESCE(json_agg(json_build_object(
              'id', ci.id, 'slug', ci.slug, 'title', ci.title,
              'contentType', ci.content_type, 'progressPercent', NULL,
              'completedAt', NULL
            ) ORDER BY ci.position, ci.title) FILTER (WHERE ci.id IS NOT NULL), '[]'::json) AS content
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     JOIN prices pr ON pr.id = oi.price_id
     LEFT JOIN order_item_content oic ON oic.order_item_id = oi.id
     LEFT JOIN content_items ci ON ci.id = oic.content_item_id AND ci.status = 'published'
     WHERE o.user_id IS NULL AND o.guest_email = $1 AND o.status = 'paid'
       AND (
         pr.billing_interval = 'one_time'
         OR EXISTS (
           SELECT 1 FROM subscriptions s
           WHERE s.order_id = o.id AND s.product_id = oi.product_id
             AND s.status IN ('active', 'trialing')
             AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
         )
       )
     GROUP BY o.id, oi.id, p.product_type
     ORDER BY o.created_at DESC`,
    [email],
  );
  return result.rows;
}

export async function listAccountEntitlements(userId: string): Promise<AccountEntitlement[]> {
  const result = await query<AccountEntitlement>(
    `SELECT e.id, e.product_id AS "productId", p.name AS "productName",
            e.source, e.starts_at AS "startsAt", e.expires_at AS "expiresAt",
            COALESCE(json_agg(json_build_object(
              'id', ci.id, 'slug', ci.slug, 'title', ci.title,
              'contentType', ci.content_type, 'progressPercent', lp.progress_percent,
              'completedAt', lp.completed_at
            )) FILTER (WHERE ci.id IS NOT NULL), '[]'::json) AS content
     FROM entitlements e
     JOIN products p ON p.id = e.product_id
     LEFT JOIN entitlement_content ec ON ec.entitlement_id = e.id
     LEFT JOIN content_items ci ON ci.id = ec.content_item_id AND ci.status = 'published'
     LEFT JOIN learning_progress lp ON lp.user_id = e.user_id AND lp.content_item_id = ci.id
     WHERE e.user_id = $1 AND e.status = 'active'
       AND e.starts_at <= NOW()
       AND (e.expires_at IS NULL OR e.expires_at > NOW())
     GROUP BY e.id, p.name
     ORDER BY e.created_at DESC`,
    [userId],
  );
  return result.rows;
}

export async function listAccountOrders(userId: string) {
  const result = await query<{
    id: string;
    status: string;
    currency: string;
    totalCents: string;
    createdAt: Date;
    items: { name: string; quantity: number }[];
  }>(
    `SELECT o.id, o.status, o.currency, o.total_cents AS "totalCents",
            o.created_at AS "createdAt",
            json_agg(json_build_object(
              'name', oi.product_name, 'quantity', oi.quantity
            )) AS items
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = $1
     GROUP BY o.id
     ORDER BY o.created_at DESC
     LIMIT 20`,
    [userId],
  );
  return result.rows;
}
