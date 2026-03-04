import { logInfo, logWarn } from "../../utils/logger";
import { scoreSearchResult } from "./scoring";
import {
  buildSearchQuery, buildOfficialQuery, searchTavily, mergeSearchResults,
  shouldRunOfficialQuery, buildPageSignals, mergePageSignals,
  summarizePageSignals, pageFetchLimit, pageExtractionLimit, candidatePageLimit
} from "./search";
import { selectBestSearchResult, summarizeSearchResults, summarizeEnrichmentFields, pickBestProductUrl } from "./scoring";
import { extractFromTopPages, extractFromPageContent, extractFromSearchResults } from "./extraction";
import type { AgentEnrichment, SearchContext, SearchResult, PageSignals } from "./types";

const executeSearchPhase = async (context: SearchContext): Promise<SearchResult[]> => {
  const query = buildSearchQuery(context);
  if (!query) {
    logWarn("agent.search.skipped", { reason: "missing_query_terms" });
    return [];
  }
  logInfo("agent.search.context", { query, context });
  let searchResults = await searchTavily(query);
  const officialQuery = buildOfficialQuery(context);
  if (officialQuery && (searchResults.length === 0 || shouldRunOfficialQuery(searchResults, context))) {
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
  return searchResults;
};

const collectFulfilledSignals = (settled: PromiseSettledResult<PageSignals>[]): PageSignals[] =>
  settled
    .filter((result): result is { status: "fulfilled"; value: PageSignals } => result.status === "fulfilled")
    .map((result) => result.value);

const buildSearchPageSignals = async (searchResults: SearchResult[], context: SearchContext): Promise<PageSignals[]> => {
  if (!searchResults.length) {
    return [];
  }
  const topResults = searchResults
    .map((result) => ({ result, score: scoreSearchResult(result, context) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, pageFetchLimit);
  const settled = await Promise.allSettled(topResults.map((item) => buildPageSignals(item.result, context)));
  return collectFulfilledSignals(settled).sort((a, b) => b.score - a.score);
};

const buildCandidatePageSignals = async (
  candidateUrls: Array<string | undefined>,
  searchResults: SearchResult[],
  context: SearchContext
): Promise<PageSignals[]> => {
  const candidatePageUrls = candidateUrls.filter((url): url is string => Boolean(url));
  if (!candidatePageUrls.length) {
    return [];
  }
  const candidateResults = candidatePageUrls
    .filter((url) => !searchResults.some((result) => result.url === url))
    .slice(0, candidatePageLimit)
    .map((url) => ({ title: url, url, snippet: "", source: "tavily" as const }));
  if (!candidateResults.length) {
    return [];
  }
  const settled = await Promise.allSettled(candidateResults.map((result) => buildPageSignals(result, context)));
  return collectFulfilledSignals(settled);
};

const buildPageSignalsPhase = async (
  searchResults: SearchResult[],
  context: SearchContext,
  candidateUrls: Array<string | undefined>
): Promise<PageSignals[]> => {
  const searchSignals = await buildSearchPageSignals(searchResults, context);
  const candidateSignals = await buildCandidatePageSignals(candidateUrls, searchResults, context);
  const pageSignals = candidateSignals.length ? mergePageSignals(searchSignals, candidateSignals) : searchSignals;
  if (pageSignals.length) {
    logInfo("agent.search.pages", { results: summarizePageSignals(pageSignals) });
  }
  return pageSignals;
};

const adoptMissingFields = (target: AgentEnrichment, source: AgentEnrichment): void => {
  if (target.heatVendor == null && source.heatVendor != null) {
    target.heatVendor = source.heatVendor;
  }
  if (!target.tastingNotesVendor && source.tastingNotesVendor) {
    target.tastingNotesVendor = source.tastingNotesVendor;
  }
  if (!target.productUrl && source.productUrl) {
    target.productUrl = source.productUrl;
  }
};

const hasAllCriticalFields = (fields: AgentEnrichment): boolean =>
  fields.heatVendor != null && Boolean(fields.tastingNotesVendor);

const fillMissingFields = async (
  searchFields: AgentEnrichment,
  pageSignals: PageSignals[],
  context: SearchContext
): Promise<void> => {
  if (hasAllCriticalFields(searchFields)) {
    return;
  }
  const extraPages = pageSignals.slice(pageExtractionLimit, pageExtractionLimit + 2);
  logInfo("agent.search.extract.more", {
    missingHeat: searchFields.heatVendor == null,
    missingNotes: !searchFields.tastingNotesVendor,
    candidateCount: extraPages.length
  });
  for (const page of extraPages) {
    const extra = await extractFromPageContent(context, page);
    if (extra) {
      adoptMissingFields(searchFields, extra);
    }
    if (hasAllCriticalFields(searchFields)) {
      break;
    }
  }
};

const extractFieldsPhase = async (
  context: SearchContext,
  searchResults: SearchResult[],
  pageSignals: PageSignals[],
  bestPageUrl?: string
): Promise<AgentEnrichment> => {
  let searchFields = pageSignals.length ? await extractFromTopPages(context, pageSignals) : {};
  if (pageSignals.length) {
    await fillMissingFields(searchFields, pageSignals, context);
  }
  if (summarizeEnrichmentFields(searchFields).length === 0 && searchResults.length > 0) {
    searchFields = await extractFromSearchResults(context, searchResults.slice(0, 8), bestPageUrl);
  }
  return searchFields;
};

const selectBestProductUrl = (
  searchFields: AgentEnrichment,
  pageSignals: PageSignals[],
  candidateUrls: Array<string | undefined>,
  context: SearchContext,
  bestPageUrl?: string
): void => {
  const pageUrls = pageSignals.slice(0, 3).map((page) => page.result.url);
  const bestProductUrl = pickBestProductUrl(
    [...candidateUrls, bestPageUrl, searchFields.productUrl, ...pageUrls],
    context
  );
  if (bestProductUrl) {
    searchFields.productUrl = bestProductUrl;
    logInfo("agent.search.product_url", { productUrl: bestProductUrl });
  }
};

const findBestPage = (
  pageSignals: PageSignals[],
  searchResults: SearchResult[],
  context: SearchContext
): { url?: string; score?: number } => {
  const bestResult = selectBestSearchResult(searchResults, context);
  const topPage = pageSignals[0];
  const bestPage = topPage?.result ?? bestResult;
  return { url: bestPage?.url, score: topPage?.score ?? bestResult?.score };
};

export const runSearchEnrichment = async (
  context: SearchContext,
  candidateUrls: Array<string | undefined> = []
): Promise<{ searchFields: AgentEnrichment; searchCount: number; bestResultUrl?: string }> => {
  const searchResults = await executeSearchPhase(context);
  if (!searchResults.length && !buildSearchQuery(context)) {
    return { searchFields: {}, searchCount: 0 };
  }

  const pageSignals = await buildPageSignalsPhase(searchResults, context, candidateUrls);
  const best = findBestPage(pageSignals, searchResults, context);
  if (best.url) {
    logInfo("agent.search.best", { url: best.url, score: best.score });
  }

  const searchFields = await extractFieldsPhase(context, searchResults, pageSignals, best.url);
  selectBestProductUrl(searchFields, pageSignals, candidateUrls, context, best.url);

  logInfo("agent.search.fields", { fields: summarizeEnrichmentFields(searchFields) });
  return {
    searchFields,
    searchCount: searchResults.length,
    bestResultUrl: best.url
  };
};
