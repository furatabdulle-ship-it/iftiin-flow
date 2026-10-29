import type { APIContext } from 'astro';
import { getSessionAccount, type Account } from './auth';
import { json } from './http';

export async function requireAdmin(context: APIContext): Promise<Account | Response> {
  const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
  if (!account) return json({ error: 'Bitte melde dich zuerst an.' }, 401);
  if (account.role !== 'admin') return json({ error: 'Du hast keine Admin-Berechtigung.' }, 403);
  return account;
}

export function isHttpResponse(value: Account | Response): value is Response {
  return value instanceof Response;
}
