import type { APIRoute } from 'astro';
import { getSessionAccount } from '../../../lib/auth';
import { json } from '../../../lib/http';

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const account = await getSessionAccount(cookies.get('iftiin_session')?.value);
    if (!account) return json({ account: null });
    return json({ account });
  } catch (error) {
    console.error('Sitzung konnte nicht geladen werden:', error);
    return json({ error: 'Die Sitzung konnte nicht geladen werden.' }, 500);
  }
};
