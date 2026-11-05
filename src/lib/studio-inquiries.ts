import { query } from './db';

export const studioInquiryStatuses = ['new', 'contacted', 'qualified', 'closed'] as const;
export type StudioInquiryStatus = typeof studioInquiryStatuses[number];

export const studioInquiryCategories = [
  'communication_content',
  'research_knowledge',
  'planning_organization',
  'creativity_ideas',
  'business_reinvention',
  'other_unsure',
] as const;

export type StudioInquiry = {
  id: string;
  created_at: Date | string;
  updated_at: Date | string;
  full_name: string;
  email: string;
  locale: 'de' | 'en';
  experience_ids: string[];
  professional_background: string | null;
  challenge_category: string | null;
  desired_outcome: string | null;
  ai_experience: string | null;
  timeline: string | null;
  budget_range: string | null;
  additional_details: string | null;
  status: StudioInquiryStatus;
  internal_notes: string | null;
  last_contacted_at: Date | string | null;
};

export type StudioInquiryFilters = {
  search: string;
  status: StudioInquiryStatus | '';
  category: string;
  locale: 'de' | 'en' | '';
  from: string;
  to: string;
  sort: 'oldest' | 'newest';
  limit: number;
  offset: number;
};

export async function getStudioInquiryCounts(): Promise<Record<StudioInquiryStatus | 'total', number>> {
  const result = await query<{
    total: string;
    new_count: string;
    contacted_count: string;
    qualified_count: string;
    closed_count: string;
  }>(
    `SELECT COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status = 'new')::text AS new_count,
       COUNT(*) FILTER (WHERE status = 'contacted')::text AS contacted_count,
       COUNT(*) FILTER (WHERE status = 'qualified')::text AS qualified_count,
       COUNT(*) FILTER (WHERE status = 'closed')::text AS closed_count
     FROM studio_inquiries`,
  );
  const row = result.rows[0];
  return {
    total: Number(row.total),
    new: Number(row.new_count),
    contacted: Number(row.contacted_count),
    qualified: Number(row.qualified_count),
    closed: Number(row.closed_count),
  };
}

export async function listStudioInquiries(filters: StudioInquiryFilters): Promise<{ inquiries: StudioInquiry[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const addCondition = (value: unknown, expression: (placeholder: string) => string) => {
    values.push(value);
    conditions.push(expression(`$${values.length}`));
  };

  if (filters.search) {
    addCondition(filters.search.toLowerCase(), (placeholder) =>
      `(position(${placeholder} in lower(full_name)) > 0 OR position(${placeholder} in lower(email)) > 0)`);
  }
  if (filters.status) addCondition(filters.status, (placeholder) => `status = ${placeholder}`);
  if (filters.category) addCondition(filters.category, (placeholder) => `challenge_category = ${placeholder}`);
  if (filters.locale) addCondition(filters.locale, (placeholder) => `locale = ${placeholder}`);
  if (filters.from) addCondition(filters.from, (placeholder) => `created_at >= ${placeholder}::date`);
  if (filters.to) addCondition(filters.to, (placeholder) => `created_at < (${placeholder}::date + INTERVAL '1 day')`);

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = await query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM studio_inquiries ${where}`,
    values,
  );
  const order = filters.sort === 'oldest' ? 'ASC' : 'DESC';
  const listValues = [...values, filters.limit, filters.offset];
  const result = await query<StudioInquiry>(
    `SELECT id, created_at, updated_at, full_name, email, locale,
            experience_ids, professional_background, challenge_category, desired_outcome,
            ai_experience, timeline, budget_range, additional_details, status,
            internal_notes, last_contacted_at
     FROM studio_inquiries ${where}
     ORDER BY created_at ${order}, id ${order}
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues,
  );
  return { inquiries: result.rows, total: Number(count.rows[0].total) };
}

export async function getStudioInquiry(id: string): Promise<StudioInquiry | null> {
  const result = await query<StudioInquiry>(
    `SELECT id, created_at, updated_at, full_name, email, locale,
            experience_ids, professional_background, challenge_category, desired_outcome,
            ai_experience, timeline, budget_range, additional_details, status,
            internal_notes, last_contacted_at
     FROM studio_inquiries WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}
