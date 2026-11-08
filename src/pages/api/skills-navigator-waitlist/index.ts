import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { t } from '../../../lib/i18n';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../lib/http';
import { isSkillsNavigatorEmailConfigured, sendSkillsNavigatorConfirmationEmail } from '../../../lib/password-reset-email';
import { rateLimit } from '../../../lib/rate-limit';
import {
  createWaitlistSignup,
  purgeExpiredWaitlistSignups,
} from '../../../lib/skills-navigator-waitlist';

const maximumPayloadBytes = 4_096;
const waitlistRequestSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform((email) => email.toLowerCase()),
  consent: z.literal(true),
  companyWebsite: z.string().max(0).optional(),
});

export const POST: APIRoute = async (context) => {
  const locale = context.locals.locale;
  const originError = rejectCrossOriginWrite(context);
  if (originError) return json({ error: t(locale, 'studioInquiry.originError') }, 403);

  const limited = rateLimit(context, 'skills-navigator-waitlist', 5, 15 * 60_000);
  if (limited) {
    const response = json({ error: t(locale, 'waitlist.unavailable') }, limited.status);
    const retryAfter = limited.headers.get('Retry-After');
    if (retryAfter) response.headers.set('Retry-After', retryAfter);
    return response;
  }

  try {
    const parsed = waitlistRequestSchema.safeParse(await requestJson(context.request, maximumPayloadBytes));
    if (!parsed.success || parsed.data.companyWebsite) {
      return json({ error: t(locale, 'waitlist.invalid') }, 400);
    }

    if (!isSkillsNavigatorEmailConfigured()) {
      return json({ error: t(locale, 'waitlist.unavailable') }, 503);
    }

    await purgeExpiredWaitlistSignups();
    const signup = await createWaitlistSignup(parsed.data.email, locale);
    if (signup) {
      await sendSkillsNavigatorConfirmationEmail(
        parsed.data.email,
        signup.confirmationToken,
        signup.unsubscribeToken,
        locale,
      );
    }
    return json({ success: true });
  } catch (error) {
    if (error instanceof RequestInputError) {
      return json({ error: error.status === 413 ? t(locale, 'waitlist.unavailable') : t(locale, 'waitlist.invalid') }, error.status);
    }
    console.error('Skills-Navigator-Warteliste konnte nicht verarbeitet werden:', error instanceof Error ? error.name : 'unknown');
    return json({ error: t(locale, 'waitlist.unavailable') }, 503);
  }
};
