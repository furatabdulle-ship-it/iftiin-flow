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
  featured: boolean;
  video_url: string | null;
  login_required: boolean;
  requires_purchase: boolean;
  tags: string[];
  sources: ArticleSource[];
  body: string;
};

const articleColumns = `id, slug, title, title_en, description, description_en, body_en, date, updated, pillar,
  format, status, featured, video_url, login_required, requires_purchase, tags, sources, body`;

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

export async function publishedArticles(includeLoginRequired = false, locale: Locale = 'de'): Promise<ArticleRecord[]> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE status = 'published' AND ($1::boolean OR login_required = FALSE)
       ${englishTranslationFilter(locale)}
     ORDER BY date DESC, created_at DESC`,
    [includeLoginRequired],
  );
  return result.rows.map(fromRow).map((article) => localizeArticle(article, locale));
}

export async function featuredArticles(limit = 3, includeLoginRequired = false, locale: Locale = 'de'): Promise<ArticleRecord[]> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE status = 'published' AND ($2::boolean OR login_required = FALSE)
       ${englishTranslationFilter(locale)}
     ORDER BY featured DESC, date DESC
     LIMIT $1`,
    [limit, includeLoginRequired],
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

export async function getPublishedArticle(slug: string, locale: Locale = 'de'): Promise<ArticleRecord | null> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE slug = $1 AND status = 'published'
       ${englishTranslationFilter(locale)}`,
    [slug],
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
