import type { APIContext } from 'astro';
import { sessionLifetimeSeconds } from './auth';

export class RequestInputError extends Error {}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function rejectCrossOriginWrite(context: APIContext): Response | null {
  const origin = context.request.headers.get('origin');
  const allowedOrigins = new Set([new URL(context.request.url).origin]);
  if (process.env.SITE_URL) allowedOrigins.add(new URL(process.env.SITE_URL).origin);
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
    allowedOrigins.add(new URL(
      railwayDomain.startsWith('http://') || railwayDomain.startsWith('https://')
        ? railwayDomain
        : `https://${railwayDomain}`,
    ).origin);
  }
  for (const configuredOrigin of process.env.ADDITIONAL_ALLOWED_ORIGINS?.split(',') ?? []) {
    if (configuredOrigin.trim()) allowedOrigins.add(new URL(configuredOrigin.trim()).origin);
  }
  if (!origin || !allowedOrigins.has(origin)) {
    return json({ error: 'Ungültige Anfragequelle.' }, 403);
  }
  return null;
}

export function sessionCookie(context: APIContext, token: string): void {
  const secureCookie = new URL(import.meta.env.SITE ?? context.request.url).protocol === 'https:';
  context.cookies.set('iftiin_session', token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionLifetimeSeconds,
  });
}

export function clearSessionCookie(context: APIContext): void {
  context.cookies.delete('iftiin_session', { path: '/' });
}

export async function requestJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new RequestInputError('Die Anfrage muss JSON enthalten.');
  }
  const body = await request.text();
  if (body.length > 512_000) throw new RequestInputError('Die Anfrage ist zu groß.');
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new RequestInputError('Die Anfrage enthält kein gültiges JSON.');
  }
}
