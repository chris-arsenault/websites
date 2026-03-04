import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { createTasting, deleteTasting, getTasting, listTastings, putTasting } from "./services/dynamo";
import { verifyAuth } from "./services/auth";
import { validateCreateTasting, validateUpdateTastingMedia } from "./services/validation";
import { parseBase64Data, uploadMedia } from "./services/media";
import { sanitizeOptional } from "./utils/sanitize";
import { jsonResponse, emptyResponse } from "./utils/http";
import { logError, logInfo, logWarn } from "./utils/logger";
import { isProcessEvent, processTastingAsync, updateRecordStatus } from "./processing";
import type { ProcessEvent } from "./processing";
import type { CreateTastingInput, TastingRecord, UpdateTastingMediaInput } from "./types";

const resolveAllowOrigin = (allowList: string[], origin?: string): string => {
  if (allowList.includes("*")) return "*";
  if (origin && allowList.includes(origin)) return origin;
  return "";
};

const getCorsHeaders = (origin?: string) => {
  const allowList = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((item) => item.trim());
  const allowed = resolveAllowOrigin(allowList, origin);
  return {
    "Access-Control-Allow-Origin": allowed || allowList[0] || "*",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
  };
};

const normalizeString = (value?: string) => (value ? sanitizeOptional(value) : "");
const normalizeMimeType = (value?: string) => (value ? value.split(";")[0].trim() : value);

const inferMimeTypeFromKey = (key?: string): string | undefined => {
  if (!key) return undefined;
  const ext = key.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
    mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", webm: "audio/webm",
    m4a: "audio/mp4", mp4: "audio/mp4", flac: "audio/flac"
  };
  return map[ext];
};

const lambdaClient = new LambdaClient({});

const invokeAsyncProcessing = async (payload: ProcessEvent) => {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (!functionName) {
    throw new Error("AWS_LAMBDA_FUNCTION_NAME is required to queue processing");
  }
  await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify(payload))
    })
  );
  logInfo("agent.process.queued", { recordId: payload.recordId });
};

const parseJsonBody = <T,>(body: string | undefined, isBase64Encoded?: boolean): T => {
  if (!body) throw new Error("Missing body");
  const raw = isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
  return JSON.parse(raw) as T;
};

const buildRecord = (input: CreateTastingInput, nowIso: string, createdBy?: string): TastingRecord => ({
  id: randomUUID(),
  createdAt: nowIso,
  updatedAt: nowIso,
  status: "pending",
  name: normalizeString(input.name),
  maker: normalizeString(input.maker),
  date: input.date ?? nowIso.slice(0, 10),
  score: input.score ?? null,
  style: normalizeString(input.style),
  heatUser: input.heatUser ?? null,
  heatVendor: input.heatVendor ?? null,
  refreshing: input.refreshing ?? null,
  sweet: input.sweet ?? null,
  tastingNotesUser: normalizeString(input.tastingNotesUser),
  tastingNotesVendor: normalizeString(input.tastingNotesVendor),
  productUrl: normalizeString(input.productUrl),
  createdBy
});

type MediaUploadResult = { url?: string; key?: string };

const uploadMediaPayload = async (
  payload: ReturnType<typeof parseBase64Data>,
  prefix: string,
  recordId: string,
  defaultExt: string
): Promise<MediaUploadResult> => {
  if (!payload) return {};
  const ext = payload.contentType.split("/")[1] ?? defaultExt;
  const key = `${prefix}/${recordId}-${Date.now()}.${ext}`;
  const url = await uploadMedia(key, payload);
  return { url, key };
};

const stripAudioFields = (record: TastingRecord): Omit<TastingRecord, "voiceKey" | "voiceTranscript"> => {
  const result = { ...record };
  delete (result as Partial<TastingRecord>).voiceKey;
  delete (result as Partial<TastingRecord>).voiceTranscript;
  return result;
};

// --- Route handlers ---

const optionalNumber = (value?: string): number | undefined =>
  value ? Number(value) : undefined;

const parseListFilters = (params?: Record<string, string | undefined>) => ({
  name: params?.name,
  style: params?.style,
  minScore: optionalNumber(params?.minScore),
  maxScore: optionalNumber(params?.maxScore),
  minHeat: optionalNumber(params?.minHeat),
  maxHeat: optionalNumber(params?.maxHeat),
  date: params?.date
});

const handleListTastings = async (event: APIGatewayProxyEventV2, corsHeaders: Record<string, string>) => {
  const filters = parseListFilters(event.queryStringParameters);
  const tastings = await listTastings(filters);
  return jsonResponse(200, { data: tastings.map(stripAudioFields) }, corsHeaders);
};

const safeInvokeProcessing = async (record: TastingRecord, payload: ProcessEvent) => {
  try {
    await invokeAsyncProcessing(payload);
  } catch (error) {
    const message = (error as Error).message;
    await updateRecordStatus(record, "error", message);
    logWarn("agent.process.invoke.failed", { recordId: record.id, error: message });
  }
};

const getAuthHeader = (headers: APIGatewayProxyEventV2["headers"]): string | undefined =>
  headers.authorization ?? headers.Authorization;

const handleCreateTasting = async (event: APIGatewayProxyEventV2, corsHeaders: Record<string, string>) => {
  const user = await verifyAuth(getAuthHeader(event.headers));
  const payload = parseJsonBody<CreateTastingInput>(event.body, event.isBase64Encoded);
  const parsed = validateCreateTasting(payload);
  const record = buildRecord(parsed, new Date().toISOString(), user.sub);

  const imagePayload = parseBase64Data(parsed.imageBase64, parsed.imageMimeType);
  const ingredientsPayload = parseBase64Data(parsed.ingredientsImageBase64, parsed.ingredientsImageMimeType);
  const nutritionPayload = parseBase64Data(parsed.nutritionImageBase64, parsed.nutritionImageMimeType);
  const voicePayload = parseBase64Data(parsed.voiceBase64, parsed.voiceMimeType);

  const image = await uploadMediaPayload(imagePayload, "images", record.id, "jpg");
  const ingredients = await uploadMediaPayload(ingredientsPayload, "images", `${record.id}-ingredients`, "jpg");
  const nutrition = await uploadMediaPayload(nutritionPayload, "images", `${record.id}-nutrition`, "jpg");
  const voice = await uploadMediaPayload(voicePayload, "voice", record.id, "webm");
  if (voice.url) logInfo("voice.uploaded", { voiceUrl: voice.url });

  record.imageUrl = image.url;
  record.imageKey = image.key;
  record.ingredientsImageUrl = ingredients.url;
  record.ingredientsImageKey = ingredients.key;
  record.nutritionImageUrl = nutrition.url;
  record.nutritionImageKey = nutrition.key;
  record.voiceKey = voice.key;

  await createTasting(record);
  await safeInvokeProcessing(record, {
    action: "process",
    recordId: record.id,
    imageKey: image.key,
    ingredientsImageKey: ingredients.key,
    nutritionImageKey: nutrition.key,
    voiceKey: voice.key,
    imageMimeType: normalizeMimeType(imagePayload?.contentType ?? parsed.imageMimeType),
    ingredientsImageMimeType: normalizeMimeType(ingredientsPayload?.contentType ?? parsed.ingredientsImageMimeType),
    nutritionImageMimeType: normalizeMimeType(nutritionPayload?.contentType ?? parsed.nutritionImageMimeType),
    voiceMimeType: normalizeMimeType(voicePayload?.contentType ?? parsed.voiceMimeType)
  });
  return emptyResponse(204, corsHeaders);
};

type OwnedRecordResult = { record: TastingRecord } | { error: APIGatewayProxyResultV2 };

const getOwnedRecord = async (
  event: APIGatewayProxyEventV2,
  recordId: string,
  corsHeaders: Record<string, string>
): Promise<OwnedRecordResult> => {
  const user = await verifyAuth(getAuthHeader(event.headers));
  const record = await getTasting(recordId);
  if (!record) return { error: jsonResponse(404, { message: "Tasting not found" }, corsHeaders) };
  if (record.createdBy && record.createdBy !== user.sub) {
    return { error: jsonResponse(403, { message: "Forbidden" }, corsHeaders) };
  }
  return { record };
};

const handleUpdateMedia = async (
  event: APIGatewayProxyEventV2,
  corsHeaders: Record<string, string>,
  recordId: string
) => {
  const lookup = await getOwnedRecord(event, recordId, corsHeaders);
  if ("error" in lookup) return lookup.error;
  const record = lookup.record;

  const payload = parseJsonBody<UpdateTastingMediaInput>(event.body, event.isBase64Encoded);
  const parsed = validateUpdateTastingMedia(payload);
  const imagePayload = parseBase64Data(parsed.imageBase64, parsed.imageMimeType);
  const ingredientsPayload = parseBase64Data(parsed.ingredientsImageBase64, parsed.ingredientsImageMimeType);
  const nutritionPayload = parseBase64Data(parsed.nutritionImageBase64, parsed.nutritionImageMimeType);

  if (!imagePayload && !ingredientsPayload && !nutritionPayload) {
    return jsonResponse(400, { message: "No media provided" }, corsHeaders);
  }

  const image = await uploadMediaPayload(imagePayload, "images", record.id, "jpg");
  const ingredients = await uploadMediaPayload(ingredientsPayload, "images", `${record.id}-ingredients`, "jpg");
  const nutrition = await uploadMediaPayload(nutritionPayload, "images", `${record.id}-nutrition`, "jpg");

  if (image.key) { record.imageKey = image.key; record.imageUrl = image.url; }
  if (ingredients.key) { record.ingredientsImageKey = ingredients.key; record.ingredientsImageUrl = ingredients.url; }
  if (nutrition.key) { record.nutritionImageKey = nutrition.key; record.nutritionImageUrl = nutrition.url; }

  record.updatedAt = new Date().toISOString();
  await putTasting(record);
  return jsonResponse(200, { data: stripAudioFields(record) }, corsHeaders);
};

const handleDeleteTasting = async (
  event: APIGatewayProxyEventV2,
  corsHeaders: Record<string, string>,
  recordId: string
) => {
  const lookup = await getOwnedRecord(event, recordId, corsHeaders);
  if ("error" in lookup) return lookup.error;
  const record = lookup.record;
  await deleteTasting(record.id);
  logInfo("tasting.deleted", { recordId: record.id });
  return emptyResponse(204, corsHeaders);
};

const hasAnyMediaKey = (record: TastingRecord): boolean =>
  Boolean(record.imageKey || record.ingredientsImageKey || record.nutritionImageKey || record.voiceKey);

const handleRerunProcessing = async (
  event: APIGatewayProxyEventV2,
  corsHeaders: Record<string, string>,
  recordId: string
) => {
  const lookup = await getOwnedRecord(event, recordId, corsHeaders);
  if ("error" in lookup) return lookup.error;
  const record = lookup.record;
  if (!hasAnyMediaKey(record)) {
    return jsonResponse(400, { message: "No media available to process" }, corsHeaders);
  }

  await updateRecordStatus(record, "pending");
  await safeInvokeProcessing(record, {
    action: "process",
    recordId: record.id,
    imageKey: record.imageKey,
    ingredientsImageKey: record.ingredientsImageKey,
    nutritionImageKey: record.nutritionImageKey,
    voiceKey: record.voiceKey,
    imageMimeType: normalizeMimeType(inferMimeTypeFromKey(record.imageKey)),
    ingredientsImageMimeType: normalizeMimeType(inferMimeTypeFromKey(record.ingredientsImageKey)),
    nutritionImageMimeType: normalizeMimeType(inferMimeTypeFromKey(record.nutritionImageKey)),
    voiceMimeType: normalizeMimeType(inferMimeTypeFromKey(record.voiceKey)),
    forceVoice: true
  });
  return emptyResponse(204, corsHeaders);
};

// --- Router ---

const extractIdFromPath = (path: string, pattern: RegExp): string | null => {
  const match = pattern.exec(path);
  return match ? decodeURIComponent(match[1]) : null;
};

const routePostRequest = async (
  event: APIGatewayProxyEventV2,
  corsHeaders: Record<string, string>
): Promise<APIGatewayProxyResultV2 | null> => {
  if (event.rawPath === "/tastings") return handleCreateTasting(event, corsHeaders);
  const mediaId = extractIdFromPath(event.rawPath, /^\/tastings\/([^/]+)\/media$/);
  if (mediaId) return handleUpdateMedia(event, corsHeaders, mediaId);
  const rerunId = extractIdFromPath(event.rawPath, /^\/tastings\/([^/]+)\/rerun$/);
  if (rerunId) return handleRerunProcessing(event, corsHeaders, rerunId);
  return null;
};

const routeRequest = async (
  event: APIGatewayProxyEventV2,
  corsHeaders: Record<string, string>
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method.toUpperCase();

  if (method === "GET" && event.rawPath === "/tastings") {
    return handleListTastings(event, corsHeaders);
  }
  if (method === "POST") {
    const result = await routePostRequest(event, corsHeaders);
    if (result) return result;
  }
  if (method === "DELETE") {
    const deleteId = extractIdFromPath(event.rawPath, /^\/tastings\/([^/]+)$/);
    if (deleteId) return handleDeleteTasting(event, corsHeaders, deleteId);
  }
  return jsonResponse(404, { message: "Not found" }, corsHeaders);
};

export const handler = async (
  event: APIGatewayProxyEventV2 | ProcessEvent
): Promise<APIGatewayProxyResultV2> => {
  if (isProcessEvent(event)) {
    await processTastingAsync(event);
    return { statusCode: 204 };
  }

  const corsHeaders = getCorsHeaders(event.headers.origin ?? event.headers.Origin);
  if (event.requestContext.http.method.toUpperCase() === "OPTIONS") {
    return emptyResponse(204, corsHeaders);
  }

  try {
    return await routeRequest(event, corsHeaders);
  } catch (error) {
    logError("handler.error", { error: (error as Error).message });
    return jsonResponse(400, { message: (error as Error).message }, corsHeaders);
  }
};
