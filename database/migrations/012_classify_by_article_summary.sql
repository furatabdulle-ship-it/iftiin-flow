UPDATE articles AS article
SET pillar = CASE
  WHEN content.summary ~
    '(gesellschaft|societ|social impact|medien|media|propaganda|kultur|culture|narrativ|narrative|organisationslogik|organizational.{0,12}logic|institution|governance|wirtschaft|economy|macht|power|infrastruktur|infrastructure|wissensproduktion|knowledge[ -]production|politik|politic|arbeitswelt|arbeitsmarkt|arbeitsbedingungen|auswirkungen.{0,30}arbeit|impact.{0,30}work|workforce|workplace|labou?r)'
    THEN 'systems-power'
  WHEN content.summary ~
    '(interdisziplin|interdisciplin|perspektivwechsel|perspective[- ]taking|kritisches denken|critical thinking|kreativ|creativ|ausdruck|expression|storytelling|ki-anwendung|ai application|navigier|navigat|entscheidungsfähigkeit|decision[- ]making|bessere entscheidungen|better decisions|urteilskraft|judgment|agency)'
    THEN 'skills-agency'
  ELSE article.pillar
END,
updated_at = NOW()
FROM (
  SELECT id, lower(concat_ws(' ', title, description, array_to_string(tags, ' '))) AS summary
  FROM articles
) AS content
WHERE article.id = content.id;
