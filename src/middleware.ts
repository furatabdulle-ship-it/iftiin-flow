import { defineMiddleware } from 'astro:middleware';
import type { Locale } from './lib/i18n';
import { getSessionAccount } from './lib/auth';
import { hasCommunityAccess } from './lib/community-access';
import { json } from './lib/http';
import { localeHref } from './lib/i18n';
import { scheduleWaitlistCleanup } from './lib/skills-navigator-waitlist';

scheduleWaitlistCleanup();

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
  const pathname = context.url.pathname;
  const communityPage = pathname === '/community' || pathname.startsWith('/community/');
  const communityApi = pathname === '/api/community' || pathname.startsWith('/api/community/');
  const publicCommunityPath = pathname === '/community'
    || pathname === '/community/'
    || pathname === '/community/sprints'
    || pathname === '/community/sprints/';
  const publicSprintApi = pathname === '/api/community/sprints'
    || pathname.startsWith('/api/community/sprints/');
  if ((communityPage && !publicCommunityPath) || (communityApi && !publicSprintApi)) {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) {
      if (communityApi) return json({ error: 'Please sign in to access the IFTIIN Community.' }, 401);
      return context.redirect(localeHref(`/login/?next=${encodeURIComponent(pathname)}`, locale), 302);
    }
    if (!(await hasCommunityAccess(account.id, account.role))) {
      if (communityApi) {
        return json({
          error: 'Community access requires an active online-course entitlement or an approved goal-sprint registration.',
          code: 'COMMUNITY_PARTICIPATION_REQUIRED',
        }, 403);
      }
      return context.redirect(localeHref('/community/', locale), 302);
    }
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
