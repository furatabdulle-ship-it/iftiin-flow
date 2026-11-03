CREATE TABLE studio_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  locale TEXT NOT NULL CHECK (locale IN ('de', 'en')),
  professional_background TEXT NOT NULL CHECK (professional_background IN (
    'independent_professional', 'founder', 'small_business', 'creator_educator', 'other'
  )),
  challenge_category TEXT NOT NULL CHECK (challenge_category IN (
    'communication_content', 'research_knowledge', 'planning_organization',
    'creativity_ideas', 'business_reinvention', 'other_unsure'
  )),
  desired_outcome TEXT NOT NULL CHECK (desired_outcome IN (
    'redesign_work', 'create_ai_assistant', 'reduce_repetitive_work',
    'develop_ai_skills', 'explore_possibilities'
  )),
  ai_experience TEXT NOT NULL CHECK (ai_experience IN ('beginner', 'occasional', 'regular')),
  timeline TEXT CHECK (timeline IN ('within_2_weeks', 'within_1_month', 'within_3_months', 'exploring')),
  budget_range TEXT CHECK (budget_range IN ('under_500', '500_1500', '1500_3000', 'over_3000', 'unsure')),
  additional_details TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed')),
  internal_notes TEXT,
  last_contacted_at TIMESTAMPTZ
);

CREATE INDEX studio_inquiries_created_at_idx ON studio_inquiries (created_at DESC);
CREATE INDEX studio_inquiries_status_idx ON studio_inquiries (status);
CREATE INDEX studio_inquiries_locale_idx ON studio_inquiries (locale);
