import type { APIRoute } from 'astro';
import { getSessionAccount, updateAccountDisplayName } from '../../../lib/auth';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../lib/http';
import { z } from 'astro/zod';

const displayNameSchema = z.object({
  displayName: z.string().trim().min(1).max(80).transform((name) => name.replace(/\s+/g, ' ')),
});

export const PUT: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const account = await getSessionAccount(context.cookies.get('iftiin_session')?.value);
    if (!account) return json({ error: 'Bitte melde dich an.' }, 401);

    const parsed = displayNameSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({ error: 'Bitte gib einen Namen mit höchstens 80 Zeichen ein.' }, 400);

    const updatedAccount = await updateAccountDisplayName(account.id, parsed.data.displayName);
    if (!updatedAccount) return json({ error: 'Das Konto wurde nicht gefunden.' }, 404);
    return json({ account: updatedAccount });
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    console.error('Anzeigename konnte nicht gespeichert werden:', error);
    return json({ error: 'Der Name konnte nicht gespeichert werden. Bitte versuche es später erneut.' }, 500);
  }
};
