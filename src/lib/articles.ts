import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { QueryResultRow } from 'pg';
import type { Locale } from './i18n';
import { query } from './db';

export type ArticleStatus = 'draft' | 'published';
export type ArticleSource = { label: string; url: string };
export type ArticleRecord = {
  id: string;
  slug: string;
  body: string;
  bodyEn: string | null;
  data: {
    title: string;
    titleEn: string | null;
    description: string;
    descriptionEn: string | null;
    date: Date;
    updated: Date | null;
    pillar: string;
    format: string;
    status: ArticleStatus;
    visibility: 'public' | 'community';
    featured: boolean;
    videoUrl: string | null;
    loginRequired: boolean;
    requiresPurchase: boolean;
    tags: string[];
    sources: ArticleSource[];
  };
};

type ArticleRow = QueryResultRow & {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  description: string;
  description_en: string | null;
  body_en: string | null;
  date: Date | string;
  updated: Date | string | null;
  pillar: string;
  format: string;
  status: ArticleStatus;
  visibility: 'public' | 'community';
  featured: boolean;
  video_url: string | null;
  login_required: boolean;
  requires_purchase: boolean;
  tags: string[];
  sources: ArticleSource[];
  body: string;
};

const articleColumns = `id, slug, title, title_en, description, description_en, body_en, date, updated, pillar,
  format, status, visibility, featured, video_url, login_required, requires_purchase, tags, sources, body`;
const exploreTopicPatterns = [
  '%future skill%',
  '%skills literacy%',
  '%skills snapshot%',
  '%zukunftskompetenz%',
  '%ai literacy%',
  '%ki-literacy%',
  '%ki kompetenz%',
  '%ki-kompetenz%',
  '%artificial intelligence literacy%',
  '%media literacy%',
  '%medienkompetenz%',
  '%storytelling%',
];

function fromRow(row: ArticleRow): ArticleRecord {
  const asDate = (value: Date | string | null) => {
    if (!value) return null;
    return value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  };

  return {
    id: row.id,
    slug: row.slug,
    body: row.body,
    bodyEn: row.body_en,
    data: {
      title: row.title,
      titleEn: row.title_en,
      description: row.description,
      descriptionEn: row.description_en,
      date: asDate(row.date) as Date,
      updated: asDate(row.updated),
      pillar: row.pillar,
      format: row.format,
      status: row.status,
      visibility: row.visibility,
      featured: row.featured,
      videoUrl: row.video_url,
      loginRequired: row.login_required,
      requiresPurchase: row.requires_purchase,
      tags: row.tags,
      sources: row.sources,
    },
  };
}

function localizeArticle(article: ArticleRecord, locale: Locale): ArticleRecord {
  if (locale === 'de') return article;
  return {
    ...article,
    body: article.bodyEn ?? article.body,
    data: {
      ...article.data,
      title: article.data.titleEn ?? article.data.title,
      description: article.data.descriptionEn ?? article.data.description,
    },
  };
}

function englishTranslationFilter(locale: Locale): string {
  if (locale !== 'en') return '';
  return `AND NULLIF(BTRIM(title_en), '') IS NOT NULL
          AND NULLIF(BTRIM(description_en), '') IS NOT NULL
          AND (NULLIF(BTRIM(body), '') IS NULL OR NULLIF(BTRIM(body_en), '') IS NOT NULL)`;
}

export async function publishedArticles(includeRestricted = false, locale: Locale = 'de'): Promise<ArticleRecord[]> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE status = 'published' AND ($1::boolean OR login_required = FALSE)
       AND ($1::boolean OR visibility = 'public')
       ${englishTranslationFilter(locale)}
     ORDER BY date DESC, created_at DESC`,
    [includeRestricted],
  );
  return result.rows.map(fromRow).map((article) => localizeArticle(article, locale));
}

export async function featuredArticles(limit = 3, includeRestricted = false, locale: Locale = 'de'): Promise<ArticleRecord[]> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE status = 'published' AND ($2::boolean OR login_required = FALSE)
       AND ($2::boolean OR visibility = 'public')
       ${englishTranslationFilter(locale)}
     ORDER BY featured DESC, date DESC
     LIMIT $1`,
    [limit, includeRestricted],
  );
  return result.rows.map(fromRow).map((article) => localizeArticle(article, locale));
}

export async function exploreArticles(
  locale: Locale = 'de',
  limit?: number,
  includeCommunity = false,
): Promise<ArticleRecord[]> {
  const limitClause = limit === undefined ? '' : 'LIMIT $4';
  const values: unknown[] = [['essay', 'map'], exploreTopicPatterns, includeCommunity];
  if (limit !== undefined) values.push(limit);
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE status = 'published' AND login_required = FALSE AND requires_purchase = FALSE
       AND ($3::boolean OR visibility = 'public')
       AND format = ANY($1::text[])
       AND lower(concat_ws(' ', slug, title, title_en, description, description_en, array_to_string(tags, ' ')))
         LIKE ANY($2::text[])
       ${englishTranslationFilter(locale)}
     ORDER BY featured DESC, date DESC, created_at DESC
     ${limitClause}`,
    values,
  );
  return result.rows.map(fromRow).map((article) => localizeArticle(article, locale));
}

export async function allArticles(): Promise<ArticleRecord[]> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     ORDER BY updated_at DESC, created_at DESC`,
  );
  return result.rows.map(fromRow);
}

export async function getPublishedArticle(
  slug: string,
  locale: Locale = 'de',
  includeCommunity = false,
): Promise<ArticleRecord | null> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE slug = $1 AND status = 'published'
       AND ($2::boolean OR visibility = 'public')
       ${englishTranslationFilter(locale)}`,
    [slug, includeCommunity],
  );
  return result.rows[0] ? localizeArticle(fromRow(result.rows[0]), locale) : null;
}

export async function renderArticleMarkdown(markdown: string): Promise<string> {
  const html = await marked.parse(markdown, { gfm: true, async: true });
  return sanitizeHtml(html, {
    allowedTags: [
      'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'strong', 'em', 'del', 'blockquote',
      'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a',
    ],
    allowedAttributes: { a: ['href', 'name', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
  });
}
