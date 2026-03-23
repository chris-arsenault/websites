import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { logWarn } from "../../utils/logger";

const bedrockClient = new BedrockRuntimeClient({});
const bedrockModelId = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-haiku-20240307-v1:0";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeBody = (body: Uint8Array | string): string => {
  if (typeof body === "string") {
    return body;
  }
  return new TextDecoder().decode(body);
};

const extractClaudeText = (responseBody: string): string => {
  try {
    const parsed = JSON.parse(responseBody) as { content?: { text?: string }[]; completion?: string };
    if (Array.isArray(parsed.content)) {
      return parsed.content.map((item) => item.text ?? "").join("");
    }
    return parsed.completion ?? "";
  } catch (error) {
    logWarn("bedrock.response.parse.failed", { error: (error as Error).message });
    return responseBody;
  }
};

export const parseJsonFromText = (text: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch (innerError) {
        logWarn("bedrock.response.json.extract.failed", { error: (innerError as Error).message });
      }
    }
    return null;
  }
};

export const invokeClaude = async (payload: Record<string, unknown>): Promise<string> => {
  const requestBody = JSON.stringify(payload);
  const command = new InvokeModelCommand({
    modelId: bedrockModelId,
    contentType: "application/json",
    accept: "application/json",
    body: requestBody
  });
  try {
    const response = await bedrockClient.send(command);
    const body = decodeBody(response.body);
    return extractClaudeText(body);
  } catch (error) {
    logWarn("bedrock.invoke.failed", { error: (error as Error).message });
    throw error;
  }
};

export const buildTextPrompt = (instructions: string, input: string) => ({
  anthropic_version: "bedrock-2023-05-31",
  max_tokens: 600,
  temperature: 0.2,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: instructions },
        { type: "text", text: input }
      ]
    }
  ]
});

export const buildVisionPrompt = (instructions: string, imageBase64: string, imageMimeType: string) => ({
  anthropic_version: "bedrock-2023-05-31",
  max_tokens: 800,
  temperature: 0.2,
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: instructions },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: imageMimeType,
            data: imageBase64
          }
        }
      ]
    }
  ]
});

export const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
};

export const clampScore = (value: number | null): number | null => {
  if (value === null) {
    return null;
  }
  return Math.min(10, Math.max(0, value));
};

export const parseSecretApiKey = (value?: string): string | undefined => {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const keys = ["api_key", "apikey", "key", "TAVILY_API_KEY", "tavily_api_key"];
      for (const key of keys) {
        const candidate = parsed[key];
        if (typeof candidate === "string" && candidate.trim()) {
          return candidate.trim();
        }
      }
      const stringValues = Object.values(parsed).filter(
        (item): item is string => typeof item === "string" && item.trim().length > 0
      );
      if (stringValues.length === 1) {
        return stringValues[0].trim();
      }
    } catch (error) {
      logWarn("agent.search.key.parse_failed", { error: (error as Error).message });
    }
  }
  return trimmed;
};
