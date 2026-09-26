/**
 * Object storage.
 *  - Prescriptions  -> Neon object storage (S3 compatible)   [STORAGE_PROVIDER=s3]
 *  - Recordings     -> Cloudflare R2 (S3 compatible)
 *  - memory provider is used by the automated tests.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import env from "../config/env.js";
import logger from "../utils/logger.js";
import AppError from "../utils/AppError.js";

const memoryStore = new Map();
let prescriptionClient = null;
let r2Client = null;

function getPrescriptionClient() {
  if (!prescriptionClient) {
    prescriptionClient = new S3Client({
      endpoint: env.storage.endpoint,
      region: env.storage.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.storage.accessKeyId,
        secretAccessKey: env.storage.secretAccessKey,
      },
    });
  }
  return prescriptionClient;
}

export const isR2Configured = () =>
  Boolean(
    env.r2.accountId &&
    env.r2.accessKeyId &&
    env.r2.secretAccessKey &&
    env.r2.bucket,
  );

function getR2Client() {
  if (!r2Client) {
    r2Client = new S3Client({
      endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
      region: "auto",
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }
  return r2Client;
}

/** Upload a prescription PDF; returns { key, url } */
export async function putPrescription(key, buffer) {
  if (env.storage.provider === "memory") {
    memoryStore.set(key, buffer);
    return { key, url: `memory://${env.storage.bucket}/${key}` };
  }
  await getPrescriptionClient().send(
    new PutObjectCommand({
      Bucket: env.storage.bucket,
      Key: key,
      Body: buffer,
      ContentType: "application/pdf",
    }),
  );
  const url = `${env.storage.endpoint.replace(/\/+$/, "")}/${env.storage.bucket}/${key}`;
  logger.info(`Prescription uploaded: ${url}`);
  return { key, url };
}

/** Read a prescription PDF back as a Buffer */
export async function getPrescription(key) {
  if (env.storage.provider === "memory") {
    const buf = memoryStore.get(key);
    if (!buf) throw AppError.notFound("Prescription file not found");
    return buf;
  }
  try {
    const res = await getPrescriptionClient().send(
      new GetObjectCommand({ Bucket: env.storage.bucket, Key: key }),
    );
    return Buffer.from(await res.Body.transformToByteArray());
  } catch (err) {
    logger.error("Prescription download failed", err.message);
    throw AppError.notFound("Prescription file not found in storage");
  }
}

/** Delete a prescription PDF (used by test / e2e cleanup) */
export async function deletePrescription(key) {
  if (!key) return;
  if (env.storage.provider === "memory") {
    memoryStore.delete(key);
    return;
  }
  await getPrescriptionClient().send(
    new DeleteObjectCommand({ Bucket: env.storage.bucket, Key: key }),
  );
  logger.info(`Prescription deleted from storage: ${key}`);
}

/** Stream a recording (readable stream) to Cloudflare R2 */
export async function putRecordingStream(
  key,
  stream,
  contentType = "video/mp4",
) {
  if (!isR2Configured()) throw new Error("Cloudflare R2 is not configured");
  const upload = new Upload({
    client: getR2Client(),
    params: {
      Bucket: env.r2.bucket,
      Key: key,
      Body: stream,
      ContentType: contentType,
    },
    queueSize: 4,
    partSize: 8 * 1024 * 1024,
  });
  await upload.done();
  const url = env.r2.publicBaseUrl
    ? `${env.r2.publicBaseUrl}/${key}`
    : `r2://${env.r2.bucket}/${key}`;
  logger.info(`Recording uploaded to R2: ${url}`);
  return { key, url };
}
