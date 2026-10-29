import { randomUUID } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { query } from './db';

const maximumUploadBytes = 500 * 1024 * 1024;
const allowedContentTypes = new Set([
  'application/pdf',
  'application/zip',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

type StorageConfiguration = {
  bucket: string;
  client: S3Client;
};

let storageConfiguration: StorageConfiguration | undefined;

function getStorageConfiguration(): StorageConfiguration {
  if (storageConfiguration) return storageConfiguration;
  const endpoint = process.env.STORAGE_ENDPOINT;
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  const region = process.env.STORAGE_REGION;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !region) {
    throw new Error('Privater Dateispeicher ist nicht vollständig konfiguriert.');
  }
  const endpointUrl = new URL(endpoint);
  if (process.env.NODE_ENV === 'production' && endpointUrl.protocol !== 'https:') {
    throw new Error('Der Dateispeicher muss in Produktion HTTPS verwenden.');
  }
  storageConfiguration = {
    bucket,
    client: new S3Client({
      endpoint: endpointUrl.toString(),
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
  return storageConfiguration;
}

export async function createUploadAsset(
  userId: string,
  filename: string,
  contentType: string,
  byteSize: number,
): Promise<{ id: string; uploadUrl: string; headers: Record<string, string>; expiresIn: number }> {
  if (!allowedContentTypes.has(contentType)) throw new Error('Dieser Dateityp ist nicht zugelassen.');
  if (!Number.isSafeInteger(byteSize) || byteSize < 1 || byteSize > maximumUploadBytes) {
    throw new Error('Die Datei muss zwischen 1 Byte und 500 MB groß sein.');
  }
  const originalFilename = filename.trim().replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180);
  if (!originalFilename) throw new Error('Der Dateiname ist ungültig.');
  const config = getStorageConfiguration();
  const id = randomUUID();
  const objectKey = `private/${id}`;
  await query(
    `INSERT INTO storage_assets (id, object_key, original_filename, content_type, byte_size, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, objectKey, originalFilename, contentType, byteSize, userId],
  );
  const uploadUrl = await getSignedUrl(
    config.client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      ContentType: contentType,
    }),
    { expiresIn: 300 },
  );
  return {
    id,
    uploadUrl,
    headers: { 'Content-Type': contentType },
    expiresIn: 300,
  };
}

export async function confirmUploadedAsset(assetId: string): Promise<void> {
  const config = getStorageConfiguration();
  const result = await query<{
    object_key: string;
    content_type: string;
    byte_size: string;
    status: string;
  }>(
    'SELECT object_key, content_type, byte_size, status FROM storage_assets WHERE id = $1',
    [assetId],
  );
  const asset = result.rows[0];
  if (!asset) throw new Error('Datei nicht gefunden.');
  if (asset.status === 'ready') return;
  if (asset.status !== 'pending') throw new Error('Datei kann nicht bestätigt werden.');

  const head = await config.client.send(new HeadObjectCommand({
    Bucket: config.bucket,
    Key: asset.object_key,
  }));
  if (head.ContentLength !== Number(asset.byte_size) || head.ContentType !== asset.content_type) {
    throw new Error('Die hochgeladene Datei entspricht nicht den erwarteten Angaben.');
  }
  await query(
    `UPDATE storage_assets SET status = 'ready', updated_at = NOW()
     WHERE id = $1 AND status = 'pending'`,
    [assetId],
  );
}

export async function createPrivateDownloadUrl(assetId: string, inline = false): Promise<string> {
  const config = getStorageConfiguration();
  const result = await query<{
    object_key: string;
    original_filename: string;
    status: string;
  }>(
    `SELECT object_key, original_filename, status
     FROM storage_assets WHERE id = $1`,
    [assetId],
  );
  const asset = result.rows[0];
  if (!asset || asset.status !== 'ready') throw new Error('Datei ist nicht verfügbar.');
  const filename = asset.original_filename.replace(/["\\\r\n]/g, '_');
  return getSignedUrl(
    config.client,
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: asset.object_key,
      ResponseContentDisposition: `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
    }),
    { expiresIn: 120 },
  );
}

export function isAllowedAssetType(contentType: string): boolean {
  return allowedContentTypes.has(contentType);
}
