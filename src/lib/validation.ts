import { z } from 'astro/zod';
import { pillars, formatNames } from '../config';

export const credentialsSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
});

export const registrationSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(1).max(80).transform((name) => name.replace(/\s+/g, ' ')),
});

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform((email) => email.toLowerCase()),
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: z.string().min(12).max(128),
});

export const productInputSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  productType: z.enum(['digital_download', 'premium_article', 'online_course', 'bundle', 'membership']),
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(2000),
  status: z.enum(['draft', 'active', 'archived']),
  amountCents: z.number().int().min(50).max(100_000_000),
  currency: z.literal('eur'),
  billingInterval: z.enum(['one_time', 'month', 'year']),
  coverAssetId: z.uuid().nullable(),
  contentIds: z.array(z.uuid()).max(100)
    .refine((ids) => new Set(ids).size === ids.length, 'Inhalte dürfen nicht doppelt zugeordnet werden.'),
}).refine((product) => product.productType === 'membership' || product.billingInterval === 'one_time', {
  path: ['billingInterval'],
  message: 'Wiederkehrende Preise sind nur für Membership-Produkte zulässig.',
});

export const contentItemInputSchema = z.object({
  contentType: z.enum(['download', 'lesson', 'video']),
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000),
  body: z.string().max(100_000),
  storageAssetId: z.uuid().nullable(),
  status: z.enum(['draft', 'published', 'archived']),
  position: z.number().int().min(0).max(10_000),
});

export const learningProgressSchema = z.object({
  progressPercent: z.number().int().min(0).max(100),
  lastPositionSeconds: z.number().int().min(0).max(604_800),
});

const pillarSlugs = pillars.map((pillar) => pillar.slug) as [string, ...string[]];
const articleFormats = Object.keys(formatNames) as [string, ...string[]];

export const articleInputSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().min(1).max(500),
  body: z.string().max(300_000),
  date: z.string().refine(isCalendarDate),
  updated: z.string().refine(isCalendarDate).nullable(),
  pillar: z.enum(pillarSlugs),
  format: z.enum(articleFormats),
  status: z.enum(['draft', 'published']),
  featured: z.boolean(),
  videoUrl: z.url({ protocol: /^https?$/ }).max(2048).nullable(),
  loginRequired: z.boolean(),
  requiresPurchase: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  sources: z.array(z.object({
    label: z.string().trim().min(1).max(180),
    url: z.url({ protocol: /^https?$/ }).max(2048),
  })).max(50),
}).refine((article) => {
  if (article.format === 'video') {
    return article.videoUrl !== null && isSupportedVideoUrl(article.videoUrl);
  }
  return article.videoUrl === null && !article.loginRequired;
}, {
  path: ['videoUrl'],
  message: 'Video-Beiträge brauchen einen gültigen YouTube- oder Vimeo-Link. Video-Felder sind bei anderen Formaten nicht erlaubt.',
});

function isSupportedVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const isYouTube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host);
    const isVimeo = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host);
    if (!isYouTube && !isVimeo) return false;
    return Boolean(getVideoEmbedUrl(value));
  } catch {
    return false;
  }
}

export function getVideoEmbedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
      const id = host === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('v') ??
          url.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})(?:\/|$)/)?.[1];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : null;
    }
    if (['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'].includes(host)) {
      const id = host === 'player.vimeo.com'
        ? url.pathname.match(/^\/video\/(\d+)(?:\/|$)/)?.[1]
        : url.pathname.match(/^\/(\d+)(?:\/|$)/)?.[1];
      const hash = url.searchParams.get('h') ??
        (host !== 'player.vimeo.com' ? url.pathname.match(/^\/\d+\/([a-zA-Z0-9]+)(?:\/|$)/)?.[1] : null);
      if (!id) return null;
      const embed = new URL(`https://player.vimeo.com/video/${id}`);
      if (hash && /^[a-zA-Z0-9]+$/.test(hash)) embed.searchParams.set('h', hash);
      return embed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
