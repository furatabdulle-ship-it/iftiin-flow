import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { moderateCommunityDiscussion } from '../../../../lib/community-discussions';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { rateLimit } from '../../../../lib/rate-limit';

const updateSchema = z.object({ status: z.enum(['visible', 'hidden']) });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PATCH: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limited = rateLimit(context, 'admin-community-discussion-moderation', 60, 60 * 60_000);
  if (limited) return limited;
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const id = context.params.id;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Discussion not found.' }, 404);
    const parsed = updateSchema.safeParse(await requestJson(context.request, 4096));
    if (!parsed.success) return json({ error: 'Choose visible or hidden.' }, 400);
    const updated = await moderateCommunityDiscussion(id, parsed.data.status);
    if (!updated) return json({ error: 'Discussion not found.' }, 404);
    return json({ success: true, status: parsed.data.status });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Community discussion moderation failed:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'The discussion could not be updated.' }, 500);
  }
};
