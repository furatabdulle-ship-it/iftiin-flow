import type { APIRoute } from 'astro';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import {
  listAdminCommunityDiscussions,
} from '../../../../lib/community-discussions';
import { json } from '../../../../lib/http';

const filters = ['recent', 'reported', 'hidden', 'all'] as const;

export const GET: APIRoute = async (context) => {
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const params = new URL(context.request.url).searchParams;
    const filter = params.get('status') ?? 'recent';
    const page = Number(params.get('page') ?? '1');
    if (!filters.includes(filter as (typeof filters)[number])) return json({ error: 'Invalid status filter.' }, 400);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100_000) return json({ error: 'Invalid page number.' }, 400);
    return json(await listAdminCommunityDiscussions(filter as (typeof filters)[number], page));
  } catch (error) {
    console.error('Admin discussions could not be loaded:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Discussions could not be loaded.' }, 500);
  }
};
