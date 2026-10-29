import type { APIRoute } from 'astro';
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

export const PUT: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (admin instanceof Response) return admin;
    const { id } = context.params;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return json({ error: 'Ungültige Artikel-ID.' }, 400);
    }

    const parsed = articleInputSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({
      error: 'Die Artikeldaten sind ungültig.',
      details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    }, 400);
    const article = parsed.data;
    const result = await query(
      `UPDATE articles SET
        slug = $2, title = $3, description = $4, body = $5, date = $6, updated = $7,
        pillar = $8, format = $9, status = $10, featured = $11, tags = $12,
        sources = $13, video_url = $14, login_required = $15,
        requires_purchase = $16, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [
        id, article.slug, article.title, article.description, article.body, article.date,
        article.updated, article.pillar, article.format, article.status,
        article.featured, article.tags, JSON.stringify(article.sources),
        article.videoUrl, article.loginRequired, article.requiresPurchase,
      ],
    );
    if (!result.rowCount) return json({ error: 'Artikel nicht gefunden.' }, 404);
    return json({ success: true });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      return json({ error: 'Dieser URL-Slug wird bereits verwendet.' }, 409);
    }
    console.error('Artikel konnte nicht aktualisiert werden:', error);
    return json({ error: 'Der Artikel konnte nicht aktualisiert werden.' }, 500);
  }
};

export const DELETE: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (admin instanceof Response) return admin;
    const { id } = context.params;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return json({ error: 'Ungültige Artikel-ID.' }, 400);
    }
    const result = await query('DELETE FROM articles WHERE id = $1 RETURNING id', [id]);
    if (!result.rowCount) return json({ error: 'Artikel nicht gefunden.' }, 404);
    return json({ success: true });
  } catch (error) {
    console.error('Artikel konnte nicht gelöscht werden:', error);
    return json({ error: 'Der Artikel konnte nicht gelöscht werden.' }, 500);
  }
};
