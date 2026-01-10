import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from "@aws-sdk/client-transcribe";
import { logInfo, logWarn } from "../utils/logger";
import type { AgentEnrichment } from "../types";

const bedrockClient = new BedrockRuntimeClient({});
const transcribeClient = new TranscribeClient({});

const bedrockModelId = process.env.BEDROCK_MODEL_ID ?? "anthropic.claude-3-haiku-20240307-v1:0";
const transcribeLanguage = process.env.TRANSCRIBE_LANGUAGE ?? "en-US";
const transcribePollMs = Number(process.env.TRANSCRIBE_POLL_MS ?? "1500");
const transcribeMaxPolls = Number(process.env.TRANSCRIBE_MAX_POLLS ?? "40");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeBody = async (body: Uint8Array | string): Promise<string> => {
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

const parseJsonFromText = (text: string): Record<string, unknown> | null => {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch (error) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch (innerError) {
        logWarn("bedrock.response.json.extract.failed", { error: (innerError as Error).message });
      }
    }
    return null;
  }
};

const invokeClaude = async (payload: Record<string, unknown>): Promise<string> => {
  const requestBody = JSON.stringify(payload);
  const command = new InvokeModelCommand({
    modelId: bedrockModelId,
    contentType: "application/json",
    accept: "application/json",
    body: requestBody
  });
  try {
    const response = await bedrockClient.send(command);
    const body = await decodeBody(response.body);
    return extractClaudeText(body);
  } catch (error) {
    logWarn("bedrock.invoke.failed", { error: (error as Error).message });
    throw error;
  }
};

const buildTextPrompt = (instructions: string, input: string) => ({
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

const buildVisionPrompt = (instructions: string, imageBase64: string, imageMimeType: string) => ({
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

const normalizeNumber = (value: unknown): number | null => {
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

const clampScore = (value: number | null): number | null => {
  if (value === null) {
    return null;
  }
  return Math.min(10, Math.max(0, value));
};

const parseSecretApiKey = (value?: string): string | undefined => {
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

const tavilyApiKey = parseSecretApiKey(process.env.TAVILY_API_KEY);

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: "tavily";
  content?: string;
  rawContent?: string;
};

export type SearchContext = {
  name?: string;
  maker?: string;
  style?: string;
  keywords?: string[];
};

type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
  snippet?: string;
};

type TavilySearchResponse = {
  results?: TavilySearchResult[];
};

type PageSignals = {
  result: SearchResult;
  score: number;
  contentText: string;
  hasProductSchema: boolean;
  contentSource: "raw" | "fetched" | "summary" | "snippet";
};

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const trustedDomainScores: Record<string, number> = {
  "heatonist.com": 4,
  "hotsauce.com": 4,
  "pepperpalace.com": 4,
  "amazon.com": 1,
  "walmart.com": 1,
  "target.com": 1
};

const productUrlHints = ["/product/", "/products/", "/shop/", "/store/", "/p/", "/dp/"];

const pageFetchTimeoutMs = 4500;
const pageFetchLimit = 4;
const pageExtractionLimit = 3;
const candidatePageLimit = 2;
const maxPageHtmlChars = 120000;
const maxPageContentChars = 12000;
const maxLlmContentChars = 4000;
const contentMatchChars = 8000;

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const scoreTrustedDomain = (url: string) => {
  const hostname = getHostname(url);
  if (!hostname) {
    return 0;
  }
  return Object.entries(trustedDomainScores).reduce((score, [domain, weight]) => {
    if (hostname.endsWith(domain)) {
      return Math.max(score, weight);
    }
    return score;
  }, 0);
};

const urlHasProductHint = (url: string) => {
  const urlLower = url.toLowerCase();
  return productUrlHints.some((pattern) => urlLower.includes(pattern));
};

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ");

const extractReadableText = (html: string) => collapseWhitespace(decodeHtmlEntities(stripHtml(html)));

const containsProductSchema = (html: string) => {
  const productJsonLd = /"@type"\s*:\s*"Product"/i.test(html) || /"@type"\s*:\s*\[\s*"Product"/i.test(html);
  const productMicrodata = /itemtype\s*=\s*"https?:\/\/schema\.org\/Product"/i.test(html);
  return productJsonLd || productMicrodata;
};

const tokensFromValue = (value?: string) => {
  if (!value) {
    return [];
  }
  const tokens = normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
  return Array.from(new Set(tokens));
};

const hasAllTokens = (text: string, tokens: string[]) => tokens.every((token) => text.includes(token));

const scoreHostnameTokens = (url: string, context: SearchContext): number => {
  const hostname = getHostname(url);
  if (!hostname) {
    return 0;
  }
  const hostValue = hostname.replace(/\./g, "");
  const makerTokens = tokensFromValue(context.maker);
  const nameTokens = tokensFromValue(context.name);
  let score = 0;

  if (makerTokens.length) {
    const matches = makerTokens.filter((token) => hostValue.includes(token));
    if (matches.length === makerTokens.length) {
      score += 6;
    } else if (matches.length > 0) {
      score += 2 + matches.length;
    }
  }

  if (nameTokens.length) {
    const matches = nameTokens.filter((token) => hostValue.includes(token));
    if (matches.length === nameTokens.length) {
      score += 3;
    } else if (matches.length > 0) {
      score += 1;
    }
  }

  return score;
};

const isBlockedDomain = (url: string) => {
  const hostname = getHostname(url);
  if (!hostname) {
    return false;
  }
  const blocked = [
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "pinterest.com",
    "reddit.com",
    "youtube.com",
    "wikipedia.org"
  ];
  return blocked.some((domain) => hostname.endsWith(domain));
};

const isMarketplaceDomain = (url: string) => {
  const hostname = getHostname(url);
  if (!hostname) {
    return false;
  }
  const marketplaces = [
    "amazon.com",
    "walmart.com",
    "ebay.com",
    "etsy.com",
    "target.com",
    "instacart.com"
  ];
  return marketplaces.some((domain) => hostname.endsWith(domain));
};

const scoreSearchResult = (result: SearchResult, context: SearchContext): number => {
  const text = normalizeText(`${result.title} ${result.snippet}`);
  const url = result.url.toLowerCase();
  const nameTokens = tokensFromValue(context.name);
  const makerTokens = tokensFromValue(context.maker);
  const styleTokens = tokensFromValue(context.style);
  let score = 0;

  if (nameTokens.length && hasAllTokens(text, nameTokens)) {
    score += 6;
  }
  if (nameTokens.length && hasAllTokens(url, nameTokens)) {
    score += 5;
  }
  if (makerTokens.length && hasAllTokens(text, makerTokens)) {
    score += 4;
  }
  if (makerTokens.length && hasAllTokens(url, makerTokens)) {
    score += 3;
  }
  if (styleTokens.length && hasAllTokens(text, styleTokens)) {
    score += 2;
  }
  if (text.includes("hot sauce") || text.includes("hotsauce")) {
    score += 2;
  }
  if (urlHasProductHint(url)) {
    score += 1;
  }
  score += scoreHostnameTokens(result.url, context);
  const trustedScore = scoreTrustedDomain(result.url);
  if (trustedScore) {
    score += trustedScore;
  }
  if (isMarketplaceDomain(result.url)) {
    score -= 1;
  }
  if (isBlockedDomain(result.url)) {
    score -= 6;
  }

  return score;
};

const buildSearchQuery = (context: SearchContext): string => {
  const parts = [context.name, context.maker, context.style, ...(context.keywords ?? [])]
    .filter(Boolean)
    .map((value) => value!.trim())
    .filter((value) => value.length > 0);
  if (!parts.length) {
    return "";
  }
  const quoted = parts.map((value) => (value.includes(" ") ? `"${value}"` : value));
  const base = quoted.join(" ").trim();
  const needsHotSauce = !base.toLowerCase().includes("hot sauce") && !base.toLowerCase().includes("hotsauce");
  const queryParts = [base, needsHotSauce ? "hot sauce" : "", "official OR buy OR shop OR product"].filter(Boolean);
  return queryParts.join(" ").trim();
};

const buildOfficialQuery = (context: SearchContext): string => {
  const parts = [context.maker, context.name].filter(Boolean).map((value) => value!.trim());
  if (!parts.length) {
    return "";
  }
  const quoted = parts.map((value) => (value.includes(" ") ? `"${value}"` : value));
  const base = quoted.join(" ").trim();
  const needsHotSauce = !base.toLowerCase().includes("hot sauce") && !base.toLowerCase().includes("hotsauce");
  const queryParts = [base, needsHotSauce ? "hot sauce" : "", "official site"].filter(Boolean);
  return queryParts.join(" ").trim();
};

const mergeSearchResults = (primary: SearchResult[], secondary: SearchResult[]): SearchResult[] => {
  const combined = [...primary, ...secondary];
  const seen = new Set<string>();
  return combined.filter((result) => {
    if (seen.has(result.url)) {
      return false;
    }
    seen.add(result.url);
    return true;
  });
};

const shouldRunOfficialQuery = (results: SearchResult[], context: SearchContext): boolean => {
  const makerTokens = tokensFromValue(context.maker);
  if (!makerTokens.length) {
    return false;
  }
  const topResults = results.slice(0, 3);
  const hasMakerDomain = topResults.some((result) => scoreHostnameTokens(result.url, context) >= 4);
  if (hasMakerDomain) {
    return false;
  }
  const hasMakerTitle = topResults.some((result) => hasAllTokens(normalizeText(result.title), makerTokens));
  return !hasMakerTitle;
};

const searchTavily = async (query: string): Promise<SearchResult[]> => {
  if (!query) {
    return [];
  }
  if (!tavilyApiKey) {
    logWarn("agent.search.skipped", { reason: "missing_tavily_key" });
    return [];
  }
  const endpoint = "https://api.tavily.com/search";
  const payload = {
    api_key: tavilyApiKey,
    query,
    search_depth: "basic",
    max_results: 8,
    include_answer: false,
    include_images: false,
    include_raw_content: true
  };
  logInfo("agent.search.request", { provider: "tavily", query, maxResults: payload.max_results });
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    logWarn("agent.search.failed", { provider: "tavily", reason: "network_error", error: (error as Error).message });
    return [];
  }
  if (!response.ok) {
    logWarn("agent.search.failed", { provider: "tavily", status: response.status });
    return [];
  }
  let responseBody: TavilySearchResponse;
  try {
    responseBody = (await response.json()) as TavilySearchResponse;
  } catch (error) {
    logWarn("agent.search.failed", { provider: "tavily", reason: "parse_failed", error: (error as Error).message });
    return [];
  }
  const results: SearchResult[] = (responseBody.results ?? [])
    .map((item) => {
      const url = typeof item.url === "string" ? item.url.trim() : "";
      const titleValue = typeof item.title === "string" ? item.title.trim() : "";
      const contentValue = typeof item.content === "string" ? item.content.trim() : "";
      const rawContentValue = typeof item.raw_content === "string" ? item.raw_content.trim() : "";
      const snippetValue = contentValue || (typeof item.snippet === "string" ? item.snippet.trim() : "");
      return {
        title: titleValue || url,
        snippet: snippetValue || titleValue,
        url,
        source: "tavily",
        content: contentValue || undefined,
        rawContent: rawContentValue || undefined
      };
    })
    .filter((result) => result.url.length > 0);

  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.url)) {
      return false;
    }
    seen.add(result.url);
    return true;
  });
};

const fetchPageHtml = async (url: string): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), pageFetchTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "scorchbook-agent/1.0",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      logWarn("agent.search.fetch.failed", { status: response.status, url });
      return null;
    }
    const html = await response.text();
    return html.slice(0, maxPageHtmlChars);
  } catch (error) {
    const reason = (error as Error).name === "AbortError" ? "timeout" : "network_error";
    logWarn("agent.search.fetch.failed", { reason, url, error: (error as Error).message });
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const scoreContentSignals = (contentText: string, context: SearchContext): number => {
  const normalized = normalizeText(contentText.slice(0, contentMatchChars));
  const nameTokens = tokensFromValue(context.name);
  const makerTokens = tokensFromValue(context.maker);
  const styleTokens = tokensFromValue(context.style);
  const keywordTokens = Array.from(
    new Set((context.keywords ?? []).flatMap((keyword) => tokensFromValue(keyword)))
  );
  let score = 0;

  if (nameTokens.length) {
    if (hasAllTokens(normalized, nameTokens)) {
      score += 5;
    } else if (nameTokens.some((token) => normalized.includes(token))) {
      score += 2;
    }
  }
  if (makerTokens.length) {
    if (hasAllTokens(normalized, makerTokens)) {
      score += 3;
    } else if (makerTokens.some((token) => normalized.includes(token))) {
      score += 1;
    }
  }
  if (styleTokens.length && styleTokens.some((token) => normalized.includes(token))) {
    score += 1;
  }
  if (keywordTokens.length && keywordTokens.some((token) => normalized.includes(token))) {
    score += 1;
  }
  if (normalized.includes("hot sauce") || normalized.includes("hotsauce")) {
    score += 1;
  }

  return score;
};

const contentKeywordWindows = [
  "tasting notes",
  "flavor",
  "flavour",
  "notes",
  "taste",
  "aroma",
  "pairing",
  "finish",
  "description",
  "ingredients",
  "heat level",
  "spice level",
  "scoville"
];

const sliceContentWindow = (text: string, index: number, before = 180, after = 220) => {
  const start = Math.max(0, index - before);
  const end = Math.min(text.length, index + after);
  return text.slice(start, end);
};

const pickRelevantContent = (contentText: string) => {
  const cleaned = collapseWhitespace(contentText);
  const lower = cleaned.toLowerCase();
  const windows: string[] = [];
  for (const keyword of contentKeywordWindows) {
    const index = lower.indexOf(keyword);
    if (index >= 0) {
      windows.push(sliceContentWindow(cleaned, index));
    }
    if (windows.length >= 6) {
      break;
    }
  }
  const combined = collapseWhitespace(windows.join(" "));
  const fallback = cleaned.slice(0, maxLlmContentChars);
  const result = combined.length > 40 ? combined : fallback;
  return result.slice(0, maxLlmContentChars);
};

const heatWordMap: Record<string, number> = {
  mild: 2,
  "medium mild": 2,
  medium: 3,
  "medium hot": 4,
  "medium-hot": 4,
  hot: 4,
  "very hot": 5,
  "extra hot": 5,
  "extremely hot": 5
};

const extractHeatFromText = (contentText: string): number | undefined => {
  const lower = contentText.toLowerCase();
  const ratioMatch = lower.match(/(?:heat|spice)\s*(?:level)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+)/);
  if (ratioMatch) {
    const value = Number(ratioMatch[1]);
    const denom = Number(ratioMatch[2]);
    if (Number.isFinite(value) && Number.isFinite(denom) && denom > 0) {
      const scaled = denom === 5 ? value : (value / denom) * 5;
      return clampScore(Math.round(scaled * 10) / 10);
    }
  }

  const numericMatch = lower.match(/(?:heat|spice)\s*(?:level)?\s*[:\-]?\s*(\d+(?:\.\d+)?)/);
  if (numericMatch) {
    const value = Number(numericMatch[1]);
    if (Number.isFinite(value)) {
      return clampScore(value);
    }
  }

  const wordMatch = lower.match(/(?:heat|spice)\s*(?:level)?\s*[:\-]?\s*([a-z\- ]{3,20})/);
  if (wordMatch) {
    const token = collapseWhitespace(wordMatch[1]).trim();
    const mapped = heatWordMap[token];
    if (mapped !== undefined) {
      return mapped;
    }
  }

  const scovilleMatch = lower.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*(?:shu|scoville)/);
  if (scovilleMatch) {
    const value = Number(scovilleMatch[1].replace(/,/g, ""));
    if (Number.isFinite(value)) {
      if (value >= 100000) return 5;
      if (value >= 20000) return 4;
      if (value >= 5000) return 3;
      if (value >= 1000) return 2;
      return 1;
    }
  }

  return undefined;
};

const extractVendorNotesFromText = (contentText: string): string | undefined => {
  const cleaned = collapseWhitespace(contentText);
  if (!cleaned) {
    return undefined;
  }
  const lower = cleaned.toLowerCase();
  const segments: string[] = [];
  for (const keyword of contentKeywordWindows) {
    if (keyword.length < 4) {
      continue;
    }
    const index = lower.indexOf(keyword);
    if (index >= 0) {
      segments.push(sliceContentWindow(cleaned, index, 120, 220));
    }
    if (segments.length >= 4) {
      break;
    }
  }
  if (!segments.length) {
    const fallback = cleaned.slice(0, 280);
    return fallback.length > 40 ? fallback : undefined;
  }
  const combined = collapseWhitespace(segments.join(" "));
  if (combined.length < 40) {
    return undefined;
  }
  return combined.slice(0, 400);
};

const extractVendorHints = (contentText: string) => ({
  heatVendor: extractHeatFromText(contentText),
  tastingNotesVendor: extractVendorNotesFromText(contentText)
});

const buildPageSignals = async (result: SearchResult, context: SearchContext): Promise<PageSignals> => {
  const baseScore = scoreSearchResult(result, context);
  const shouldFetch = !isBlockedDomain(result.url);
  const rawHtml = result.rawContent
    ? result.rawContent
    : shouldFetch
      ? await fetchPageHtml(result.url)
      : null;
  let contentText = "";
  let hasProductSchema = false;
  let contentSource: PageSignals["contentSource"] = "snippet";

  if (rawHtml) {
    hasProductSchema = containsProductSchema(rawHtml);
    if (/<[^>]+>/.test(rawHtml)) {
      contentText = extractReadableText(rawHtml);
    } else {
      contentText = collapseWhitespace(rawHtml);
    }
    contentSource = result.rawContent ? "raw" : "fetched";
  } else if (result.content) {
    contentText = collapseWhitespace(result.content);
    contentSource = "summary";
  } else {
    contentText = collapseWhitespace(`${result.title} ${result.snippet}`);
  }

  const trimmedContent = contentText.slice(0, maxPageContentChars);
  const contentScore = scoreContentSignals(trimmedContent, context);
  const schemaScore = hasProductSchema ? 3 : 0;

  return {
    result,
    score: baseScore + contentScore + schemaScore,
    contentText: trimmedContent,
    hasProductSchema,
    contentSource
  };
};

const summarizePageSignals = (pages: PageSignals[], limit = 3) =>
  pages.slice(0, limit).map((page) => ({
    url: page.result.url,
    score: page.score,
    hasProductSchema: page.hasProductSchema,
    contentSource: page.contentSource
  }));

const mergePageSignals = (primary: PageSignals[], secondary: PageSignals[]) => {
  const map = new Map<string, PageSignals>();
  for (const page of [...primary, ...secondary]) {
    const existing = map.get(page.result.url);
    if (!existing || page.score > existing.score) {
      map.set(page.result.url, page);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
};

const selectBestSearchResult = (results: SearchResult[], context: SearchContext) => {
  if (!results.length) {
    return null;
  }
  const scored = results.map((result) => ({
    ...result,
    score: scoreSearchResult(result, context)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0];
};

const summarizeSearchResults = (results: SearchResult[], context: SearchContext, limit = 3) => {
  const scored = results.map((result) => ({
    title: result.title,
    url: result.url,
    score: scoreSearchResult(result, context)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
};

const summarizeEnrichmentFields = (enrichment: AgentEnrichment) => {
  return Object.entries(enrichment)
    .filter(([_, value]) => {
      if (value === undefined || value === null) {
        return false;
      }
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      return true;
    })
    .map(([key]) => key);
};

const scoreUrlCandidate = (url: string, context: SearchContext): number => {
  const urlLower = url.toLowerCase();
  const nameTokens = tokensFromValue(context.name);
  const makerTokens = tokensFromValue(context.maker);
  const styleTokens = tokensFromValue(context.style);
  let score = 0;

  if (nameTokens.length && hasAllTokens(urlLower, nameTokens)) {
    score += 6;
  }
  if (makerTokens.length && hasAllTokens(urlLower, makerTokens)) {
    score += 4;
  }
  if (styleTokens.length && hasAllTokens(urlLower, styleTokens)) {
    score += 2;
  }
  if (urlHasProductHint(urlLower)) {
    score += 2;
  }
  score += scoreHostnameTokens(url, context);
  const trustedScore = scoreTrustedDomain(url);
  if (trustedScore) {
    score += trustedScore;
  }
  if (isMarketplaceDomain(url)) {
    score -= 1;
  }
  if (isBlockedDomain(url)) {
    score -= 6;
  }
  return score;
};

const pickBestProductUrl = (candidates: Array<string | undefined>, context: SearchContext): string | undefined => {
  const scored = candidates
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url, score: scoreUrlCandidate(url, context) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.url;
};

export type ImageExtraction = AgentEnrichment & { keywords?: string[] };

export const runImageExtraction = async (imageBase64: string, imageMimeType: string): Promise<ImageExtraction> => {
  const instructions =
    "You are a data extraction system for hot sauce bottles. Return JSON only with keys: name, maker, style, heat_vendor, tasting_notes_vendor, product_url, keywords (array of strings). Include any brand or product line keywords. Use null for unknowns.";
  const payload = buildVisionPrompt(instructions, imageBase64, imageMimeType);
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    return {};
  }
  return {
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    maker: typeof parsed.maker === "string" ? parsed.maker : undefined,
    style: typeof parsed.style === "string" ? parsed.style : undefined,
    heatVendor: clampScore(normalizeNumber(parsed.heat_vendor)),
    tastingNotesVendor: typeof parsed.tasting_notes_vendor === "string" ? parsed.tasting_notes_vendor : undefined,
    productUrl: typeof parsed.product_url === "string" ? parsed.product_url : undefined,
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((item) => typeof item === "string") : undefined
  };
};

const extractFromSearchResults = async (
  context: SearchContext,
  results: SearchResult[],
  bestUrl?: string
): Promise<AgentEnrichment> => {
  logInfo("agent.search.extract.start", { resultCount: results.length, bestUrl });
  const instructions =
    "You are selecting the best hot sauce product info from search results. Prefer the official product page. Return JSON only with keys: name, maker, style, heat_vendor, tasting_notes_vendor, product_url. Use null for unknowns.";
  const summarizedResults = results.map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.snippet
  }));
  const payload = buildTextPrompt(
    instructions,
    JSON.stringify({
      context,
      best_url: bestUrl ?? null,
      results: summarizedResults
    })
  );
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    logWarn("agent.search.extract.failed", { reason: "parse_failed" });
    return {};
  }
  const enrichment: AgentEnrichment = {
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    maker: typeof parsed.maker === "string" ? parsed.maker : undefined,
    style: typeof parsed.style === "string" ? parsed.style : undefined,
    heatVendor: clampScore(normalizeNumber(parsed.heat_vendor)),
    tastingNotesVendor: typeof parsed.tasting_notes_vendor === "string" ? parsed.tasting_notes_vendor : undefined,
    productUrl: typeof parsed.product_url === "string" ? parsed.product_url : undefined
  };
  logInfo("agent.search.extract.complete", { fields: summarizeEnrichmentFields(enrichment) });
  return enrichment;
};

const normalizeComparableText = (value?: string) => {
  if (!value) {
    return "";
  }
  return collapseWhitespace(normalizeText(value));
};

const matchesContextTokens = (value: string, contextValue?: string) => {
  const tokens = tokensFromValue(contextValue);
  if (!tokens.length) {
    return true;
  }
  const normalized = normalizeText(value);
  if (tokens.length === 1) {
    return normalized.includes(tokens[0]);
  }
  return hasAllTokens(normalized, tokens);
};

const isLikelySameValue = (left?: string, right?: string) => {
  const normalizedLeft = normalizeComparableText(left);
  const normalizedRight = normalizeComparableText(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  if (normalizedLeft === normalizedRight) {
    return true;
  }
  const leftTokens = normalizedLeft.split(" ").filter(Boolean);
  const rightTokens = normalizedRight.split(" ").filter(Boolean);
  const [shorter, longer] = leftTokens.length <= rightTokens.length ? [leftTokens, rightTokens] : [rightTokens, leftTokens];
  const overlap = shorter.filter((token) => longer.includes(token));
  return overlap.length >= Math.max(1, Math.floor(shorter.length * 0.8));
};

const scoreExtractionCandidate = (fields: AgentEnrichment, context: SearchContext, page: PageSignals): number => {
  let score = page.score;

  if (fields.name) {
    score += 2;
    if (matchesContextTokens(fields.name, context.name)) {
      score += 3;
    }
  }
  if (fields.maker) {
    score += 2;
    if (matchesContextTokens(fields.maker, context.maker)) {
      score += 2;
    }
  }
  if (fields.style) {
    score += 1;
    if (matchesContextTokens(fields.style, context.style)) {
      score += 1;
    }
  }
  if (fields.heatVendor !== undefined && fields.heatVendor !== null) {
    score += 1;
  }
  if (fields.tastingNotesVendor) {
    score += 1;
  }
  if (fields.productUrl) {
    score += 1;
    if (scoreUrlCandidate(fields.productUrl, context) > 0) {
      score += 1;
    }
    const pageHost = getHostname(page.result.url);
    const productHost = getHostname(fields.productUrl);
    if (pageHost && productHost && pageHost === productHost) {
      score += 1;
    }
  }

  return score;
};

const mergeExtractions = (primary: AgentEnrichment, secondary: AgentEnrichment | undefined, context: SearchContext) => {
  if (!secondary) {
    return primary;
  }
  const nameConsensus = isLikelySameValue(primary.name, secondary.name);
  const makerConsensus = isLikelySameValue(primary.maker, secondary.maker);
  if (!nameConsensus && !makerConsensus) {
    return primary;
  }

  const merged: AgentEnrichment = { ...primary };

  const adoptString = (
    field: "name" | "maker" | "style" | "tastingNotesVendor",
    contextValue?: string
  ) => {
    const current = merged[field];
    const candidate = secondary[field];
    if (current && current.trim().length > 0) {
      return;
    }
    if (typeof candidate !== "string" || candidate.trim().length === 0) {
      return;
    }
    if (!matchesContextTokens(candidate, contextValue)) {
      return;
    }
    merged[field] = candidate;
  };

  adoptString("name", context.name);
  adoptString("maker", context.maker);
  adoptString("style", context.style);
  adoptString("tastingNotesVendor");

  if (
    (merged.heatVendor === undefined || merged.heatVendor === null) &&
    secondary.heatVendor !== undefined &&
    secondary.heatVendor !== null
  ) {
    merged.heatVendor = secondary.heatVendor;
  }

  if (!merged.productUrl && typeof secondary.productUrl === "string" && secondary.productUrl.trim().length > 0) {
    if (scoreUrlCandidate(secondary.productUrl, context) >= 0) {
      merged.productUrl = secondary.productUrl;
    }
  }

  return merged;
};

const extractFromPageContent = async (context: SearchContext, page: PageSignals): Promise<AgentEnrichment | null> => {
  if (!page.contentText) {
    return null;
  }
  logInfo("agent.search.extract.page.start", { url: page.result.url, hasProductSchema: page.hasProductSchema });
  const hints = extractVendorHints(page.contentText);
  const relevantContent = pickRelevantContent(page.contentText);
  const instructions =
    "You are extracting hot sauce product details from a webpage. Use the context to verify relevance. If the page is not about the target product, return JSON only with key: relevant set to false. Otherwise return JSON only with keys: relevant, name, maker, style, heat_vendor, tasting_notes_vendor, product_url. Use null for unknowns. Prefer official vendor copy for tasting_notes_vendor and vendor-provided heat level or Scoville when available.";
  const payload = buildTextPrompt(
    instructions,
    JSON.stringify({
      context,
      url: page.result.url,
      title: page.result.title,
      content: relevantContent,
      hints
    })
  );
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed || typeof parsed !== "object") {
    logWarn("agent.search.extract.page.failed", { reason: "parse_failed", url: page.result.url });
    return null;
  }
  if (parsed.relevant === false) {
    logInfo("agent.search.extract.page.skipped", { reason: "irrelevant", url: page.result.url });
    return null;
  }
  const enrichment: AgentEnrichment = {
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    maker: typeof parsed.maker === "string" ? parsed.maker : undefined,
    style: typeof parsed.style === "string" ? parsed.style : undefined,
    heatVendor: clampScore(normalizeNumber(parsed.heat_vendor)),
    tastingNotesVendor: typeof parsed.tasting_notes_vendor === "string" ? parsed.tasting_notes_vendor : undefined,
    productUrl: typeof parsed.product_url === "string" ? parsed.product_url : undefined
  };
  if ((enrichment.heatVendor === undefined || enrichment.heatVendor === null) && hints.heatVendor !== undefined) {
    enrichment.heatVendor = hints.heatVendor;
  }
  if (!enrichment.tastingNotesVendor && hints.tastingNotesVendor) {
    enrichment.tastingNotesVendor = hints.tastingNotesVendor;
  }
  if (!enrichment.productUrl && (enrichment.name || enrichment.maker)) {
    enrichment.productUrl = page.result.url;
  }
  logInfo("agent.search.extract.page.complete", { url: page.result.url, fields: summarizeEnrichmentFields(enrichment) });
  return enrichment;
};

const extractFromTopPages = async (context: SearchContext, pages: PageSignals[]): Promise<AgentEnrichment> => {
  if (!pages.length) {
    return {};
  }
  const candidates = pages.slice(0, pageExtractionLimit);
  const settled = await Promise.allSettled(candidates.map((page) => extractFromPageContent(context, page)));
  const extracted = settled
    .map((result, index) => {
      if (result.status === "fulfilled" && result.value) {
        return { page: candidates[index], fields: result.value };
      }
      return null;
    })
    .filter((item): item is { page: PageSignals; fields: AgentEnrichment } => Boolean(item));
  if (!extracted.length) {
    return {};
  }
  const scored = extracted.map((item) => ({
    ...item,
    score: scoreExtractionCandidate(item.fields, context, item.page)
  }));
  scored.sort((a, b) => b.score - a.score);
  const primary = scored[0];
  const secondary = scored[1];
  if (secondary) {
    logInfo("agent.search.extract.consensus", {
      primaryUrl: primary.page.result.url,
      secondaryUrl: secondary.page.result.url,
      nameMatch: isLikelySameValue(primary.fields.name, secondary.fields.name),
      makerMatch: isLikelySameValue(primary.fields.maker, secondary.fields.maker)
    });
  }
  return mergeExtractions(primary.fields, secondary?.fields, context);
};

const mapMediaFormat = (mimeType: string): "mp3" | "mp4" | "wav" | "flac" | "ogg" | "webm" => {
  if (mimeType.includes("mp3")) {
    return "mp3";
  }
  if (mimeType.includes("mp4")) {
    return "mp4";
  }
  if (mimeType.includes("wav")) {
    return "wav";
  }
  if (mimeType.includes("flac")) {
    return "flac";
  }
  if (mimeType.includes("ogg")) {
    return "ogg";
  }
  return "webm";
};

export const transcribeVoice = async (s3Uri: string, mimeType: string): Promise<string> => {
  const jobName = `scorchbook-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startCommand = new StartTranscriptionJobCommand({
    TranscriptionJobName: jobName,
    LanguageCode: transcribeLanguage,
    Media: { MediaFileUri: s3Uri },
    MediaFormat: mapMediaFormat(mimeType),
    Settings: {
      ShowSpeakerLabels: false
    }
  });

  logInfo("agent.transcribe.start", { jobName, s3Uri });
  await transcribeClient.send(startCommand);

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
      const transcriptResponse = await fetch(transcriptUri);
      const transcriptJson = (await transcriptResponse.json()) as { results?: { transcripts?: { transcript?: string }[] } };
      const transcript = transcriptJson.results?.transcripts?.[0]?.transcript ?? "";
      logInfo("agent.transcribe.completed", { jobName });
      return transcript;
    }
    if (status === "FAILED") {
      throw new Error("Transcribe job failed");
    }
  }

  throw new Error("Transcribe job timed out");
};

const stripRatingsFromNotes = (notes: string): string => {
  const patterns = [
    /\b\d+\s*\/\s*10\b/gi,
    /\b\d+\s*\/\s*5\b/gi,
    /\b\d+\s*out of\s*10\b/gi,
    /\b(score|rating)\s*[:\-]?\s*\d+(\.\d+)?\b/gi,
    /\b(heat|heat level|spice level)\s*[:\-]?\s*\d+(\.\d+)?\b/gi
  ];
  let cleaned = notes;
  for (const pattern of patterns) {
    cleaned = cleaned.replace(pattern, "");
  }
  cleaned = cleaned.replace(/\b(uh|um|erm|er|hmm+)\b/gi, " ");
  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return lines.join("\n").replace(/\s{2,}/g, " ").replace(/\s+\./g, ".").trim();
};

const fallbackTastingNotesFromTranscript = (transcript: string): string | undefined => {
  const trimmed = transcript.trim();
  if (!trimmed || trimmed.length < 12) {
    return undefined;
  }
  return trimmed.slice(0, 1200);
};

type NotesResult = {
  notes?: string;
  source: "llm" | "fallback" | "none";
};

const formatNotesLabel = (label: string) => {
  const cleaned = label.trim();
  if (!cleaned) {
    return "Note";
  }
  const normalized = cleaned.toLowerCase();
  const known: Record<string, string> = {
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
  if (known[normalized]) {
    return known[normalized];
  }
  return cleaned
    .replace(/[_-]+/g, " ")
    .split(" ")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ")
    .trim();
};

const notesToString = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  if (!value) {
    return "";
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .join("\n");
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
  const preferredOrder = ["flavor", "aroma", "texture", "heat", "pairings", "finish"];
  const weighted = entries.map(([key, val]) => ({
    key,
    label: formatNotesLabel(key),
    value: val as string,
    weight: preferredOrder.indexOf(key.toLowerCase())
  }));
  weighted.sort((a, b) => {
    if (a.weight === -1 && b.weight === -1) {
      return 0;
    }
    if (a.weight === -1) return 1;
    if (b.weight === -1) return -1;
    return a.weight - b.weight;
  });
  return weighted.map((entry) => `${entry.label}: ${entry.value.trim()}`).join("\n");
};

const runNotesLlm = async (transcript: string): Promise<string> => {
  const instructions =
    "Rewrite this transcript into clean tasting notes. Output JSON only with key: tasting_notes_user as a single string. Use short labeled lines if relevant: Flavor, Aroma, Texture, Heat, Pairings, Finish. Remove numeric ratings or scores; do not include numbers like 8/10. Remove filler words like um/uh. Keep descriptive text even if informal. If the transcript contains no tasting notes, return an empty string. Do not return nested objects or arrays.";
  const payload = buildTextPrompt(instructions, transcript);
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    return "";
  }
  const rawNotes = (parsed as Record<string, unknown>).tasting_notes_user;
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

export const runSearchEnrichment = async (
  context: SearchContext,
  candidateUrls: Array<string | undefined> = []
): Promise<{ searchFields: AgentEnrichment; searchCount: number; bestResultUrl?: string }> => {
  const query = buildSearchQuery(context);
  if (!query) {
    logWarn("agent.search.skipped", { reason: "missing_query_terms" });
    return { searchFields: {}, searchCount: 0 };
  }
  logInfo("agent.search.context", {
    query,
    context,
    candidateUrls: candidateUrls.filter(Boolean)
  });
  let searchResults = await searchTavily(query);
  const officialQuery = buildOfficialQuery(context);
  if (
    officialQuery &&
    (searchResults.length === 0 || shouldRunOfficialQuery(searchResults, context))
  ) {
    const officialResults = await searchTavily(officialQuery);
    if (officialResults.length) {
      logInfo("agent.search.official", { query: officialQuery, added: officialResults.length });
    }
    searchResults = mergeSearchResults(searchResults, officialResults);
  }
  logInfo("agent.search.results", { count: searchResults.length, query });
  if (searchResults.length === 0) {
    logWarn("agent.search.empty", { query });
  } else {
    logInfo("agent.search.top", { results: summarizeSearchResults(searchResults, context) });
  }
  const bestResult = selectBestSearchResult(searchResults, context);
  let pageSignals = searchResults.length
    ? (
        await Promise.allSettled(
          searchResults
            .map((result) => ({ result, score: scoreSearchResult(result, context) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, pageFetchLimit)
            .map((item) => buildPageSignals(item.result, context))
        )
      )
        .filter(
          (result): result is { status: "fulfilled"; value: PageSignals } => result.status === "fulfilled"
        )
        .map((result) => result.value)
        .sort((a, b) => b.score - a.score)
    : [];

  const candidatePageUrls = candidateUrls.filter((url): url is string => Boolean(url));
  if (candidatePageUrls.length) {
    const candidateResults = candidatePageUrls
      .filter((url) => !searchResults.some((result) => result.url === url))
      .slice(0, candidatePageLimit)
      .map((url) => ({
        title: url,
        url,
        snippet: "",
        source: "tavily" as const
      }));
    if (candidateResults.length) {
      const candidateSignals = (
        await Promise.allSettled(candidateResults.map((result) => buildPageSignals(result, context)))
      )
        .filter(
          (result): result is { status: "fulfilled"; value: PageSignals } => result.status === "fulfilled"
        )
        .map((result) => result.value);
      pageSignals = mergePageSignals(pageSignals, candidateSignals);
    }
  }

  if (pageSignals.length) {
    logInfo("agent.search.pages", { results: summarizePageSignals(pageSignals) });
  }

  const bestPage = pageSignals[0]?.result ?? bestResult;
  const bestPageScore = pageSignals[0]?.score ?? bestResult?.score;
  if (bestPage) {
    logInfo("agent.search.best", { url: bestPage.url, score: bestPageScore });
  }

  let searchFields = pageSignals.length ? await extractFromTopPages(context, pageSignals) : {};
  if (pageSignals.length && (searchFields.heatVendor == null || !searchFields.tastingNotesVendor)) {
    const extraPages = pageSignals.slice(pageExtractionLimit, pageExtractionLimit + 2);
    logInfo("agent.search.extract.more", {
      missingHeat: searchFields.heatVendor == null,
      missingNotes: !searchFields.tastingNotesVendor,
      candidateCount: extraPages.length
    });
    for (const page of extraPages) {
      const extra = await extractFromPageContent(context, page);
      if (extra) {
        if (searchFields.heatVendor == null && extra.heatVendor != null) {
          searchFields.heatVendor = extra.heatVendor;
        }
        if (!searchFields.tastingNotesVendor && extra.tastingNotesVendor) {
          searchFields.tastingNotesVendor = extra.tastingNotesVendor;
        }
        if (!searchFields.productUrl && extra.productUrl) {
          searchFields.productUrl = extra.productUrl;
        }
      }
      if (searchFields.heatVendor != null && searchFields.tastingNotesVendor) {
        break;
      }
    }
  }
  if (summarizeEnrichmentFields(searchFields).length === 0 && searchResults.length > 0) {
    searchFields = await extractFromSearchResults(context, searchResults.slice(0, 8), bestPage?.url);
  }

  const pageUrls = pageSignals.slice(0, 3).map((page) => page.result.url);
  const bestProductUrl = pickBestProductUrl(
    [...candidateUrls, bestPage?.url, searchFields.productUrl, ...pageUrls],
    context
  );
  if (bestProductUrl) {
    searchFields.productUrl = bestProductUrl;
    logInfo("agent.search.product_url", { productUrl: bestProductUrl });
  }
  logInfo("agent.search.fields", { fields: summarizeEnrichmentFields(searchFields) });
  return {
    searchFields,
    searchCount: searchResults.length,
    bestResultUrl: bestPage?.url
  };
};
