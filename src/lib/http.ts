import type { APIContext } from 'astro';
import { sessionLifetimeSeconds } from './auth';

export class RequestInputError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = 'RequestInputError';
  }
}

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

export function guestAccessCookie(context: APIContext, token: string): void {
  const secureCookie = new URL(import.meta.env.SITE ?? context.request.url).protocol === 'https:';
  context.cookies.set('iftiin_guest_access', token, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearGuestAccessCookie(context: APIContext): void {
  context.cookies.delete('iftiin_guest_access', { path: '/' });
}

export async function requestJson(request: Request, maxBytes = 512_000): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new RequestInputError('Die Anfrage muss JSON enthalten.');
  }
  const contentLength = request.headers.get('content-length');
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    throw new RequestInputError('Die Anfrage ist zu groß.', 413);
  }

  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          reader.cancel().catch((error: unknown) => {
            console.error('Übergroßer Request-Body konnte nicht abgebrochen werden:', error instanceof Error ? error.name : 'unknown');
          });
          throw new RequestInputError('Die Anfrage ist zu groß.', 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const body = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new RequestInputError('Die Anfrage enthält kein gültiges JSON.');
  }
}
