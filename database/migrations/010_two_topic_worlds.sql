ALTER TABLE articles DROP CONSTRAINT articles_pillar_check;

UPDATE articles
SET pillar = CASE
  WHEN pillar IN ('institutions-work-power', 'culture-meaning') THEN 'systems-power'
  WHEN pillar = 'human-capability' THEN 'skills-agency'
  WHEN lower(concat_ws(' ', title, description, body, array_to_string(tags, ' '))) ~
    '(gesellschaft|societ|social|medien|media|propaganda|kultur|culture|narrativ|narrative|organisationslogik|organizational.{0,12}logic|institution|governance|wirtschaft|economy|macht|power|infrastruktur|infrastructure|wissensproduktion|knowledge[ -]production|politik|politic|arbeitswelt|arbeitsmarkt|arbeitsbedingungen|auswirkungen.{0,30}arbeit|impact.{0,30}work|workforce|workplace|labou?r)'
    THEN 'systems-power'
  ELSE 'skills-agency'
END,
updated_at = NOW()
WHERE pillar IN (
  'knowledge-agency',
  'ai-domain',
  'institutions-work-power',
  'human-capability',
  'culture-meaning'
);

ALTER TABLE articles
  ADD CONSTRAINT articles_pillar_check CHECK (pillar IN ('systems-power', 'skills-agency'));
