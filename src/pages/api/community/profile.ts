import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { getSessionAccount } from '../../../lib/auth';
import { communityInterestValues, getCommunityProfile, saveCommunityProfile } from '../../../lib/community';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../lib/http';

function validWebsite(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && Boolean(url.hostname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function validLinkedInUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && ['linkedin.com', 'www.linkedin.com'].includes(url.hostname.toLowerCase())
      && /^\/in\/[A-Za-z0-9._%-]+\/?$/.test(url.pathname)
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function validPictureUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

const expertiseSchema = z.array(
  z.string().trim().min(1).max(40).transform((tag) => tag.replace(/\s+/g, ' ')),
).max(8).refine(
  (tags) => new Set(tags.map((tag) => tag.toLowerCase())).size === tags.length,
);

const profileSchema = z.object({
  headline: z.string().trim().max(120),
  bio: z.string().trim().max(1000),
  location: z.string().trim().max(120),
  personalLearningGoals: z.string().trim().max(1000),
  website: z.string().trim().max(2048).refine(validWebsite),
  linkedinUrl: z.string().trim().max(2048).refine(validLinkedInUrl),
  profilePictureUrl: z.string().trim().max(2048).refine(validPictureUrl),
  interests: z.array(z.enum(communityInterestValues)).max(communityInterestValues.length)
    .refine((interests) => new Set(interests).size === interests.length),
  expertise: expertiseSchema,
  isVisible: z.boolean(),
  showDisplayName: z.boolean(),
  showHeadline: z.boolean(),
  showBio: z.boolean(),
  showLocation: z.boolean(),
  showWebsite: z.boolean(),
  showLinkedIn: z.boolean(),
  showProfilePicture: z.boolean(),
  showInterests: z.boolean(),
  showExpertise: z.boolean(),
});

export const GET: APIRoute = async (context) => {
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    return json({ profile: await getCommunityProfile(account.id) });
  } catch (error) {
    console.error('Community-Profil konnte nicht geladen werden:', error);
    return json({ error: 'Das Profil konnte nicht geladen werden.' }, 500);
  }
};

export const PUT: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);

    const parsed = profileSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) {
      return json({ error: 'Bitte überprüfe deine Profilangaben und die ausgewählten öffentlichen Felder.' }, 400);
    }

    const profile = await saveCommunityProfile(account.id, parsed.data);
    return json({ profile });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, error.status);
    console.error('Community-Profil konnte nicht gespeichert werden:', error);
    return json({ error: 'Das Profil konnte nicht gespeichert werden.' }, 500);
  }
};
