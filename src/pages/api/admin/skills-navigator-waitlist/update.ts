import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { getWaitlistSubscribersByIds, sendWaitlistUpdate } from '../../../../lib/skills-navigator-waitlist';
import { isSkillsNavigatorEmailConfigured, sendSkillsNavigatorUpdateEmail } from '../../../../lib/password-reset-email';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { rateLimit } from '../../../../lib/rate-limit';

const maximumRecipients = 10;
const updateSchema = z.object({
  subscriberIds: z.array(z.uuid()).min(1).max(maximumRecipients),
  subjectDe: z.string().trim().min(3).max(120).refine((value) => !/[\r\n]/.test(value)),
  messageDe: z.string().trim().min(1).max(5_000).refine((value) => !value.includes('\0')),
  subjectEn: z.string().trim().min(3).max(120).refine((value) => !/[\r\n]/.test(value)),
  messageEn: z.string().trim().min(1).max(5_000).refine((value) => !value.includes('\0')),
  confirm: z.literal(true),
});

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const limited = rateLimit(context, 'skills-navigator-update-mailer', 3, 15 * 60_000);
    if (limited) return limited;
    if (!isSkillsNavigatorEmailConfigured()) {
      return json({ error: 'Der Gmail-OAuth-Mailversand ist nicht vollständig konfiguriert.' }, 503);
    }

    const parsed = updateSchema.safeParse(await requestJson(context.request, 12_288));
    if (!parsed.success) {
      return json({ error: `Bitte prüfe Empfängerauswahl und beide Sprachfassungen (maximal ${maximumRecipients} pro Versand).` }, 400);
    }
    const subscriberIds = [...new Set(parsed.data.subscriberIds)];
    if (subscriberIds.length !== parsed.data.subscriberIds.length) {
      return json({ error: 'Die Empfängerauswahl enthält Duplikate.' }, 400);
    }

    const subscribers = await getWaitlistSubscribersByIds(subscriberIds);
    if (subscribers.length !== subscriberIds.length) {
      return json({ error: 'Mindestens eine ausgewählte Anmeldung ist nicht mehr aktiv. Bitte lade die Seite neu.' }, 409);
    }

    const sentIds: string[] = [];
    const failedIds: string[] = [];
    for (const subscriber of subscribers) {
      const subject = subscriber.locale === 'en' ? parsed.data.subjectEn : parsed.data.subjectDe;
      const message = subscriber.locale === 'en' ? parsed.data.messageEn : parsed.data.messageDe;
      try {
        await sendWaitlistUpdate(
          subscriber,
          subject,
          message,
          sendSkillsNavigatorUpdateEmail,
        );
        sentIds.push(subscriber.id);
      } catch (error) {
        console.error('Skills-Navigator-Pilotupdate konnte nicht versendet werden:', error instanceof Error ? error.name : 'unknown');
        failedIds.push(subscriber.id);
      }
    }

    return json(
      { success: failedIds.length === 0, sent: sentIds.length, failed: failedIds.length, sentIds, failedIds },
      failedIds.length ? 502 : 200,
    );
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Skills-Navigator-Pilotmailer fehlgeschlagen:', error instanceof Error ? error.name : 'unknown');
    return json({ error: 'Das Pilot-Update konnte nicht verarbeitet werden.' }, 500);
  }
};
