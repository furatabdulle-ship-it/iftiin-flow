import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSessionAccount } from '../../../../../lib/auth';
import { reportCommunityDiscussion } from '../../../../../lib/community-discussions';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../../lib/http';
import { rateLimit } from '../../../../../lib/rate-limit';

const reportSchema = z.object({ reason: z.string().trim().min(10).max(500) });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limited = rateLimit(context, 'community-discussion-report', 10, 60 * 60_000);
  if (limited) return limited;
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Please sign in to report a discussion.' }, 401);
    const id = context.params.id;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Discussion not found.' }, 404);
    const parsed = reportSchema.safeParse(await requestJson(context.request, 4096));
    if (!parsed.success) return json({ error: 'Please explain why you are reporting this discussion.' }, 400);
    const created = await reportCommunityDiscussion(id, account.id, parsed.data.reason);
    if (created === null) return json({ error: 'Discussion not found.' }, 404);
    return json({ reported: true, alreadyReported: !created }, created ? 201 : 200);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Community discussion report could not be submitted:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'The report could not be submitted.' }, 500);
  }
};
