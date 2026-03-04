export const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

export const stripHtml = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]*>/g, " "); // eslint-disable-line sonarjs/slow-regex -- negated char class, no backtracking

export const extractReadableText = (html: string) => collapseWhitespace(decodeHtmlEntities(stripHtml(html)));

export const containsProductSchema = (html: string) => {
  const productJsonLd = /"@type"\s*:\s*"Product"/i.test(html) || /"@type"\s*:\s*\[\s*"Product"/i.test(html);
  const productMicrodata = /itemtype\s*=\s*"https?:\/\/schema\.org\/Product"/i.test(html);
  return productJsonLd || productMicrodata;
};

export const tokensFromValue = (value?: string) => {
  if (!value) {
    return [];
  }
  const tokens = normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
  return Array.from(new Set(tokens));
};

export const hasAllTokens = (text: string, tokens: string[]) => tokens.every((token) => text.includes(token));

export const normalizeComparableText = (value?: string) => {
  if (!value) {
    return "";
  }
  return collapseWhitespace(normalizeText(value));
};

export const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};
