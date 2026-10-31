UPDATE articles
SET pillar = 'skills-agency',
    updated_at = NOW()
WHERE pillar = 'systems-power'
  AND lower(concat_ws(' ', title, description, body, array_to_string(tags, ' '))) ~
    '(interdisziplin|interdisciplin|perspektivwechsel|perspective[- ]taking)'
  AND lower(concat_ws(' ', title, description, body, array_to_string(tags, ' '))) !~
    '(gesellschaft|societ|social impact|propaganda|medien|media|kultur|culture|narrativ|narrative|organisationslogik|organizational.{0,12}logic|institution|governance|wirtschaft|economy|macht|power|infrastruktur|infrastructure|wissensproduktion|knowledge[ -]production)';
