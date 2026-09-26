import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { dataDir, objectStorage } from "./config";
const allowed = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/wav",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
export const MAX_ASSET_BYTES = 100 * 1024 * 1024;
export const isAllowedType = (mime: string) => allowed.has(mime);

function client() {
  if (!process.env.R2_ENDPOINT || !process.env.R2_BUCKET)
    throw new Error("R2 storage is not configured");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}
export async function storeAsset(file: File, workspaceId: string) {
  if (!allowed.has(file.type))
    throw new Error(
      "Unsupported file type. Upload an image, PDF, video, text, or Office document.",
    );
  if (file.size > 100 * 1024 * 1024)
    throw new Error("Files must be smaller than 100 MB.");
  const key = `${workspaceId}/${randomUUID()}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!objectStorage()) {
    const target = path.join(dataDir(), "assets", key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  } else
    await client().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: file.type,
        ContentDisposition: "attachment",
      }),
    );
  return key;
}
export async function assetUrl(key: string, disposition = "inline") {
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ResponseContentDisposition: disposition,
    }),
    { expiresIn: 300 },
  );
}
/** Reads a stored object's bytes from local disk or object storage. */
export async function readAsset(key: string): Promise<Buffer> {
  if (!objectStorage()) return localAsset(key);
  const object = await client().send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
  );
  return Buffer.from(await object.Body!.transformToByteArray());
}

/** Stores bytes the server produced itself (e.g. previews) under a fresh key. */
export async function storeDerived(bytes: Buffer, mime: string, workspaceId: string) {
  const key = `${workspaceId}/${randomUUID()}`;
  if (!objectStorage()) {
    const target = path.join(dataDir(), "assets", key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  } else
    await client().send(
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: bytes, ContentType: mime }),
    );
  return key;
}

export async function localAsset(key: string) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key))
    throw new Error("Invalid storage key");
  return readFile(path.join(dataDir(), "assets", key));
}

export async function prepareDirectUpload(
  key: string,
  mime: string,
  size: number,
) {
  if (!allowed.has(mime) || size < 0 || size > 100 * 1024 * 1024)
    throw new Error("Unsupported type or file exceeds 100 MB.");
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: key,
      ContentType: mime,
      ContentLength: size,
    }),
    { expiresIn: 600 },
  );
}
export async function verifyDirectUpload(
  key: string,
  mime: string,
  size: number,
) {
  const { HeadObjectCommand, CopyObjectCommand } =
    await import("@aws-sdk/client-s3");
  const object = await client().send(
    new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }),
  );
  if (object.ContentLength !== size || object.ContentType !== mime)
    throw new Error("Uploaded object does not match the declared file.");
  // A signed PUT remains reusable until it expires. Publish a fresh immutable key,
  // so reusing that URL can only modify staging, never a saved file version.
  const finalKey = key.split("/")[0] + "/" + randomUUID();
  await client().send(
    new CopyObjectCommand({
      Bucket: process.env.R2_BUCKET,
      Key: finalKey,
      CopySource: process.env.R2_BUCKET + "/" + key,
      CopySourceIfMatch: object.ETag,
    }),
  );
  return finalKey;
}
