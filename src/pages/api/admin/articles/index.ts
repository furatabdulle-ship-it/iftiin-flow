import type { APIRoute } from 'astro';
import { allArticles } from '../../../../lib/articles';
import { getSessionAccount } from '../../../../lib/auth';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { query } from '../../../../lib/db';
import { articleInputSchema } from '../../../../lib/validation';

async function requireAdmin(context: Parameters<APIRoute>[0]) {
  const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
  if (!account) return json({ error: 'Bitte melde dich zuerst an.' }, 401);
  if (account.role !== 'admin') return json({ error: 'Du hast keine Admin-Berechtigung.' }, 403);
  return account;
}

export const GET: APIRoute = async (context) => {
  try {
    const admin = await requireAdmin(context);
    if (admin instanceof Response) return admin;
    return json({ articles: await allArticles() });
  } catch (error) {
    console.error('Admin-Beiträge konnten nicht geladen werden:', error);
    return json({ error: 'Beiträge konnten nicht geladen werden.' }, 500);
  }
};

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (admin instanceof Response) return admin;
    const parsed = articleInputSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({
      error: 'Die Artikeldaten sind ungültig.',
      details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    }, 400);
    const article = parsed.data;
    const result = await query(
      `INSERT INTO articles
        (slug, title, description, body, date, updated, pillar, format, status, featured,
         video_url, login_required, tags, sources)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id`,
      [
        article.slug, article.title, article.description, article.body, article.date,
        article.updated, article.pillar, article.format, article.status,
        article.featured, article.videoUrl, article.loginRequired,
        article.tags, JSON.stringify(article.sources),
      ],
    );
    return json({ id: result.rows[0].id }, 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return json({ error: 'Dieser URL-Slug wird bereits verwendet.' }, 409);
    }
    console.error('Artikel konnte nicht erstellt werden:', error);
    return json({ error: 'Der Artikel konnte nicht erstellt werden.' }, 500);
  }
};
