import { z } from 'astro/zod';
import { pillars, formatNames } from '../config';

export const credentialsSchema = z.object({
  email: z.string().trim().max(254).pipe(z.email()).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(128),
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
