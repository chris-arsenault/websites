import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { logInfo } from "../utils/logger";
import { Readable } from "node:stream";

const s3Client = new S3Client({});

const getBucket = () => {
  const bucket = process.env.MEDIA_BUCKET;
  if (!bucket) {
    throw new Error("MEDIA_BUCKET env var is required for media uploads");
  }
  return bucket;
};

export type MediaPayload = {
  buffer: Buffer;
  contentType: string;
};

const normalizeContentType = (value?: string) => {
  if (!value) {
    return value;
  }
  return value.split(";")[0].trim();
};

export const parseBase64Data = (data?: string, fallbackMimeType?: string): MediaPayload | null => {
  if (!data) {
    return null;
  }
  const dataUrlMatch = data.match(/^data:(.+);base64,(.+)$/);
  const contentType = normalizeContentType(dataUrlMatch?.[1] ?? fallbackMimeType ?? "application/octet-stream") ??
    "application/octet-stream";
  const base64 = dataUrlMatch?.[2] ?? data;
  const buffer = Buffer.from(base64, "base64");
  return { buffer, contentType };
};

export const uploadMedia = async (key: string, payload: MediaPayload): Promise<string> => {
  const bucket = getBucket();
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: payload.buffer,
      ContentType: payload.contentType
    })
  );
  logInfo("media.uploaded", { bucket, key, contentType: payload.contentType });
  const baseUrl = process.env.PUBLIC_MEDIA_BASE_URL;
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, "")}/${key}`;
  }
  return `s3://${bucket}/${key}`;
};

const streamToBuffer = async (body: Readable | Uint8Array | Blob): Promise<Buffer> => {
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof (body as Blob).arrayBuffer === "function") {
    const arrayBuffer = await (body as Blob).arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  if (typeof (body as Readable)[Symbol.asyncIterator] === "function") {
    const chunks: Buffer[] = [];
    for await (const chunk of body as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  throw new Error("Unsupported media stream type");
};

export const downloadMediaBase64 = async (key: string): Promise<{ base64: string; contentType?: string }> => {
  const bucket = getBucket();
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );
  if (!response.Body) {
    throw new Error("Media object not found");
  }
  const buffer = await streamToBuffer(response.Body as Readable);
  return {
    base64: buffer.toString("base64"),
    contentType: response.ContentType
  };
};
