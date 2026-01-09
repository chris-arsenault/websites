import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { randomUUID } from "crypto";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { createTasting, getTasting, listTastings, putTasting } from "./services/dynamo";
import { verifyAuth } from "./services/auth";
import { validateCreateTasting } from "./services/validation";
import { downloadMediaBase64, parseBase64Data, uploadMedia } from "./services/media";
import {
  extractVoiceMetrics,
  formatTastingNotes,
  runImageExtraction,
  runSearchEnrichment,
  transcribeVoice,
  type SearchContext
} from "./services/agentic";
import { sanitizeOptional } from "./utils/sanitize";
import { jsonResponse, emptyResponse } from "./utils/http";
import { logError, logInfo, logWarn } from "./utils/logger";
import type { CreateTastingInput, ProcessingStatus, TastingRecord } from "./types";

const getCorsHeaders = (origin?: string) => {
  const allowList = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((item) => item.trim());
  const allowOrigin = allowList.includes("*") ? "*" : allowList.includes(origin ?? "") ? origin ?? "" : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin || allowList[0] || "*",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  };
};

const normalizeString = (value?: string) => (value ? sanitizeOptional(value) : "");
const normalizeMimeType = (value?: string) => (value ? value.split(";")[0].trim() : value);

const applyEnrichment = (base: TastingRecord, enrichment: Partial<TastingRecord>) => {
  (Object.keys(enrichment) as (keyof TastingRecord)[]).forEach((key) => {
    const candidate = enrichment[key];
    const current = base[key];
    if (candidate === undefined || candidate === null) {
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

type ProcessEvent = {
  action: "process";
  recordId: string;
  imageKey?: string;
  voiceKey?: string;
  imageMimeType?: string;
  voiceMimeType?: string;
};

const lambdaClient = new LambdaClient({});

const isProcessEvent = (event: unknown): event is ProcessEvent => {
  return Boolean(event && typeof event === "object" && (event as ProcessEvent).action === "process");
};

const parseJsonBody = (body: string | undefined, isBase64Encoded?: boolean): CreateTastingInput => {
  if (!body) {
    throw new Error("Missing body");
  }
  const raw = isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
  return JSON.parse(raw) as CreateTastingInput;
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
        name: imageExtraction.name,
        maker: imageExtraction.maker,
        style: imageExtraction.style,
        heatVendor: imageExtraction.heatVendor ?? null,
        tastingNotesVendor: imageExtraction.tastingNotesVendor,
        productUrl: imageExtraction.productUrl
      });
      await updateRecordStatus(record, "image_extracted");

      const searchContext: SearchContext = {
        name: record.name || imageExtraction.name,
        maker: record.maker || imageExtraction.maker,
        style: record.style || imageExtraction.style,
        keywords: imageExtraction.keywords
      };
      logInfo("agent.search.start", {
        recordId: record.id,
        context: searchContext,
        candidateUrls: [imageExtraction.productUrl, record.productUrl].filter(Boolean)
      });
      const search = await runSearchEnrichment(searchContext, [imageExtraction.productUrl, record.productUrl]);
      applyEnrichment(record, {
        name: search.searchFields.name,
        maker: search.searchFields.maker,
        style: search.searchFields.style,
        heatVendor: search.searchFields.heatVendor ?? null,
        tastingNotesVendor: search.searchFields.tastingNotesVendor,
        productUrl: search.searchFields.productUrl
      });
      logInfo("agent.search.complete", {
        recordId: record.id,
        searchCount: search.searchCount,
        bestResultUrl: search.bestResultUrl
      });
      await updateRecordStatus(record, "image_enriched");
    }

    if (payload.voiceKey) {
      const bucket = process.env.MEDIA_BUCKET;
      if (!bucket) {
        throw new Error("MEDIA_BUCKET env var is required for transcription");
      }
      const voiceS3Uri = `s3://${bucket}/${payload.voiceKey}`;
      const transcript = await transcribeVoice(voiceS3Uri, payload.voiceMimeType ?? "audio/webm");
      applyEnrichment(record, { voiceTranscript: transcript });
      await updateRecordStatus(record, "voice_transcribed");

      const metrics = await extractVoiceMetrics(transcript);
      applyEnrichment(record, {
        score: metrics.score ?? null,
        heatUser: metrics.heatUser ?? null
      });
      await updateRecordStatus(record, "voice_extracted");

      const formattedNotes = await formatTastingNotes(transcript);
      if (formattedNotes) {
        applyEnrichment(record, { tastingNotesUser: formattedNotes });
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
      return jsonResponse(200, { data: tastings }, corsHeaders);
    }

    if (method === "POST" && path === "/tastings") {
      const user = await verifyAuth(event.headers.authorization ?? event.headers.Authorization);
      const payload = parseJsonBody(event.body, event.isBase64Encoded);
      const parsed = validateCreateTasting(payload);

      const nowIso = new Date().toISOString();
      const record = buildRecord(parsed, nowIso, user.sub);

      const imagePayload = parseBase64Data(parsed.imageBase64, parsed.imageMimeType);
      const voicePayload = parseBase64Data(parsed.voiceBase64, parsed.voiceMimeType);
      const agentImageMimeType = normalizeMimeType(imagePayload?.contentType ?? parsed.imageMimeType);
      const agentVoiceMimeType = normalizeMimeType(voicePayload?.contentType ?? parsed.voiceMimeType);

      let imageUrl: string | undefined;
      let imageKey: string | undefined;
      let voiceKey: string | undefined;

      if (imagePayload) {
        const ext = imagePayload.contentType.split("/")[1] ?? "jpg";
        imageKey = `images/${record.id}-${Date.now()}.${ext}`;
        imageUrl = await uploadMedia(imageKey, imagePayload);
      }

      if (voicePayload) {
        const ext = voicePayload.contentType.split("/")[1] ?? "webm";
        voiceKey = `voice/${record.id}-${Date.now()}.${ext}`;
        const voiceUrl = await uploadMedia(voiceKey, voicePayload);
        logInfo("voice.uploaded", { voiceUrl });
      }

      record.imageUrl = imageUrl;
      record.imageKey = imageKey;
      record.voiceKey = voiceKey;

      await createTasting(record);
      try {
        await invokeAsyncProcessing({
          action: "process",
          recordId: record.id,
          imageKey,
          voiceKey,
          imageMimeType: agentImageMimeType,
          voiceMimeType: agentVoiceMimeType
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
