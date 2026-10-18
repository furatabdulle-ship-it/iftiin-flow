import { createHash } from 'node:crypto';
import type { APIContext } from 'astro';
import { json } from './http';

type LimitEntry = { count: number; expiresAt: number };
const limits = new Map<string, LimitEntry>();

export function rateLimit(
  context: APIContext,
  action: string,
  maximum: number,
  windowMilliseconds: number,
): Response | null {
  const forwardedAddress = process.env.TRUST_PROXY_HEADERS === 'true'
    ? context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    : undefined;
  const address = forwardedAddress || context.clientAddress;
  const addressHash = createHash('sha256').update(address).digest('hex');
  const key = `${action}:${addressHash}`;
  const now = Date.now();
  const current = limits.get(key);
  if (!current && limits.size >= 5_000) {
    for (const [entryKey, value] of limits) {
      if (value.expiresAt <= now) limits.delete(entryKey);
    }
    if (limits.size >= 5_000) {
      return json({ error: 'Der Anmeldedienst ist ausgelastet. Bitte versuche es später erneut.' }, 503);
    }
  }
  const entry = current && current.expiresAt > now
    ? { count: current.count + 1, expiresAt: current.expiresAt }
    : { count: 1, expiresAt: now + windowMilliseconds };
  limits.set(key, entry);

  if (entry.count <= maximum) return null;
  const retryAfter = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
  const response = json({ error: 'Zu viele Versuche. Bitte warte und versuche es später erneut.' }, 429);
  response.headers.set('Retry-After', String(retryAfter));
  return response;
}

export function clearRateLimit(context: APIContext, action: string): void {
  const forwardedAddress = process.env.TRUST_PROXY_HEADERS === 'true'
    ? context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    : undefined;
  const address = forwardedAddress || context.clientAddress;
  const addressHash = createHash('sha256').update(address).digest('hex');
  limits.delete(`${action}:${addressHash}`);
}
