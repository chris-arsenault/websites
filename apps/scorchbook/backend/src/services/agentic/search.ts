import { logInfo, logWarn } from "../../utils/logger";
import { collapseWhitespace, containsProductSchema, extractReadableText, hasAllTokens, normalizeText, tokensFromValue } from "./text";
import { parseSecretApiKey } from "./llm";
import { isBlockedDomain, scoreContentSignals, scoreHostnameTokens, scoreSearchResult } from "./scoring";
import type { PageSignals, SearchContext, SearchResult, TavilySearchResult, TavilySearchResponse } from "./types";

const tavilyApiKey = parseSecretApiKey(process.env.TAVILY_API_KEY);

export const pageFetchTimeoutMs = 4500;
export const pageFetchLimit = 4;
export const pageExtractionLimit = 3;
export const candidatePageLimit = 2;
export const maxPageHtmlChars = 120000;
export const maxPageContentChars = 12000;
export const maxLlmContentChars = 4000;

export const contentKeywordWindows = [
  "tasting notes", "flavor", "flavour", "notes", "taste", "aroma",
  "pairing", "finish", "description", "ingredients", "heat level", "spice level", "scoville"
];

const sliceContentWindow = (text: string, index: number, before = 180, after = 220) => {
  const start = Math.max(0, index - before);
  const end = Math.min(text.length, index + after);
  return text.slice(start, end);
};

export const pickRelevantContent = (contentText: string) => {
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

export const buildSearchQuery = (context: SearchContext): string => {
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

export const buildOfficialQuery = (context: SearchContext): string => {
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

export const mergeSearchResults = (primary: SearchResult[], secondary: SearchResult[]): SearchResult[] => {
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

export const shouldRunOfficialQuery = (results: SearchResult[], context: SearchContext): boolean => {
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

const trimString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const normalizeTavilyResult = (item: TavilySearchResult): SearchResult => {
  const url = trimString(item.url);
  const titleValue = trimString(item.title);
  const contentValue = trimString(item.content);
  const rawContentValue = trimString(item.raw_content);
  const snippetValue = contentValue || trimString(item.snippet);
  return {
    title: titleValue || url,
    snippet: snippetValue || titleValue,
    url,
    source: "tavily" as const,
    content: contentValue || undefined,
    rawContent: rawContentValue || undefined
  };
};

const normalizeTavilyResults = (items: TavilySearchResponse["results"]): SearchResult[] =>
  (items ?? []).map(normalizeTavilyResult).filter((result) => result.url.length > 0);

const deduplicateByUrl = (results: SearchResult[]): SearchResult[] => {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.url)) {
      return false;
    }
    seen.add(result.url);
    return true;
  });
};

export const searchTavily = async (query: string): Promise<SearchResult[]> => {
  if (!query || !tavilyApiKey) {
    if (!tavilyApiKey) {
      logWarn("agent.search.skipped", { reason: "missing_tavily_key" });
    }
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
      headers: { "Content-Type": "application/json", Accept: "application/json" },
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
  return deduplicateByUrl(normalizeTavilyResults(responseBody.results));
};

export const fetchPageHtml = async (url: string): Promise<string | null> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), pageFetchTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "scorchbook-agent/1.0", Accept: "text/html,application/xhtml+xml" },
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

const resolvePageContent = async (result: SearchResult): Promise<{ contentText: string; hasProductSchema: boolean; contentSource: PageSignals["contentSource"] }> => {
  const shouldFetch = !isBlockedDomain(result.url);
  const rawHtml = result.rawContent ?? (shouldFetch ? await fetchPageHtml(result.url) : null);

  if (rawHtml) {
    const hasProductSchema = containsProductSchema(rawHtml);
    const contentText = rawHtml.includes("<") && rawHtml.includes(">") ? extractReadableText(rawHtml) : collapseWhitespace(rawHtml);
    const contentSource: PageSignals["contentSource"] = result.rawContent ? "raw" : "fetched";
    return { contentText, hasProductSchema, contentSource };
  }
  if (result.content) {
    return { contentText: collapseWhitespace(result.content), hasProductSchema: false, contentSource: "summary" };
  }
  return { contentText: collapseWhitespace(`${result.title} ${result.snippet}`), hasProductSchema: false, contentSource: "snippet" };
};

export const buildPageSignals = async (result: SearchResult, context: SearchContext): Promise<PageSignals> => {
  const baseScore = scoreSearchResult(result, context);
  const { contentText: rawContent, hasProductSchema, contentSource } = await resolvePageContent(result);
  const contentText = rawContent.slice(0, maxPageContentChars);
  const contentScore = scoreContentSignals(contentText, context);
  const schemaScore = hasProductSchema ? 3 : 0;
  return { result, score: baseScore + contentScore + schemaScore, contentText, hasProductSchema, contentSource };
};

export const summarizePageSignals = (pages: PageSignals[], limit = 3) =>
  pages.slice(0, limit).map((page) => ({
    url: page.result.url,
    score: page.score,
    hasProductSchema: page.hasProductSchema,
    contentSource: page.contentSource
  }));

export const mergePageSignals = (primary: PageSignals[], secondary: PageSignals[]) => {
  const map = new Map<string, PageSignals>();
  for (const page of [...primary, ...secondary]) {
    const existing = map.get(page.result.url);
    if (!existing || page.score > existing.score) {
      map.set(page.result.url, page);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.score - a.score);
};
