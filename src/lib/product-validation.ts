import { initialProductTypes } from './commerce';
import { query } from './db';
import { json } from './http';

export async function validateProductContentLinks(
  contentIds: string[],
  productType: string,
  active: boolean,
): Promise<Response | null> {
  if (active && !initialProductTypes.includes(productType as typeof initialProductTypes[number])) {
    return json({ error: 'Dieser Produkttyp ist noch nicht zur Veröffentlichung freigegeben.' }, 400);
  }
  if (active && contentIds.length === 0) {
    return json({ error: 'Ein aktives Produkt muss mindestens einen Inhalt freischalten.' }, 400);
  }
  if (contentIds.length === 0) return null;

  const result = await query<{ id: string; content_type: string; status: string }>(
    'SELECT id, content_type, status FROM content_items WHERE id = ANY($1::uuid[])',
    [contentIds],
  );
  if (result.rowCount !== contentIds.length) return json({ error: 'Mindestens ein zugeordneter Inhalt fehlt.' }, 400);
  if (active && result.rows.some((item) => item.status !== 'published')) {
    return json({ error: 'Alle Inhalte eines aktiven Produkts müssen veröffentlicht sein.' }, 400);
  }

  const allowedTypes: Record<string, string[]> = {
    digital_download: ['download'],
    premium_article: ['article'],
    online_course: ['lesson', 'video', 'download'],
    bundle: ['article', 'download', 'lesson', 'video'],
    membership: ['article', 'download', 'lesson', 'video'],
  };
  if (result.rows.some((item) => !allowedTypes[productType]?.includes(item.content_type))) {
    return json({ error: 'Ein Inhaltstyp passt nicht zu diesem Produkttyp.' }, 400);
  }
  if (active && productType === 'online_course' && !result.rows.some((item) => item.content_type === 'lesson')) {
    return json({ error: 'Ein aktiver Online-Kurs benötigt mindestens eine Lektion.' }, 400);
  }
  return null;
}
