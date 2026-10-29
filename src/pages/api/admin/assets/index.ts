import type { APIRoute } from 'astro';
import { isHttpResponse, requireAdmin } from '../../../../lib/admin';
import { json, rejectCrossOriginWrite, requestJson, RequestInputError } from '../../../../lib/http';
import { createUploadAsset, isAllowedAssetType } from '../../../../lib/storage';
import { z } from 'astro/zod';

const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(180),
  contentType: z.string().trim().toLowerCase().refine(isAllowedAssetType),
  byteSize: z.number().int().min(1).max(500 * 1024 * 1024),
});

export const POST: APIRoute = async (context) => {
  const originError = rejectCrossOriginWrite(context);
  if (originError) return originError;

  try {
    const admin = await requireAdmin(context);
    if (isHttpResponse(admin)) return admin;
    const parsed = uploadSchema.safeParse(await requestJson(context.request));
    if (!parsed.success) return json({
      error: 'Dateityp, Name oder Dateigröße sind ungültig.',
      details: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    }, 400);
    return json(await createUploadAsset(
      admin.id,
      parsed.data.filename,
      parsed.data.contentType,
      parsed.data.byteSize,
    ), 201);
  } catch (error) {
    if (error instanceof RequestInputError) return json({ error: error.message }, 400);
    console.error('Privater Datei-Upload konnte nicht vorbereitet werden:', error);
    const message = error instanceof Error && error.message.includes('nicht vollständig konfiguriert')
      ? 'Der private Dateispeicher ist noch nicht konfiguriert.'
      : 'Der Datei-Upload konnte nicht vorbereitet werden.';
    return json({ error: message }, 503);
  }
};
