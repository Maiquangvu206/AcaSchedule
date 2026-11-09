import { Client } from 'minio';
import { env } from '../config/env';
import { logger } from './logger';

export const minioClient = new Client({
  endPoint: env.MINIO_ENDPOINT,
  port: env.MINIO_PORT,
  useSSL: env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
  region: env.MINIO_REGION,
});

/**
 * Used only for presigned URLs returned to the browser. Behind Docker Compose the
 * internal host `minio` is not resolvable from the user's machine, so URLs must be
 * signed with the published host/port instead.
 */
export const minioPublicClient = new Client({
  endPoint: env.MINIO_PUBLIC_ENDPOINT ?? env.MINIO_ENDPOINT,
  port: env.MINIO_PUBLIC_PORT ?? env.MINIO_PORT,
  useSSL: env.MINIO_PUBLIC_USE_SSL ?? env.MINIO_USE_SSL,
  accessKey: env.MINIO_ACCESS_KEY,
  secretKey: env.MINIO_SECRET_KEY,
  // The public host (localhost:19000) is only reachable from the browser, not
  // from inside the backend container, so skip the bucket-region lookup call.
  region: env.MINIO_REGION,
});

const RETRY_DELAYS_MS = [500, 1_500, 3_000];

/**
 * Ensure the documents bucket exists. Idempotent and safe to call on every boot.
 * Throws only when all retries fail (caller decides whether to abort).
 */
export async function ensureBucket(): Promise<void> {
  const bucket = env.MINIO_BUCKET;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        await minioClient.makeBucket(bucket);
        logger.info({ bucket }, 'MinIO bucket created');
      } else {
        logger.info({ bucket }, 'MinIO bucket ready');
      }
      return;
    } catch (error) {
      if (attempt === RETRY_DELAYS_MS.length) {
        throw error;
      }
      logger.warn(
        { err: error, bucket, attempt: attempt + 1 },
        'MinIO not ready — retrying',
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

export async function isBucketReady(): Promise<boolean> {
  try {
    return await minioClient.bucketExists(env.MINIO_BUCKET);
  } catch {
    return false;
  }
}
