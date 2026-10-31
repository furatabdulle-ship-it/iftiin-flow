import { defineMiddleware } from 'astro:middleware';
import type { Locale } from './lib/i18n';

function isLocale(value: string | undefined): value is Locale {
  return value === 'de' || value === 'en';
}

export const onRequest = defineMiddleware(async (context, next) => {
  const requestedLocale = context.url.searchParams.get('lang') ?? undefined;
  const cookieLocale = context.cookies.get('iftiin_lang')?.value;
  const preferredLocale = isLocale(requestedLocale)
    ? requestedLocale
    : isLocale(cookieLocale) ? cookieLocale : 'de';
  const isAdminRoute = context.url.pathname === '/admin' || context.url.pathname.startsWith('/admin/');
  const locale = isAdminRoute ? 'de' : preferredLocale;
  context.locals.locale = locale;
  if (isLocale(requestedLocale) && !isAdminRoute) {
    context.cookies.set('iftiin_lang', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
      httpOnly: true,
      secure: import.meta.env.PROD,
    });
  }
  const response = await next();
  if (response instanceof Response) {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  }
  return response;
});
