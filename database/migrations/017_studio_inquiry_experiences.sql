ALTER TABLE studio_inquiries
  ADD COLUMN experience_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD CONSTRAINT studio_inquiries_experience_ids_check CHECK (
    experience_ids <@ ARRAY['content', 'research', 'business']::TEXT[]
  );
