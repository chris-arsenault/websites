import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { createTasting, deleteTasting, getTasting, listTastings, putTasting } from "./services/dynamo";
import { verifyAuth } from "./services/auth";
import { validateCreateTasting, validateUpdateTastingMedia } from "./services/validation";
import { downloadMediaBase64, parseBase64Data, uploadMedia } from "./services/media";
import {
  extractVoiceMetrics,
  formatTastingNotes,
  runIngredientsExtraction,
  runImageExtraction,
  runNutritionFactsExtraction,
  transcribeVoice
} from "./services/agentic";
import { sanitizeOptional } from "./utils/sanitize";
import { jsonResponse, emptyResponse } from "./utils/http";
import { logError, logInfo, logWarn } from "./utils/logger";
import type { CreateTastingInput, ProcessingStatus, TastingRecord, UpdateTastingMediaInput } from "./types";

const getCorsHeaders = (origin?: string) => {
  const allowList = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((item) => item.trim());
  const allowOrigin = allowList.includes("*") ? "*" : allowList.includes(origin ?? "") ? origin ?? "" : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin || allowList[0] || "*",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS"
  };
};

const normalizeString = (value?: string) => (value ? sanitizeOptional(value) : "");
const normalizeMimeType = (value?: string) => (value ? value.split(";")[0].trim() : value);
const inferMimeTypeFromKey = (key?: string): string | undefined => {
  if (!key) {
    return undefined;
  }
  const ext = key.split(".").pop()?.toLowerCase();
  if (!ext) {
    return undefined;
  }
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    webm: "audio/webm",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    flac: "audio/flac"
  };
  return map[ext];
};

const applyEnrichment = (
  base: TastingRecord,
  enrichment: Partial<TastingRecord>,
  options?: { overwriteKeys?: Array<keyof TastingRecord> }
) => {
  const overwriteKeys = new Set(options?.overwriteKeys ?? []);
  const shouldApplyCandidate = (candidate: unknown) => {
    if (candidate === undefined || candidate === null) {
      return false;
    }
    if (typeof candidate === "string") {
      return candidate.trim().length > 0;
    }
    return true;
  };
  (Object.keys(enrichment) as (keyof TastingRecord)[]).forEach((key) => {
    const candidate = enrichment[key];
    const current = base[key];
    if (!shouldApplyCandidate(candidate)) {
      return;
    }
    if (overwriteKeys.has(key)) {
      base[key] = candidate as never;
      return;
    }
    if (typeof current === "string" && current.trim().length === 0) {
      base[key] = candidate as never;
      return;
    }
    if (current === null || current === undefined) {
      base[key] = candidate as never;
    }
  });
};

const stripAudioFields = (record: TastingRecord) => {
  const { voiceKey: _voiceKey, voiceTranscript: _voiceTranscript, ...rest } = record;
  return rest;
};

type ProcessEvent = {
  action: "process";
  recordId: string;
  imageKey?: string;
  ingredientsImageKey?: string;
  nutritionImageKey?: string;
  voiceKey?: string;
  imageMimeType?: string;
  ingredientsImageMimeType?: string;
  nutritionImageMimeType?: string;
  voiceMimeType?: string;
  forceVoice?: boolean;
};

const lambdaClient = new LambdaClient({});

const isProcessEvent = (event: unknown): event is ProcessEvent => {
  return Boolean(event && typeof event === "object" && (event as ProcessEvent).action === "process");
};

const parseJsonBody = <T,>(body: string | undefined, isBase64Encoded?: boolean): T => {
  if (!body) {
    throw new Error("Missing body");
  }
  const raw = isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
  return JSON.parse(raw) as T;
};

const buildRecord = (input: CreateTastingInput, nowIso: string, createdBy?: string): TastingRecord => {
  return {
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
  };
};

const updateRecordStatus = async (
  record: TastingRecord,
  status: ProcessingStatus,
  processingError?: string
) => {
  record.status = status;
  record.updatedAt = new Date().toISOString();
  if (status === "error") {
    record.processingError = processingError ?? record.processingError ?? "Unknown processing error";
  } else {
    record.processingError = undefined;
  }
  await putTasting(record);
  logInfo("tasting.status.updated", { recordId: record.id, status });
};

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

const processTastingAsync = async (payload: ProcessEvent) => {
  const record = await getTasting(payload.recordId);
  if (!record) {
    logWarn("agent.process.missing_record", { recordId: payload.recordId });
    return;
  }

  try {
    if (payload.imageKey) {
      const media = await downloadMediaBase64(payload.imageKey);
      const imageMimeType = media.contentType ?? payload.imageMimeType ?? "image/jpeg";
      const imageExtraction = await runImageExtraction(media.base64, imageMimeType);
      applyEnrichment(record, {
        productType: imageExtraction.productType,
        name: imageExtraction.name,
        maker: imageExtraction.maker,
        style: imageExtraction.style
      });
      await updateRecordStatus(record, "image_extracted");
    }

    if (payload.ingredientsImageKey) {
      const media = await downloadMediaBase64(payload.ingredientsImageKey);
      const ingredientsImageMimeType = media.contentType ?? payload.ingredientsImageMimeType ?? "image/jpeg";
      const ingredientsExtraction = await runIngredientsExtraction(media.base64, ingredientsImageMimeType);
      applyEnrichment(record, {
        ingredients: ingredientsExtraction.ingredients
      });
      logInfo("agent.ingredients.complete", {
        recordId: record.id,
        ingredientCount: ingredientsExtraction.ingredients?.length ?? 0
      });
      await updateRecordStatus(record, "ingredients_extracted");
    }

    if (payload.nutritionImageKey) {
      const media = await downloadMediaBase64(payload.nutritionImageKey);
      const nutritionImageMimeType = media.contentType ?? payload.nutritionImageMimeType ?? "image/jpeg";
      const nutritionExtraction = await runNutritionFactsExtraction(media.base64, nutritionImageMimeType);
      applyEnrichment(record, {
        nutritionFacts: nutritionExtraction.nutritionFacts
      });
      logInfo("agent.nutrition.complete", {
        recordId: record.id,
        hasNutrition: !!nutritionExtraction.nutritionFacts
      });
      await updateRecordStatus(record, "nutrition_extracted");
    }

    if (payload.voiceKey) {
      const bucket = process.env.MEDIA_BUCKET;
      if (!bucket) {
        throw new Error("MEDIA_BUCKET env var is required for transcription");
      }
      const voiceS3Uri = `s3://${bucket}/${payload.voiceKey}`;
      const transcript = await transcribeVoice(voiceS3Uri, payload.voiceMimeType ?? "audio/webm");
      applyEnrichment(record, { voiceTranscript: transcript }, {
        overwriteKeys: payload.forceVoice ? ["voiceTranscript"] : []
      });
      await updateRecordStatus(record, "voice_transcribed");

      const metrics = await extractVoiceMetrics(transcript);
      applyEnrichment(record, {
        score: metrics.score ?? null,
        heatUser: metrics.heatUser ?? null
      }, {
        overwriteKeys: payload.forceVoice ? ["score", "heatUser"] : []
      });
      await updateRecordStatus(record, "voice_extracted");

      const formattedNotes = await formatTastingNotes(transcript);
      const priorNotes = record.tastingNotesUser;
      if (formattedNotes.notes) {
        applyEnrichment(record, { tastingNotesUser: formattedNotes.notes }, {
          overwriteKeys: payload.forceVoice ? ["tastingNotesUser"] : []
        });
      }
      if (
        formattedNotes.source === "fallback" &&
        (payload.forceVoice || !priorNotes || priorNotes.trim().length === 0)
      ) {
        record.needsAttention = true;
        record.attentionReason = "Notes fallback used";
        logWarn("agent.notes.fallback", { recordId: record.id });
      } else if (formattedNotes.source === "llm" && record.attentionReason === "Notes fallback used") {
        record.needsAttention = false;
        record.attentionReason = undefined;
      }
      await updateRecordStatus(record, "notes_formatted");
    }

    await updateRecordStatus(record, "complete");
  } catch (error) {
    const message = (error as Error).message;
    await updateRecordStatus(record, "error", message);
    logError("agent.process.failed", { recordId: payload.recordId, error: message });
  }
};

export const handler = async (
  event: APIGatewayProxyEventV2 | ProcessEvent
): Promise<APIGatewayProxyResultV2> => {
  if (isProcessEvent(event)) {
    await processTastingAsync(event);
    return { statusCode: 204 };
  }

  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;
  const corsHeaders = getCorsHeaders(event.headers.origin ?? event.headers.Origin);

  if (method === "OPTIONS") {
    return emptyResponse(204, corsHeaders);
  }

  try {
    if (method === "GET" && path === "/tastings") {
      const filters = {
        name: event.queryStringParameters?.name,
        style: event.queryStringParameters?.style,
        minScore: event.queryStringParameters?.minScore ? Number(event.queryStringParameters?.minScore) : undefined,
        maxScore: event.queryStringParameters?.maxScore ? Number(event.queryStringParameters?.maxScore) : undefined,
        minHeat: event.queryStringParameters?.minHeat ? Number(event.queryStringParameters?.minHeat) : undefined,
        maxHeat: event.queryStringParameters?.maxHeat ? Number(event.queryStringParameters?.maxHeat) : undefined,
        date: event.queryStringParameters?.date
      };
      const tastings = await listTastings(filters);
      return jsonResponse(200, { data: tastings.map(stripAudioFields) }, corsHeaders);
    }

    if (method === "POST" && path === "/tastings") {
      const user = await verifyAuth(event.headers.authorization ?? event.headers.Authorization);
      const payload = parseJsonBody<CreateTastingInput>(event.body, event.isBase64Encoded);
      const parsed = validateCreateTasting(payload);

      const nowIso = new Date().toISOString();
      const record = buildRecord(parsed, nowIso, user.sub);

      const imagePayload = parseBase64Data(parsed.imageBase64, parsed.imageMimeType);
      const ingredientsImagePayload = parseBase64Data(parsed.ingredientsImageBase64, parsed.ingredientsImageMimeType);
      const nutritionImagePayload = parseBase64Data(parsed.nutritionImageBase64, parsed.nutritionImageMimeType);
      const voicePayload = parseBase64Data(parsed.voiceBase64, parsed.voiceMimeType);
      const agentImageMimeType = normalizeMimeType(imagePayload?.contentType ?? parsed.imageMimeType);
      const agentIngredientsImageMimeType = normalizeMimeType(
        ingredientsImagePayload?.contentType ?? parsed.ingredientsImageMimeType
      );
      const agentNutritionImageMimeType = normalizeMimeType(
        nutritionImagePayload?.contentType ?? parsed.nutritionImageMimeType
      );
      const agentVoiceMimeType = normalizeMimeType(voicePayload?.contentType ?? parsed.voiceMimeType);

      let imageUrl: string | undefined;
      let imageKey: string | undefined;
      let ingredientsImageUrl: string | undefined;
      let ingredientsImageKey: string | undefined;
      let nutritionImageUrl: string | undefined;
      let nutritionImageKey: string | undefined;
      let voiceKey: string | undefined;

      if (imagePayload) {
        const ext = imagePayload.contentType.split("/")[1] ?? "jpg";
        imageKey = `images/${record.id}-${Date.now()}.${ext}`;
        imageUrl = await uploadMedia(imageKey, imagePayload);
      }

      if (ingredientsImagePayload) {
        const ext = ingredientsImagePayload.contentType.split("/")[1] ?? "jpg";
        ingredientsImageKey = `images/${record.id}-ingredients-${Date.now()}.${ext}`;
        ingredientsImageUrl = await uploadMedia(ingredientsImageKey, ingredientsImagePayload);
      }

      if (nutritionImagePayload) {
        const ext = nutritionImagePayload.contentType.split("/")[1] ?? "jpg";
        nutritionImageKey = `images/${record.id}-nutrition-${Date.now()}.${ext}`;
        nutritionImageUrl = await uploadMedia(nutritionImageKey, nutritionImagePayload);
      }

      if (voicePayload) {
        const ext = voicePayload.contentType.split("/")[1] ?? "webm";
        voiceKey = `voice/${record.id}-${Date.now()}.${ext}`;
        const voiceUrl = await uploadMedia(voiceKey, voicePayload);
        logInfo("voice.uploaded", { voiceUrl });
      }

      record.imageUrl = imageUrl;
      record.imageKey = imageKey;
      record.ingredientsImageUrl = ingredientsImageUrl;
      record.ingredientsImageKey = ingredientsImageKey;
      record.nutritionImageUrl = nutritionImageUrl;
      record.nutritionImageKey = nutritionImageKey;
      record.voiceKey = voiceKey;

      await createTasting(record);
      try {
        await invokeAsyncProcessing({
          action: "process",
          recordId: record.id,
          imageKey,
          ingredientsImageKey,
          nutritionImageKey,
          voiceKey,
          imageMimeType: agentImageMimeType,
          ingredientsImageMimeType: agentIngredientsImageMimeType,
          nutritionImageMimeType: agentNutritionImageMimeType,
          voiceMimeType: agentVoiceMimeType
        });
      } catch (error) {
        const message = (error as Error).message;
        await updateRecordStatus(record, "error", message);
        logWarn("agent.process.invoke.failed", { recordId: record.id, error: message });
      }

      return emptyResponse(204, corsHeaders);
    }

    const mediaMatch = method === "POST" ? path.match(/^\/tastings\/([^/]+)\/media$/) : null;
    if (mediaMatch) {
      const user = await verifyAuth(event.headers.authorization ?? event.headers.Authorization);
      const recordId = decodeURIComponent(mediaMatch[1]);
      const record = await getTasting(recordId);
      if (!record) {
        return jsonResponse(404, { message: "Tasting not found" }, corsHeaders);
      }
      if (record.createdBy && record.createdBy !== user.sub) {
        return jsonResponse(403, { message: "Forbidden" }, corsHeaders);
      }

      const payload = parseJsonBody<UpdateTastingMediaInput>(event.body, event.isBase64Encoded);
      const parsed = validateUpdateTastingMedia(payload);

      const imagePayload = parseBase64Data(parsed.imageBase64, parsed.imageMimeType);
      const ingredientsImagePayload = parseBase64Data(parsed.ingredientsImageBase64, parsed.ingredientsImageMimeType);
      const nutritionImagePayload = parseBase64Data(parsed.nutritionImageBase64, parsed.nutritionImageMimeType);

      if (!imagePayload && !ingredientsImagePayload && !nutritionImagePayload) {
        return jsonResponse(400, { message: "No media provided" }, corsHeaders);
      }

      if (imagePayload) {
        const ext = imagePayload.contentType.split("/")[1] ?? "jpg";
        const imageKey = `images/${record.id}-${Date.now()}.${ext}`;
        record.imageKey = imageKey;
        record.imageUrl = await uploadMedia(imageKey, imagePayload);
      }

      if (ingredientsImagePayload) {
        const ext = ingredientsImagePayload.contentType.split("/")[1] ?? "jpg";
        const ingredientsImageKey = `images/${record.id}-ingredients-${Date.now()}.${ext}`;
        record.ingredientsImageKey = ingredientsImageKey;
        record.ingredientsImageUrl = await uploadMedia(ingredientsImageKey, ingredientsImagePayload);
      }

      if (nutritionImagePayload) {
        const ext = nutritionImagePayload.contentType.split("/")[1] ?? "jpg";
        const nutritionImageKey = `images/${record.id}-nutrition-${Date.now()}.${ext}`;
        record.nutritionImageKey = nutritionImageKey;
        record.nutritionImageUrl = await uploadMedia(nutritionImageKey, nutritionImagePayload);
      }

      record.updatedAt = new Date().toISOString();
      await putTasting(record);

      return jsonResponse(200, { data: stripAudioFields(record) }, corsHeaders);
    }

    const deleteMatch = method === "DELETE" ? path.match(/^\/tastings\/([^/]+)$/) : null;
    if (deleteMatch) {
      const user = await verifyAuth(event.headers.authorization ?? event.headers.Authorization);
      const recordId = decodeURIComponent(deleteMatch[1]);
      const record = await getTasting(recordId);
      if (!record) {
        return jsonResponse(404, { message: "Tasting not found" }, corsHeaders);
      }
      if (record.createdBy && record.createdBy !== user.sub) {
        return jsonResponse(403, { message: "Forbidden" }, corsHeaders);
      }
      await deleteTasting(record.id);
      logInfo("tasting.deleted", { recordId: record.id });
      return emptyResponse(204, corsHeaders);
    }

    const rerunMatch = method === "POST" ? path.match(/^\/tastings\/([^/]+)\/rerun$/) : null;
    if (rerunMatch) {
      const user = await verifyAuth(event.headers.authorization ?? event.headers.Authorization);
      const recordId = decodeURIComponent(rerunMatch[1]);
      const record = await getTasting(recordId);
      if (!record) {
        return jsonResponse(404, { message: "Tasting not found" }, corsHeaders);
      }
      if (record.createdBy && record.createdBy !== user.sub) {
        return jsonResponse(403, { message: "Forbidden" }, corsHeaders);
      }
      if (!record.imageKey && !record.ingredientsImageKey && !record.nutritionImageKey && !record.voiceKey) {
        return jsonResponse(400, { message: "No media available to process" }, corsHeaders);
      }

      await updateRecordStatus(record, "pending");

      const imageMimeType = normalizeMimeType(inferMimeTypeFromKey(record.imageKey));
      const ingredientsImageMimeType = normalizeMimeType(inferMimeTypeFromKey(record.ingredientsImageKey));
      const nutritionImageMimeType = normalizeMimeType(inferMimeTypeFromKey(record.nutritionImageKey));
      const voiceMimeType = normalizeMimeType(inferMimeTypeFromKey(record.voiceKey));

      try {
        await invokeAsyncProcessing({
          action: "process",
          recordId: record.id,
          imageKey: record.imageKey,
          ingredientsImageKey: record.ingredientsImageKey,
          nutritionImageKey: record.nutritionImageKey,
          voiceKey: record.voiceKey,
          imageMimeType,
          ingredientsImageMimeType,
          nutritionImageMimeType,
          voiceMimeType,
          forceVoice: true
        });
      } catch (error) {
        const message = (error as Error).message;
        await updateRecordStatus(record, "error", message);
        logWarn("agent.process.invoke.failed", { recordId: record.id, error: message });
      }

      return emptyResponse(204, corsHeaders);
    }

    return jsonResponse(404, { message: "Not found" }, corsHeaders);
  } catch (error) {
    logError("handler.error", { error: (error as Error).message });
    return jsonResponse(400, { message: (error as Error).message }, corsHeaders);
  }
};
