ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS body_en TEXT;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT;

ALTER TABLE content_items
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS body_en TEXT;

CREATE OR REPLACE FUNCTION sync_article_content_item() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO content_items (
    content_type, slug, title, description, body,
    title_en, description_en, body_en, article_id, status
  )
  VALUES (
    'article', NEW.slug, NEW.title, NEW.description, NEW.body,
    NEW.title_en, NEW.description_en, NEW.body_en, NEW.id,
    CASE WHEN NEW.status = 'published' THEN 'published' ELSE 'draft' END
  )
  ON CONFLICT (article_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    body = EXCLUDED.body,
    title_en = EXCLUDED.title_en,
    description_en = EXCLUDED.description_en,
    body_en = EXCLUDED.body_en,
    status = EXCLUDED.status,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_sync_content_item ON articles;
CREATE TRIGGER articles_sync_content_item
AFTER INSERT OR UPDATE OF slug, title, description, body, title_en, description_en, body_en, status ON articles
FOR EACH ROW EXECUTE FUNCTION sync_article_content_item();

UPDATE articles
SET title_en = 'Why Interdisciplinary Work Matters for the Future',
    description_en = 'How different perspectives can help us understand complex challenges and develop solutions that work.',
    body_en = $english_body$
Imagine a city trying to improve its public transport. Engineers design more efficient routes. Data analysts forecast passenger numbers. Economists calculate costs. Yet despite these technical improvements, the underlying problem remains: people are not using the service as expected.

Perhaps stations are not accessible to everyone. Perhaps timetables do not fit the working hours of some communities. Perhaps the planning process overlooks people whose mobility needs differ from those of decision-makers.

Each discipline may do its job exceptionally well — and still, together, miss the problem that matters.

This example points to a defining dilemma of our time: **we organize knowledge into disciplines, while our challenges often extend beyond their boundaries.**

Whether we are dealing with climate change, healthcare, artificial intelligence or the future of work, few questions can be answered through a purely technical, economic, social or political lens.

The essential skill is not knowing as much as possible about everything. It is connecting different forms of knowledge to build a better understanding — and, ultimately, to act more effectively.

## 1. Specialization has taken us far. But it has limits.

The modern knowledge society was built in large part through specialization.

Academic disciplines, professional fields and specialized teams allow us to deepen knowledge systematically, refine methods and handle complex tasks efficiently.

Many of today’s scientific and technological achievements would not exist without specialization.

But this strength has a downside.

The more knowledge is divided into separate fields, the harder it can become to see how they connect. Each field has its own language. Institutions pursue different goals. And a solution that works within one discipline can create unexpected problems elsewhere.

In 2005, the US National Academies described in their report _Facilitating Interdisciplinary Research_ how complex scientific and social problems require the integration of different disciplines. The report also identified institutional barriers: departmental structures, career paths and funding systems often make exactly this kind of collaboration difficult.

The challenge, then, is not to overcome specialization.

**We need to combine deep expertise with the ability to think across disciplinary boundaries.**

## 2. What interdisciplinary work actually means

Bringing different experts together does not automatically make their work interdisciplinary.

Three terms help clarify the difference:

**Multidisciplinary:** Different disciplines work on a shared topic from their own perspectives. Their findings are brought together, but remain largely separate.

**Interdisciplinary:** Different perspectives, methods and insights are integrated. The result is a shared understanding that goes beyond the individual contributions.

**Transdisciplinary:** In addition to academic disciplines, practical knowledge and experience are included — for example, from businesses, public agencies, residents or affected communities.

The OECD considers transdisciplinary research an important approach to complex social challenges. Its 2020 report examines 28 case studies, showing both its potential and its organizational obstacles.

Integration is the key difference.

It is not enough to bring different people to the same table. They need to question their assumptions, clarify their terms and develop new insights together.

Interdisciplinarity is therefore more than an organizational structure.

**It is a way of working with knowledge.**

## 3. Innovation often comes from unexpected connections

New ideas do not always require entirely new knowledge.

Possibilities can change simply by connecting existing insights in unexpected ways.

A widely cited 2013 study by Brian Uzzi and his colleagues examined around 17.9 million scientific publications.

It found that the most frequently cited research tended to combine established knowledge with a small number of unusual combinations of ideas. Work with this pattern was about twice as likely to rank among the most highly cited publications.

This does not prove that unusual combinations automatically cause innovation. Citation counts are not the same as social value, either.

But the study points to an interesting pattern: new things often emerge not through radical originality alone, but by connecting the familiar with the unfamiliar.

This idea applies to many fields.

When education meets technology, new ways of learning become possible. When organizational psychology meets data analysis, decision-making can be reshaped. When designers, engineers and social scientists work together on mobility, they may notice needs that a purely technical analysis would miss.

So the useful question is not only: _What does my discipline know about this problem?_

It is also: **Which perspective are we still missing?**

## 4. Artificial intelligence makes this ability even more relevant

As artificial intelligence becomes more widespread, the way we find, process and apply knowledge is changing.

AI systems can summarize information across fields, identify patterns, develop ideas and support the analysis of complex questions.

That can make it easier to find initial connections between areas of knowledge.

But there is a risk here, too.

A convincing answer is not automatically a correct one. And access to different kinds of information does not mean we understand how they relate.

For example, an AI system might identify ways to automate a task at work. Whether that automation makes sense depends on much more than technical feasibility.

We also need to ask:

* What standard of quality does the result need to meet?
* Which human capabilities will this change strengthen or weaken?
* Who is responsible when things go wrong?
$english_body$
WHERE slug = 'warum-interdisziplinaeres-arbeiten-die-zukunft-ist';

UPDATE products
SET name_en = CASE slug
      WHEN 'stories' THEN 'AI Stories'
      WHEN 'ai-automation-basics' THEN 'AI and Automation'
    END,
    description_en = CASE
      WHEN NULLIF(BTRIM(description), '') IS NULL THEN ''
      ELSE description_en
    END
WHERE slug IN ('stories', 'ai-automation-basics');

UPDATE content_items
SET title_en = title,
    description_en = CASE
      WHEN NULLIF(BTRIM(description), '') IS NULL THEN ''
      ELSE description_en
    END,
    body_en = CASE
      WHEN NULLIF(BTRIM(body), '') IS NULL THEN ''
      ELSE body_en
    END
WHERE article_id IS NULL
  AND title IN ('AI Stories', 'AI and Automation');
