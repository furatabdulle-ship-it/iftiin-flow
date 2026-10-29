import type { APIRoute } from 'astro';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { json, rejectCrossOriginWrite } from '../../../../lib/http';
import { confirmUploadedAsset } from '../../../../lib/storage';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PUT: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;
  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const { id } = context.params;
    if (!id || !uuidPattern.test(id)) return json({ error: 'Ungültige Datei-ID.' }, 400);
    await confirmUploadedAsset(id);
    return json({ success: true });
  } catch (error) {
    console.error('Datei-Upload konnte nicht bestätigt werden:', error);
    return json({ error: 'Der Datei-Upload konnte nicht bestätigt werden.' }, 400);
  }
};
