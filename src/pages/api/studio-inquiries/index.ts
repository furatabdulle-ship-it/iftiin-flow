import type { APIRoute } from 'astro';
import { t } from '../../../lib/i18n';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../lib/http';
import { rateLimit } from '../../../lib/rate-limit';
import { query } from '../../../lib/db';
import { studioInquirySchema } from '../../../lib/validation';

const maximumPayloadBytes = 16_384;

export const POST: APIRoute = async (context) => {
  const locale = context.locals.locale;
  const originError = rejectCrossOriginWrite(context);
  if (originError) return json({ error: t(locale, 'studioInquiry.originError') }, 403);

  const limited = rateLimit(context, 'studio-inquiry', 5, 15 * 60_000);
  if (limited) {
    const message = limited.status === 429
      ? t(locale, 'studioInquiry.rateLimited')
      : t(locale, 'studioInquiry.unavailable');
    const response = json({ error: message }, limited.status);
    const retryAfter = limited.headers.get('Retry-After');
    if (retryAfter) response.headers.set('Retry-After', retryAfter);
    return response;
  }

  try {
    const parsed = studioInquirySchema.safeParse(await requestJson(context.request, maximumPayloadBytes));
    if (!parsed.success) {
      return json({
        error: t(locale, 'studioInquiry.invalid'),
        fields: [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? '')))].filter(Boolean),
      }, 400);
    }

    const inquiry = parsed.data;
    const inserted = await query<{ id: string }>(
      `INSERT INTO studio_inquiries
       (idempotency_key, full_name, email, locale, experience_ids, professional_background,
        challenge_category, desired_outcome, ai_experience, timeline, budget_range,
        additional_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [
        inquiry.submissionId,
        inquiry.fullName,
        inquiry.email,
        locale,
        inquiry.experienceIds,
        inquiry.professionalBackground,
        inquiry.challengeCategory,
        inquiry.desiredOutcome,
        inquiry.aiExperience,
        inquiry.timeline,
        inquiry.budgetRange,
        inquiry.additionalDetails,
      ],
    );
    return json({ success: true }, inserted.rowCount ? 201 : 200);
  } catch (error) {
    if (error instanceof RequestInputError) {
      const message = error.status === 413
        ? t(locale, 'studioInquiry.payloadTooLarge')
        : t(locale, 'studioInquiry.invalid');
      return json({ error: message }, error.status);
    }
    console.error('Studio-Anfrage konnte nicht gespeichert werden:', error instanceof Error ? error.name : 'unknown');
    return json({ error: t(locale, 'studioInquiry.unavailable') }, 503);
  }
};
