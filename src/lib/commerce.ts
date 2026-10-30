import type { QueryResultRow } from 'pg';
import { query } from './db';

export const initialProductTypes = ['digital_download', 'premium_article', 'online_course'] as const;
export type ProductType = 'digital_download' | 'premium_article' | 'online_course' | 'bundle' | 'membership';
export type BillingInterval = 'one_time' | 'month' | 'year';

export type ProductRecord = {
  id: string;
  slug: string;
  productType: ProductType;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  coverAssetId: string | null;
  priceId: string;
  amountCents: number;
  currency: string;
  billingInterval: BillingInterval;
  content: { id: string; slug: string; title: string; contentType: string }[];
};

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
  price_id: string;
  amount_cents: string | number;
  currency: string;
  billing_interval: BillingInterval;
  content: ProductRecord['content'];
};

const productSelection = `
  SELECT p.id, p.slug, p.product_type, p.name, p.description, p.status,
         p.cover_asset_id,
         pr.id AS price_id, pr.amount_cents, pr.currency, pr.billing_interval,
         COALESCE(
           json_agg(json_build_object(
             'id', ci.id, 'slug', ci.slug, 'title', ci.title, 'contentType', ci.content_type
           )) FILTER (WHERE ci.id IS NOT NULL),
           '[]'::json
         ) AS content
  FROM products p
  JOIN LATERAL (
    SELECT id, amount_cents, currency, billing_interval, active
    FROM prices
    WHERE product_id = p.id
    ORDER BY active DESC, created_at DESC
    LIMIT 1
  ) pr ON TRUE
  LEFT JOIN product_content pc ON pc.product_id = p.id
  LEFT JOIN content_items ci ON ci.id = pc.content_item_id
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
    priceId: row.price_id,
    amountCents: Number(row.amount_cents),
    currency: row.currency,
    billingInterval: row.billing_interval,
    content: row.content ?? [],
  };
}

export async function listPublicProducts(): Promise<ProductRecord[]> {
  const result = await query<ProductRow>(
    `${productSelection}
     WHERE p.status = 'active' AND pr.active = TRUE AND p.product_type = ANY($1::text[])
       AND NOT EXISTS (
         SELECT 1 FROM product_content pending_pc
         JOIN content_items pending_ci ON pending_ci.id = pending_pc.content_item_id
         WHERE pending_pc.product_id = p.id AND pending_ci.status <> 'published'
       )
     GROUP BY p.id, pr.id, pr.amount_cents, pr.currency, pr.billing_interval
     ORDER BY p.created_at DESC`,
    [initialProductTypes],
  );
  return result.rows.map(mapProduct);
}

export async function listAdminProducts(): Promise<ProductRecord[]> {
  const result = await query<ProductRow>(
    `${productSelection}
     GROUP BY p.id, pr.id, pr.amount_cents, pr.currency, pr.billing_interval
     ORDER BY p.updated_at DESC`,
  );
  return result.rows.map(mapProduct);
}

export async function getCheckoutProduct(productId: string): Promise<ProductRecord | null> {
  const result = await query<ProductRow>(
    `${productSelection}
     WHERE p.id = $1 AND p.status = 'active' AND pr.active = TRUE
       AND p.product_type = ANY($2::text[])
       AND NOT EXISTS (
         SELECT 1 FROM product_content pending_pc
         JOIN content_items pending_ci ON pending_ci.id = pending_pc.content_item_id
         WHERE pending_pc.product_id = p.id AND pending_ci.status <> 'published'
       )
     GROUP BY p.id, pr.id, pr.amount_cents, pr.currency, pr.billing_interval`,
    [productId, initialProductTypes],
  );
  return result.rows[0] ? mapProduct(result.rows[0]) : null;
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
