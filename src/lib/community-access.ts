import type { Account } from './auth';
import { query } from './db';

export async function hasCommunityAccess(
  userId: string,
  role: Account['role'],
): Promise<boolean> {
  if (role === 'admin') return true;

  const result = await query<{ allowed: boolean }>(
    `SELECT
       EXISTS (
         SELECT 1
         FROM entitlements e
         JOIN products p ON p.id = e.product_id
         WHERE e.user_id = $1
           AND e.status = 'active'
           AND e.starts_at <= NOW()
           AND (e.expires_at IS NULL OR e.expires_at > NOW())
           AND (
             p.product_type = 'online_course'
             OR EXISTS (
               SELECT 1
               FROM entitlement_content ec
               JOIN product_content pc ON pc.content_item_id = ec.content_item_id
               JOIN products course ON course.id = pc.product_id
               WHERE ec.entitlement_id = e.id
                 AND course.product_type = 'online_course'
             )
           )
       )
       OR EXISTS (
         SELECT 1
         FROM community_goal_sprint_enrollments enrollment
         WHERE enrollment.user_id = $1 AND enrollment.status = 'approved'
       ) AS allowed`,
    [userId],
  );
  return result.rows[0]?.allowed === true;
}
