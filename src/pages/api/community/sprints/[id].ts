import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSessionAccount } from '../../../../lib/auth';
import { requestGoalSprintEnrollment } from '../../../../lib/goal-sprints';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { rateLimit } from '../../../../lib/rate-limit';

const requestSchema = z.object({
  motivation: z.string().trim().max(1000).default(''),
}).strict();

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  const limited = rateLimit(context, 'community-goal-sprint-registration', 5, 60 * 60_000);
  if (limited) return limited;
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an, um dich für einen Ziel-Sprint anzumelden.' }, 401);
    const sprintId = z.uuid().safeParse(context.params.id);
    if (!sprintId.success) return json({ error: 'Der Ziel-Sprint wurde nicht gefunden.' }, 404);
    const parsed = requestSchema.safeParse(await requestJson(context.request, 4096));
    if (!parsed.success) return json({ error: 'Bitte überprüfe deine Anmeldung.' }, 400);

    const status = await requestGoalSprintEnrollment(sprintId.data, account.id, parsed.data.motivation);
    if (status === 'missing') return json({ error: 'Der Ziel-Sprint wurde nicht gefunden.' }, 404);
    if (status === 'closed') return json({ error: 'Die Anmeldung für diesen Ziel-Sprint ist geschlossen.' }, 409);
    if (status === 'approved') return json({ status, message: 'Deine Teilnahme ist bereits bestätigt.' });
    if (status === 'pending') return json({ status, message: 'Deine Anmeldung wird bereits geprüft.' });
    return json({ status: 'pending', message: 'Deine Anmeldung wurde zur Prüfung eingereicht.' }, 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Ziel-Sprint-Anmeldung konnte nicht gespeichert werden:', error);
    return json({ error: 'Die Anmeldung konnte nicht gespeichert werden.' }, 500);
  }
};
