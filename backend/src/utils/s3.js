import { PutObjectCommand, S3Client, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

export const s3Client = new S3Client({
  region: env.s3.region,
  endpoint: env.s3.endpoint,
  forcePathStyle: env.s3.forcePathStyle,
  credentials: {
    accessKeyId: env.s3.accessKeyId,
    secretAccessKey: env.s3.secretAccessKey,
  },
});

export const ensureBucket = async () => {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: env.s3.bucket }));
    console.log(`[s3] bucket ready: ${env.s3.bucket}`);
  } catch (error) {
    console.warn(`[s3] bucket "${env.s3.bucket}" not reachable (${error.name}); trying to create it`);
    try {
      await s3Client.send(new CreateBucketCommand({ Bucket: env.s3.bucket }));
      console.log(`[s3] bucket created: ${env.s3.bucket}`);
    } catch (createError) {
      console.error(`[s3] could not create bucket: ${createError.message}`);
    }
  }
};

export const uploadPdf = async ({ key, body }) => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.s3.bucket,
      Key: key,
      Body: body,
      ContentType: 'application/pdf',
    }),
  );
  console.log(`[s3] uploaded ${key} (${body.length} bytes)`);
  const url = env.s3.publicBaseUrl
    ? `${env.s3.publicBaseUrl}/${key}`
    : await buildSignedUrl(key);
  return { key, url };
};

export const buildSignedUrl = async (key) => {
  const url = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: env.s3.bucket, Key: key }),
    { expiresIn: env.s3.urlTtlSeconds },
  );
  return url;
};
