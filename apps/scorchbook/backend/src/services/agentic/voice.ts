import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand, type LanguageCode } from "@aws-sdk/client-transcribe";
import { logInfo } from "../../utils/logger";
import { sleep, invokeClaude, buildTextPrompt, parseJsonFromText, normalizeNumber, clampScore } from "./llm";
import type { AgentEnrichment, NotesResult } from "./types";

const transcribeClient = new TranscribeClient({});

const transcribeLanguage = (process.env.TRANSCRIBE_LANGUAGE ?? "en-US") as LanguageCode;
const transcribePollMs = Number(process.env.TRANSCRIBE_POLL_MS ?? "1500");
const transcribeMaxPolls = Number(process.env.TRANSCRIBE_MAX_POLLS ?? "40");

const mapMediaFormat = (mimeType: string): "mp3" | "mp4" | "wav" | "flac" | "ogg" | "webm" => {
  if (mimeType.includes("mp3")) return "mp3";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("flac")) return "flac";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
};

const fetchTranscriptText = async (transcriptUri: string): Promise<string> => {
  const response = await fetch(transcriptUri);
  const json = (await response.json()) as { results?: { transcripts?: { transcript?: string }[] } };
  return json.results?.transcripts?.[0]?.transcript ?? "";
};

const pollTranscriptionJob = async (jobName: string): Promise<string> => {
  for (let attempt = 0; attempt < transcribeMaxPolls; attempt += 1) {
    await sleep(transcribePollMs);
    const getCommand = new GetTranscriptionJobCommand({ TranscriptionJobName: jobName });
    const response = await transcribeClient.send(getCommand);
    const status = response.TranscriptionJob?.TranscriptionJobStatus;
    if (status === "COMPLETED") {
      const transcriptUri = response.TranscriptionJob?.Transcript?.TranscriptFileUri;
      if (!transcriptUri) {
        throw new Error("Transcribe completed without transcript URI");
      }
      const transcript = await fetchTranscriptText(transcriptUri);
      logInfo("agent.transcribe.completed", { jobName });
      return transcript;
    }
    if (status === "FAILED") {
      throw new Error("Transcribe job failed");
    }
  }
  throw new Error("Transcribe job timed out");
};

export const transcribeVoice = async (s3Uri: string, mimeType: string): Promise<string> => {
  // eslint-disable-next-line sonarjs/pseudo-random -- job name uniqueness, not security
  const jobName = `scorchbook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startCommand = new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    LanguageCode: transcribeLanguage,
    Media: { MediaFileUri: s3Uri },
    MediaFormat: mapMediaFormat(mimeType),
    Settings: { ShowSpeakerLabels: false }
  });
  logInfo("agent.transcribe.start", { jobName, s3Uri });
  await transcribeClient.send(startCommand);
  return pollTranscriptionJob(jobName);
};

const stripRatingsFromNotes = (notes: string): string => {
  /* eslint-disable sonarjs/slow-regex -- input is short transcription text, no backtracking risk */
  const patterns = [
    /\b\d+\s*\/\s*10\b/gi,
    /\b\d+\s*\/\s*5\b/gi,
    /\b\d+\s*out of\s*10\b/gi,
    /\b(score|rating) *[:\-]? *\d+(\.\d+)?\b/gi,
    /\b(heat|heat level|spice level) *[:\-]? *\d+(\.\d+)?\b/gi
  ];
  /* eslint-enable sonarjs/slow-regex */
  let cleaned = notes;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(/\b(uh|um|erm|er|hmm+)\b/gi, " ");
  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  // eslint-disable-next-line sonarjs/slow-regex -- simple space collapse, no backtracking risk
  return lines.join("\n").replace(/ {2,}/g, " ").replace(/ +\./g, ".").trim();
};

const fallbackTastingNotesFromTranscript = (transcript: string): string | undefined => {
  const trimmed = transcript.trim();
  if (!trimmed || trimmed.length < 12) {
    return undefined;
  }
  return trimmed.slice(0, 1200);
};

const knownLabels: Record<string, string> = {
  flavor: "Flavor",
  flavour: "Flavor",
  aroma: "Aroma",
  texture: "Texture",
  heat: "Heat",
  "heat level": "Heat",
  spice: "Heat",
  "spice level": "Heat",
  pairings: "Pairings",
  pairing: "Pairings",
  finish: "Finish",
  description: "Description"
};

const formatNotesLabel = (label: string) => {
  const cleaned = label.trim();
  if (!cleaned) {
    return "Note";
  }
  const normalized = cleaned.toLowerCase();
  if (knownLabels[normalized]) {
    return knownLabels[normalized];
  }
  return cleaned
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .trim();
};

const formatBulletLines = (lines: string[]): string => {
  const cleaned = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => (/^[-•]/.test(line) ? line : `- ${line}`));
  return cleaned.join("\n");
};

const notesToString = (value: unknown): string => {
  if (typeof value === "string") {
    return formatBulletLines(value.split(/\n+/));
  }
  if (!value) {
    return "";
  }
  if (Array.isArray(value)) {
    const lines = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    return formatBulletLines(lines);
  }
  if (typeof value !== "object") {
    return "";
  }
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([_, val]) => typeof val === "string" && val.trim().length > 0
  );
  if (!entries.length) {
    return "";
  }
  const lines = entries.map(([key, val]) => `${formatNotesLabel(key)}: ${(val as string).trim()}`);
  return formatBulletLines(lines);
};

const runNotesLlm = async (transcript: string): Promise<string> => {
  const instructions =
    "Rewrite this transcript into a concise, professional tasting summary. Identify 2-6 salient categories that are actually mentioned (e.g., Aroma, Flavor, Sweetness, Acidity, Body, Carbonation, Spice/Heat, Balance, Aftertaste). Use category names that fit the product; do not invent or force categories. Return JSON only with key: tasting_notes_user as an object of category -> concise phrase. Keep each phrase under ~12 words. Remove numeric ratings or scores; do not include numbers like 8/10. Remove filler words like um/uh. If the transcript contains no tasting notes, return an empty object. Do not return nested objects or arrays.";
  const payload = buildTextPrompt(instructions, transcript);
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    return "";
  }
  const rawNotes = parsed.tasting_notes_user;
  return notesToString(rawNotes);
};

export const formatTastingNotes = async (transcript: string): Promise<NotesResult> => {
  if (!transcript) {
    return { source: "none" };
  }
  let candidate = await runNotesLlm(transcript);
  let cleaned = stripRatingsFromNotes(candidate);
  if (!cleaned.length) {
    candidate = await runNotesLlm(transcript);
    cleaned = stripRatingsFromNotes(candidate);
  }
  if (cleaned.length) {
    return { notes: cleaned, source: "llm" };
  }
  const fallback = fallbackTastingNotesFromTranscript(transcript);
  if (fallback) {
    return { notes: fallback, source: "fallback" };
  }
  return { source: "none" };
};

export const extractVoiceMetrics = async (transcript: string): Promise<AgentEnrichment> => {
  if (!transcript) {
    return {};
  }
  const instructions =
    "Extract user tasting details from this transcript. Return JSON only with keys: score, heat_user. Use null for unknowns.";
  const payload = buildTextPrompt(instructions, transcript);
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    return {};
  }
  return {
    score: clampScore(normalizeNumber(parsed.score)),
    heatUser: clampScore(normalizeNumber(parsed.heat_user))
  };
};
