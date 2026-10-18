import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import type { QueryResultRow } from 'pg';
import { query } from './db';

export type ArticleStatus = 'draft' | 'published';
export type ArticleSource = { label: string; url: string };
export type ArticleRecord = {
  id: string;
  slug: string;
  body: string;
  data: {
    title: string;
    description: string;
    date: Date;
    updated: Date | null;
    pillar: string;
    format: string;
    status: ArticleStatus;
    featured: boolean;
    videoUrl: string | null;
    loginRequired: boolean;
    tags: string[];
    sources: ArticleSource[];
  };
};

type ArticleRow = QueryResultRow & {
  id: string;
  slug: string;
  title: string;
  description: string;
  date: Date | string;
  updated: Date | string | null;
  pillar: string;
  format: string;
  status: ArticleStatus;
  featured: boolean;
  video_url: string | null;
  login_required: boolean;
  tags: string[];
  sources: ArticleSource[];
  body: string;
};

const articleColumns = `id, slug, title, description, date, updated, pillar,
  format, status, featured, video_url, login_required, tags, sources, body`;

function fromRow(row: ArticleRow): ArticleRecord {
  const asDate = (value: Date | string | null) => {
    if (!value) return null;
    return value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`);
  };

  return {
    id: row.id,
    slug: row.slug,
    body: row.body,
    data: {
      title: row.title,
      description: row.description,
      date: asDate(row.date) as Date,
      updated: asDate(row.updated),
      pillar: row.pillar,
      format: row.format,
      status: row.status,
      featured: row.featured,
      videoUrl: row.video_url,
      loginRequired: row.login_required,
      tags: row.tags,
      sources: row.sources,
    },
  };
}

export async function publishedArticles(includeLoginRequired = false): Promise<ArticleRecord[]> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE status = 'published' AND ($1::boolean OR login_required = FALSE)
     ORDER BY date DESC, created_at DESC`,
    [includeLoginRequired],
  );
  return result.rows.map(fromRow);
}

export async function featuredArticles(limit = 3, includeLoginRequired = false): Promise<ArticleRecord[]> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE status = 'published' AND ($2::boolean OR login_required = FALSE)
     ORDER BY featured DESC, date DESC
     LIMIT $1`,
    [limit, includeLoginRequired],
  );
  return result.rows.map(fromRow);
}

export async function allArticles(): Promise<ArticleRecord[]> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     ORDER BY updated_at DESC, created_at DESC`,
  );
  return result.rows.map(fromRow);
}

export async function getPublishedArticle(slug: string): Promise<ArticleRecord | null> {
  const result = await query<ArticleRow>(
    `SELECT ${articleColumns} FROM articles
     WHERE slug = $1 AND status = 'published'`,
    [slug],
  );
  return result.rows[0] ? fromRow(result.rows[0]) : null;
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
