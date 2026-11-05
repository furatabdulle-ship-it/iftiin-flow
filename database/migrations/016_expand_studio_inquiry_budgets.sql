ALTER TABLE studio_inquiries
  DROP CONSTRAINT IF EXISTS studio_inquiries_budget_range_check,
  ADD CONSTRAINT studio_inquiries_budget_range_check CHECK (
    budget_range IN (
      'under_1500', '1500_2999', '3000_4999', '5000_or_more', 'budget_guidance',
      'under_500', '500_1500', '1500_3000', 'over_3000', 'unsure'
    )
  );
