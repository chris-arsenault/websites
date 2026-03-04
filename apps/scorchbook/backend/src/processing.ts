import { getTasting, putTasting } from "./services/dynamo";
import { downloadMediaBase64 } from "./services/media";
import {
  extractVoiceMetrics,
  formatTastingNotes,
  runIngredientsExtraction,
  runImageExtraction,
  runNutritionFactsExtraction,
  transcribeVoice
} from "./services/agentic";
import { logError, logInfo, logWarn } from "./utils/logger";
import type { ProcessingStatus, TastingRecord } from "./types";

export type ProcessEvent = {
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

export const isProcessEvent = (event: unknown): event is ProcessEvent =>
  Boolean(event && typeof event === "object" && (event as ProcessEvent).action === "process");

const applyEnrichment = (
  base: TastingRecord,
  enrichment: Partial<TastingRecord>,
  options?: { overwriteKeys?: Array<keyof TastingRecord> }
) => {
  const overwriteKeys = new Set(options?.overwriteKeys ?? []);
  const shouldApply = (candidate: unknown) => {
    if (candidate == null) return false;
    if (typeof candidate === "string") return candidate.trim().length > 0;
    return true;
  };
  (Object.keys(enrichment) as (keyof TastingRecord)[]).forEach((key) => {
    const candidate = enrichment[key];
    const current = base[key];
    if (!shouldApply(candidate)) return;
    if (overwriteKeys.has(key)) {
      base[key] = candidate as never;
      return;
    }
    if (typeof current === "string" && current.trim().length === 0) {
      base[key] = candidate as never;
      return;
    }
    if (current == null) {
      base[key] = candidate as never;
    }
  });
};

export const updateRecordStatus = async (
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

const processImage = async (record: TastingRecord, imageKey: string, imageMimeType?: string) => {
  const media = await downloadMediaBase64(imageKey);
  const mimeType = media.contentType ?? imageMimeType ?? "image/jpeg";
  const extraction = await runImageExtraction(media.base64, mimeType);
  applyEnrichment(record, {
    productType: extraction.productType,
    name: extraction.name,
    maker: extraction.maker,
    style: extraction.style
  });
  await updateRecordStatus(record, "image_extracted");
};

const processIngredients = async (record: TastingRecord, ingredientsKey: string, mimeType?: string) => {
  const media = await downloadMediaBase64(ingredientsKey);
  const resolvedMimeType = media.contentType ?? mimeType ?? "image/jpeg";
  const extraction = await runIngredientsExtraction(media.base64, resolvedMimeType);
  applyEnrichment(record, { ingredients: extraction.ingredients });
  logInfo("agent.ingredients.complete", {
    recordId: record.id,
    ingredientCount: extraction.ingredients?.length ?? 0
  });
  await updateRecordStatus(record, "ingredients_extracted");
};

const processNutrition = async (record: TastingRecord, nutritionKey: string, mimeType?: string) => {
  const media = await downloadMediaBase64(nutritionKey);
  const resolvedMimeType = media.contentType ?? mimeType ?? "image/jpeg";
  const extraction = await runNutritionFactsExtraction(media.base64, resolvedMimeType);
  applyEnrichment(record, { nutritionFacts: extraction.nutritionFacts });
  logInfo("agent.nutrition.complete", {
    recordId: record.id,
    hasNutrition: !!extraction.nutritionFacts
  });
  await updateRecordStatus(record, "nutrition_extracted");
};

const processVoiceTranscription = async (record: TastingRecord, voiceKey: string, voiceMimeType?: string) => {
  const bucket = process.env.MEDIA_BUCKET;
  if (!bucket) {
    throw new Error("MEDIA_BUCKET env var is required for transcription");
  }
  const voiceS3Uri = `s3://${bucket}/${voiceKey}`;
  return transcribeVoice(voiceS3Uri, voiceMimeType ?? "audio/webm");
};

const processVoiceMetrics = async (record: TastingRecord, transcript: string, forceVoice?: boolean) => {
  const metrics = await extractVoiceMetrics(transcript);
  applyEnrichment(record, {
    score: metrics.score ?? null,
    heatUser: metrics.heatUser ?? null
  }, {
    overwriteKeys: forceVoice ? ["score", "heatUser"] : []
  });
  await updateRecordStatus(record, "voice_extracted");
};

const processVoiceNotes = async (record: TastingRecord, transcript: string, forceVoice?: boolean) => {
  const formattedNotes = await formatTastingNotes(transcript);
  const priorNotes = record.tastingNotesUser;
  if (formattedNotes.notes) {
    applyEnrichment(record, { tastingNotesUser: formattedNotes.notes }, {
      overwriteKeys: forceVoice ? ["tastingNotesUser"] : []
    });
  }
  if (formattedNotes.source === "fallback" && (forceVoice || !priorNotes || priorNotes.trim().length === 0)) {
    record.needsAttention = true;
    record.attentionReason = "Notes fallback used";
    logWarn("agent.notes.fallback", { recordId: record.id });
  } else if (formattedNotes.source === "llm" && record.attentionReason === "Notes fallback used") {
    record.needsAttention = false;
    record.attentionReason = undefined;
  }
  await updateRecordStatus(record, "notes_formatted");
};

const processVoice = async (record: TastingRecord, payload: ProcessEvent) => {
  if (!payload.voiceKey) return;
  const transcript = await processVoiceTranscription(record, payload.voiceKey, payload.voiceMimeType);
  applyEnrichment(record, { voiceTranscript: transcript }, {
    overwriteKeys: payload.forceVoice ? ["voiceTranscript"] : []
  });
  await updateRecordStatus(record, "voice_transcribed");
  await processVoiceMetrics(record, transcript, payload.forceVoice);
  await processVoiceNotes(record, transcript, payload.forceVoice);
};

export const processTastingAsync = async (payload: ProcessEvent) => {
  const record = await getTasting(payload.recordId);
  if (!record) {
    logWarn("agent.process.missing_record", { recordId: payload.recordId });
    return;
  }
  try {
    if (payload.imageKey) {
      await processImage(record, payload.imageKey, payload.imageMimeType);
    }
    if (payload.ingredientsImageKey) {
      await processIngredients(record, payload.ingredientsImageKey, payload.ingredientsImageMimeType);
    }
    if (payload.nutritionImageKey) {
      await processNutrition(record, payload.nutritionImageKey, payload.nutritionImageMimeType);
    }
    await processVoice(record, payload);
    await updateRecordStatus(record, "complete");
  } catch (error) {
    const message = (error as Error).message;
    await updateRecordStatus(record, "error", message);
    logError("agent.process.failed", { recordId: payload.recordId, error: message });
  }
};
