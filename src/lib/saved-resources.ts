import { query } from './db';

export type SavedResourceType = 'article' | 'learning';

export type SavedResource = {
  resourceType: SavedResourceType;
  resourceId: string;
  slug: string;
  title: string;
  titleEn: string | null;
  description: string;
  descriptionEn: string | null;
  contentType?: 'lesson' | 'video' | 'download';
};

export async function listSavedResources(userId: string, isAdmin = false): Promise<SavedResource[]> {
  const result = await query<SavedResource>(
    `SELECT 'article' AS "resourceType", article.id AS "resourceId", article.slug,
            article.title, article.title_en AS "titleEn",
           article.description, article.description_en AS "descriptionEn",
           NULL::text AS "contentType"
     FROM saved_resources AS saved
     JOIN articles AS article ON article.id = saved.resource_id
     WHERE saved.user_id = $1 AND saved.resource_type = 'article'
       AND article.status = 'published'
       AND (
         article.requires_purchase = FALSE OR $2::boolean
         OR EXISTS (
           SELECT 1
           FROM content_items AS item
           JOIN entitlement_content AS link ON link.content_item_id = item.id
           JOIN entitlements AS entitlement ON entitlement.id = link.entitlement_id
           WHERE item.article_id = article.id
             AND entitlement.user_id = $1
             AND entitlement.status = 'active'
             AND entitlement.starts_at <= NOW()
             AND (entitlement.expires_at IS NULL OR entitlement.expires_at > NOW())
         )
       )
     UNION ALL
     SELECT 'learning' AS "resourceType", item.id AS "resourceId", item.slug,
            item.title, item.title_en AS "titleEn",
            item.description, item.description_en AS "descriptionEn",
            item.content_type AS "contentType"
     FROM saved_resources AS saved
     JOIN content_items AS item ON item.id = saved.resource_id
     WHERE saved.user_id = $1 AND saved.resource_type = 'learning'
       AND item.status = 'published' AND item.content_type IN ('lesson', 'video', 'download')
       AND (
         $2::boolean
         OR (
           item.visibility = 'community'
           AND NOT EXISTS (SELECT 1 FROM product_content pc WHERE pc.content_id = item.id)
         )
         OR EXISTS (
           SELECT 1
           FROM entitlement_content AS link
           JOIN entitlements AS entitlement ON entitlement.id = link.entitlement_id
           WHERE link.content_item_id = item.id
             AND entitlement.user_id = $1
             AND entitlement.status = 'active'
             AND entitlement.starts_at <= NOW()
             AND (entitlement.expires_at IS NULL OR entitlement.expires_at > NOW())
         )
       )
     ORDER BY title
     LIMIT 200`,
    [userId, isAdmin],
  );
  return result.rows;
}
