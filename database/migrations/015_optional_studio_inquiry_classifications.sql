ALTER TABLE studio_inquiries
  ALTER COLUMN professional_background DROP NOT NULL,
  ALTER COLUMN challenge_category DROP NOT NULL,
  ALTER COLUMN desired_outcome DROP NOT NULL,
  ALTER COLUMN ai_experience DROP NOT NULL;
