import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSessionAccount } from '../../../../../lib/auth';
import { addCommunityDiscussionReply } from '../../../../../lib/community-discussions';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../../lib/http';
import { rateLimit } from '../../../../../lib/rate-limit';

const replySchema = z.object({ body: z.string().trim().min(1).max(2000) });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limited = rateLimit(context, 'community-discussion-reply', 20, 60 * 60_000);
  if (limited) return limited;
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Please sign in to reply.' }, 401);
    const id = context.params.id;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Discussion not found.' }, 404);
    const parsed = replySchema.safeParse(await requestJson(context.request, 8192));
    if (!parsed.success) return json({ error: 'Please enter a reply of no more than 2,000 characters.' }, 400);
    const reply = await addCommunityDiscussionReply(id, account.id, parsed.data.body);
    if (!reply) return json({ error: 'Discussion not found.' }, 404);
    return json({ reply }, 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Community reply could not be created:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'The reply could not be created.' }, 500);
  }
};
