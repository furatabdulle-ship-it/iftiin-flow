import { query, withTransaction } from './db';

export const discussionCategories = ['future-skills', 'ai-literacy', 'media-literacy', 'storytelling'] as const;
export type DiscussionCategory = (typeof discussionCategories)[number];
export type DiscussionStatus = 'visible' | 'hidden';

export type DiscussionReply = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
};

export type CommunityDiscussion = {
  id: string;
  category: DiscussionCategory;
  title: string;
  body: string;
  status: DiscussionStatus;
  author: string;
  createdAt: string;
  replyCount: number;
  reportCount: number;
  reportedByMe: boolean;
  replies: DiscussionReply[];
};

type DiscussionRow = Omit<CommunityDiscussion, 'replies'> & {
  replyCount: number;
  reportCount: number;
};

export async function listCommunityDiscussions(
  userId: string,
  category: DiscussionCategory | '',
  page: number,
): Promise<{ discussions: CommunityDiscussion[]; page: number; pageSize: number; total: number }> {
  const pageSize = 20;
  const offset = (page - 1) * pageSize;
  const [count, discussionRows] = await Promise.all([
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM community_discussions
       WHERE status = 'visible' AND ($1::text = '' OR category = $1)`,
      [category],
    ),
    query<DiscussionRow>(
      `SELECT d.id, d.category, d.title, d.body, d.status,
              COALESCE(NULLIF(u.display_name, ''), 'Community member') AS author,
              d.created_at AS "createdAt",
              (SELECT COUNT(*)::int FROM community_discussion_replies r WHERE r.discussion_id = d.id) AS "replyCount",
              (SELECT COUNT(*)::int FROM community_discussion_reports rp
               WHERE rp.discussion_id = d.id AND rp.reviewed_at IS NULL) AS "reportCount",
              EXISTS (SELECT 1 FROM community_discussion_reports rp
                      WHERE rp.discussion_id = d.id AND rp.user_id = $1) AS "reportedByMe"
       FROM community_discussions d
       JOIN users u ON u.id = d.user_id
       WHERE d.status = 'visible' AND ($2::text = '' OR d.category = $2)
       ORDER BY d.created_at DESC, d.id DESC
       LIMIT $3 OFFSET $4`,
      [userId, category, pageSize, offset],
    ),
  ]);
  const discussions = discussionRows.rows;
  if (discussions.length) {
    const replies = await query<DiscussionReply & { discussionId: string }>(
      `SELECT ranked.id, ranked.body, ranked.author, ranked."createdAt", ranked."discussionId"
       FROM (
         SELECT r.id, r.body,
                COALESCE(NULLIF(u.display_name, ''), 'Community member') AS author,
                r.created_at AS "createdAt", r.discussion_id AS "discussionId",
                ROW_NUMBER() OVER (PARTITION BY r.discussion_id ORDER BY r.created_at, r.id) AS position
         FROM community_discussion_replies r
         JOIN users u ON u.id = r.user_id
         JOIN community_discussions d ON d.id = r.discussion_id
         WHERE d.status = 'visible' AND r.discussion_id = ANY($1::uuid[])
       ) ranked
       WHERE ranked.position <= 100
       ORDER BY ranked."discussionId", ranked."createdAt", ranked.id`,
      [discussions.map(({ id }) => id)],
    );
    const byDiscussion = new Map<string, DiscussionReply[]>();
    for (const reply of replies.rows) {
      const { discussionId, ...value } = reply;
      const group = byDiscussion.get(discussionId) ?? [];
      group.push(value);
      byDiscussion.set(discussionId, group);
    }
    return {
      discussions: discussions.map((discussion) => ({
        ...discussion,
        replies: byDiscussion.get(discussion.id) ?? [],
      })),
      page,
      pageSize,
      total: Number(count.rows[0].total),
    };
  }
  return { discussions: [], page, pageSize, total: Number(count.rows[0].total) };
}

export async function listAdminCommunityDiscussions(
  filter: 'recent' | 'reported' | 'hidden' | 'all',
  page: number,
) {
  const pageSize = 30;
  const offset = (page - 1) * pageSize;
  const result = await query(
    `SELECT d.id, d.category, d.title, d.body, d.status,
            COALESCE(NULLIF(u.display_name, ''), 'Community member') AS author,
            d.created_at AS "createdAt",
            (SELECT COUNT(*)::int FROM community_discussion_replies r WHERE r.discussion_id = d.id) AS "replyCount",
            COUNT(rp.id) FILTER (WHERE rp.reviewed_at IS NULL)::int AS "reportCount",
            COALESCE(
              json_agg(json_build_object('reason', rp.reason, 'createdAt', rp.created_at))
                FILTER (WHERE rp.id IS NOT NULL AND rp.reviewed_at IS NULL),
              '[]'::json
            ) AS reports
     FROM community_discussions d
     JOIN users u ON u.id = d.user_id
     LEFT JOIN community_discussion_reports rp ON rp.discussion_id = d.id
     WHERE ($1::text = 'recent'
       OR $1::text = 'all'
       OR ($1::text = 'reported' AND d.status = 'visible'
           AND EXISTS (SELECT 1 FROM community_discussion_reports open_report
                       WHERE open_report.discussion_id = d.id AND open_report.reviewed_at IS NULL))
       OR ($1::text = 'hidden' AND d.status = 'hidden'))
     GROUP BY d.id, u.display_name
     ORDER BY CASE WHEN COUNT(rp.id) FILTER (WHERE rp.reviewed_at IS NULL) > 0 THEN 0 ELSE 1 END,
              d.created_at DESC, d.id DESC
     LIMIT $2 OFFSET $3`,
    [filter, pageSize, offset],
  );
  const count = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM community_discussions d
     WHERE ($1::text IN ('recent', 'all')
       OR ($1::text = 'reported' AND d.status = 'visible'
           AND EXISTS (SELECT 1 FROM community_discussion_reports rp
                       WHERE rp.discussion_id = d.id AND rp.reviewed_at IS NULL))
       OR ($1::text = 'hidden' AND d.status = 'hidden'))`,
    [filter],
  );
  return { discussions: result.rows, page, pageSize, total: Number(count.rows[0].total) };
}

export async function addCommunityDiscussionReply(
  discussionId: string,
  userId: string,
  body: string,
): Promise<DiscussionReply | null> {
  return withTransaction(async (client) => {
    const discussion = await client.query(
      `SELECT id FROM community_discussions WHERE id = $1 AND status = 'visible' FOR UPDATE`,
      [discussionId],
    );
    if (!discussion.rowCount) return null;
    const result = await client.query<DiscussionReply>(
      `INSERT INTO community_discussion_replies (discussion_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, body, (SELECT COALESCE(NULLIF(display_name, ''), 'Community member')
                            FROM users WHERE id = $2) AS author, created_at AS "createdAt"`,
      [discussionId, userId, body],
    );
    return result.rows[0];
  });
}

export async function reportCommunityDiscussion(
  discussionId: string,
  userId: string,
  reason: string,
): Promise<boolean | null> {
  return withTransaction(async (client) => {
    const discussion = await client.query(
      `SELECT id FROM community_discussions WHERE id = $1 AND status = 'visible' FOR UPDATE`,
      [discussionId],
    );
    if (!discussion.rowCount) return null;
    const result = await client.query(
      `INSERT INTO community_discussion_reports (discussion_id, user_id, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (discussion_id, user_id) DO NOTHING
       RETURNING id`,
      [discussionId, userId, reason],
    );
    return Boolean(result.rowCount);
  });
}

export async function moderateCommunityDiscussion(
  discussionId: string,
  status: DiscussionStatus,
): Promise<boolean> {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE community_discussions SET status = $2, updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [discussionId, status],
    );
    if (!result.rowCount) return false;
    await client.query(
      `UPDATE community_discussion_reports SET reviewed_at = NOW()
       WHERE discussion_id = $1 AND reviewed_at IS NULL`,
      [discussionId],
    );
    return true;
  });
}
