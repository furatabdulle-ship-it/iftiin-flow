import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSessionAccount } from '../../../../lib/auth';
import {
  discussionCategories,
  listCommunityDiscussions,
} from '../../../../lib/community-discussions';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { rateLimit } from '../../../../lib/rate-limit';
import { query } from '../../../../lib/db';

const discussionSchema = z.object({
  category: z.enum(discussionCategories),
  title: z.string().trim().min(5).max(160),
  body: z.string().trim().min(20).max(4000),
});

export const GET: APIRoute = async (context) => {
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Please sign in to view discussions.' }, 401);
    const params = new URL(context.request.url).searchParams;
    const category = params.get('category') ?? '';
    if (category && !discussionCategories.includes(category as (typeof discussionCategories)[number])) {
      return json({ error: 'Unknown discussion category.' }, 400);
    }
    const requestedPage = Number(params.get('page') ?? '1');
    if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || requestedPage > 100_000) {
      return json({ error: 'Invalid page number.' }, 400);
    }
    const result = await listCommunityDiscussions(
      account.id,
      category as (typeof discussionCategories)[number] | '',
      requestedPage,
    );
    return json(result);
  } catch (error) {
    console.error('Community discussions could not be loaded:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Discussions could not be loaded.' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limited = rateLimit(context, 'community-discussion-create', 5, 60 * 60_000);
  if (limited) return limited;
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Please sign in to start a discussion.' }, 401);
    const parsed = discussionSchema.safeParse(await requestJson(context.request, 12_288));
    if (!parsed.success) return json({ error: 'Please check the category, title and message.' }, 400);
    const result = await query(
      `INSERT INTO community_discussions (user_id, category, title, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, category, title, body, status, created_at AS "createdAt"`,
      [account.id, parsed.data.category, parsed.data.title, parsed.data.body],
    );
    return json({ discussion: { ...result.rows[0], author: account.displayName || 'Community member' } }, 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Community discussion could not be created:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'The discussion could not be created.' }, 500);
  }
};
