import { getHostname, hasAllTokens, normalizeText, tokensFromValue, normalizeComparableText } from "./text";
import type { AgentEnrichment, SearchContext, SearchResult, PageSignals } from "./types";

const productUrlHints = ["/product/", "/products/", "/shop/", "/store/", "/p/", "/dp/"];

const trustedDomainScores: Record<string, number> = {
  "heatonist.com": 4,
  "hotsauce.com": 4,
  "pepperpalace.com": 4,
  "amazon.com": 1,
  "walmart.com": 1,
  "target.com": 1
};

const blockedDomains = [
  "facebook.com", "instagram.com", "twitter.com", "x.com",
  "tiktok.com", "pinterest.com", "reddit.com", "youtube.com", "wikipedia.org"
];

const marketplaceDomains = [
  "amazon.com", "walmart.com", "ebay.com", "etsy.com", "target.com", "instacart.com"
];

export const urlHasProductHint = (url: string) => {
  const urlLower = url.toLowerCase();
  return productUrlHints.some((pattern) => urlLower.includes(pattern));
};

export const isBlockedDomain = (url: string) => {
  const hostname = getHostname(url);
  return hostname ? blockedDomains.some((domain) => hostname.endsWith(domain)) : false;
};

export const isMarketplaceDomain = (url: string) => {
  const hostname = getHostname(url);
  return hostname ? marketplaceDomains.some((domain) => hostname.endsWith(domain)) : false;
};

export const scoreTrustedDomain = (url: string) => {
  const hostname = getHostname(url);
  if (!hostname) {
    return 0;
  }
  return Object.entries(trustedDomainScores).reduce((score, [domain, weight]) => {
    return hostname.endsWith(domain) ? Math.max(score, weight) : score;
  }, 0);
};

export const scoreHostnameTokens = (url: string, context: SearchContext): number => {
  const hostname = getHostname(url);
  if (!hostname) {
    return 0;
  }
  const hostValue = hostname.replace(/\./g, "");
  let score = 0;
  score += scoreTokenSetAgainstHost(hostValue, tokensFromValue(context.maker), 6, 2);
  score += scoreTokenSetAgainstHost(hostValue, tokensFromValue(context.name), 3, 1);
  return score;
};

const scoreTokenSetAgainstHost = (host: string, tokens: string[], allBonus: number, partialBase: number): number => {
  if (!tokens.length) {
    return 0;
  }
  const matches = tokens.filter((token) => host.includes(token));
  if (matches.length === tokens.length) {
    return allBonus;
  }
  return matches.length > 0 ? partialBase + matches.length : 0;
};

const scoreTextTokenMatches = (text: string, context: SearchContext): number => {
  let score = 0;
  const nameTokens = tokensFromValue(context.name);
  const makerTokens = tokensFromValue(context.maker);
  const styleTokens = tokensFromValue(context.style);
  if (nameTokens.length && hasAllTokens(text, nameTokens)) {
    score += 6;
  }
  if (makerTokens.length && hasAllTokens(text, makerTokens)) {
    score += 4;
  }
  if (styleTokens.length && hasAllTokens(text, styleTokens)) {
    score += 2;
  }
  if (text.includes("hot sauce") || text.includes("hotsauce")) {
    score += 2;
  }
  return score;
};

const scoreUrlTokenMatches = (url: string, context: SearchContext): number => {
  let score = 0;
  const nameTokens = tokensFromValue(context.name);
  const makerTokens = tokensFromValue(context.maker);
  if (nameTokens.length && hasAllTokens(url, nameTokens)) {
    score += 5;
  }
  if (makerTokens.length && hasAllTokens(url, makerTokens)) {
    score += 3;
  }
  return score;
};

const scoreDomainSignals = (url: string): number => {
  let score = 0;
  if (urlHasProductHint(url)) {
    score += 1;
  }
  const trusted = scoreTrustedDomain(url);
  if (trusted) {
    score += trusted;
  }
  if (isMarketplaceDomain(url)) {
    score -= 1;
  }
  if (isBlockedDomain(url)) {
    score -= 6;
  }
  return score;
};

export const scoreSearchResult = (result: SearchResult, context: SearchContext): number => {
  const text = normalizeText(`${result.title} ${result.snippet}`);
  const url = result.url.toLowerCase();
  return (
    scoreTextTokenMatches(text, context) +
    scoreUrlTokenMatches(url, context) +
    scoreHostnameTokens(result.url, context) +
    scoreDomainSignals(result.url)
  );
};

const scoreContentNameTokens = (normalized: string, nameTokens: string[]): number => {
  if (!nameTokens.length) {
    return 0;
  }
  if (hasAllTokens(normalized, nameTokens)) {
    return 5;
  }
  return nameTokens.some((token) => normalized.includes(token)) ? 2 : 0;
};

const scoreContentMakerTokens = (normalized: string, makerTokens: string[]): number => {
  if (!makerTokens.length) {
    return 0;
  }
  if (hasAllTokens(normalized, makerTokens)) {
    return 3;
  }
  return makerTokens.some((token) => normalized.includes(token)) ? 1 : 0;
};

export const contentMatchChars = 8000;

export const scoreContentSignals = (contentText: string, context: SearchContext): number => {
  const normalized = normalizeText(contentText.slice(0, contentMatchChars));
  const nameTokens = tokensFromValue(context.name);
  const makerTokens = tokensFromValue(context.maker);
  const styleTokens = tokensFromValue(context.style);
  const keywordTokens = Array.from(
    new Set((context.keywords ?? []).flatMap((keyword) => tokensFromValue(keyword)))
  );

  let score = 0;
  score += scoreContentNameTokens(normalized, nameTokens);
  score += scoreContentMakerTokens(normalized, makerTokens);
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

export const scoreUrlCandidate = (url: string, context: SearchContext): number => {
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
  score += scoreDomainSignals(url);
  score += scoreHostnameTokens(url, context);
  return score;
};

export const matchesContextTokens = (value: string, contextValue?: string) => {
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

export const isLikelySameValue = (left?: string, right?: string) => {
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

const scoreExtractionFieldPresence = (fields: AgentEnrichment, context: SearchContext): number => {
  let score = 0;
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
  return score;
};

const scoreExtractionMetadata = (fields: AgentEnrichment, context: SearchContext, page: PageSignals): number => {
  let score = 0;
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

export const scoreExtractionCandidate = (fields: AgentEnrichment, context: SearchContext, page: PageSignals): number => {
  return page.score + scoreExtractionFieldPresence(fields, context) + scoreExtractionMetadata(fields, context, page);
};

export const pickBestProductUrl = (candidates: Array<string | undefined>, context: SearchContext): string | undefined => {
  const scored = candidates
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ url, score: scoreUrlCandidate(url, context) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.url;
};

export const selectBestSearchResult = (results: SearchResult[], context: SearchContext) => {
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

export const summarizeSearchResults = (results: SearchResult[], context: SearchContext, limit = 3) => {
  const scored = results.map((result) => ({
    title: result.title,
    url: result.url,
    score: scoreSearchResult(result, context)
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
};

export const summarizeEnrichmentFields = (enrichment: AgentEnrichment) => {
  return Object.entries(enrichment)
    .filter(([_, value]) => {
      if (value == null) {
        return false;
      }
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      return true;
    })
    .map(([key]) => key);
};
