import type { APIRoute } from 'astro';
import { getSessionAccount } from '../../../lib/auth';
import { communityInterestValues, listCommunityMembers, type CommunityInterest } from '../../../lib/community';
import { json } from '../../../lib/http';

export const GET: APIRoute = async (context) => {
  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);
    const url = new URL(context.request.url);
    const search = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
    const requestedInterest = url.searchParams.get('interest') ?? '';
    if (requestedInterest && !communityInterestValues.includes(requestedInterest as CommunityInterest)) {
      return json({ error: 'Das ausgewählte Interesse ist ungültig.' }, 400);
    }
    const interest = communityInterestValues.includes(requestedInterest as CommunityInterest)
      ? requestedInterest as CommunityInterest
      : '';
    return json({ members: await listCommunityMembers({ search, interest }) });
  } catch (error) {
    console.error('Community-Mitglieder konnten nicht geladen werden:', error);
    return json({ error: 'Die Community konnte nicht geladen werden.' }, 500);
  }
};
