import { logInfo, logWarn } from "../../utils/logger";
import { collapseWhitespace } from "./text";
import { invokeClaude, buildTextPrompt, buildVisionPrompt, parseJsonFromText, normalizeNumber, clampScore } from "./llm";
import { scoreExtractionCandidate, scoreUrlCandidate, isLikelySameValue, matchesContextTokens, summarizeEnrichmentFields } from "./scoring";
import { pickRelevantContent, contentKeywordWindows } from "./search";
import type { AgentEnrichment, NutritionFacts, SearchContext, SearchResult, PageSignals, ImageExtraction, IngredientsExtraction, NutritionExtraction } from "./types";

const heatWordMap: Partial<Record<string, number>> = {
  mild: 2, "medium mild": 2, medium: 3, "medium hot": 4,
  "medium-hot": 4, hot: 4, "very hot": 5, "extra hot": 5, "extremely hot": 5
};

const extractHeatRatio = (lower: string): number | undefined => {
  // eslint-disable-next-line sonarjs/slow-regex -- input is pre-normalized short text, no backtracking risk
  const match = /(?:heat|spice) *(?:level)? *[:\-]? *(\d+(?:\.\d+)?) *\/ *(\d+)/.exec(lower);
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]);
  const denom = Number(match[2]);
  if (!Number.isFinite(value) || !Number.isFinite(denom) || denom <= 0) {
    return undefined;
  }
  const scaled = denom === 5 ? value : (value / denom) * 5;
  return clampScore(Math.round(scaled * 10) / 10) ?? undefined;
};

const extractHeatNumeric = (lower: string): number | undefined => {
  // eslint-disable-next-line sonarjs/slow-regex -- input is pre-normalized short text, no backtracking risk
  const match = /(?:heat|spice) *(?:level)? *[:\-]? *(\d+(?:\.\d+)?)/.exec(lower);
  if (!match) {
    return undefined;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? (clampScore(value) ?? undefined) : undefined;
};

const extractHeatWord = (lower: string): number | undefined => {
  const match = /(?:heat|spice) *(?:level)? *[:\-]? *([a-z\- ]{3,20})/.exec(lower);
  if (!match) {
    return undefined;
  }
  const token = collapseWhitespace(match[1]).trim();
  return heatWordMap[token];
};

const scovilleToScore = (shu: number): number => {
  if (shu >= 100000) return 5;
  if (shu >= 20000) return 4;
  if (shu >= 5000) return 3;
  if (shu >= 1000) return 2;
  return 1;
};

const extractHeatScoville = (lower: string): number | undefined => {
  // eslint-disable-next-line sonarjs/slow-regex -- input is pre-normalized short text, no backtracking risk
  const match = /(\d{1,3}(?:,\d{3})+|\d{4,}) *(?:shu|scoville)/.exec(lower);
  if (!match) {
    return undefined;
  }
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? scovilleToScore(value) : undefined;
};

export const extractHeatFromText = (contentText: string): number | undefined => {
  const lower = contentText.toLowerCase();
  return extractHeatRatio(lower) ?? extractHeatNumeric(lower) ?? extractHeatWord(lower) ?? extractHeatScoville(lower);
};

const sliceContentWindow = (text: string, index: number, before: number, after: number) => {
  const start = Math.max(0, index - before);
  const end = Math.min(text.length, index + after);
  return text.slice(start, end);
};

export const extractVendorNotesFromText = (contentText: string): string | undefined => {
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
  return combined.length >= 40 ? combined.slice(0, 400) : undefined;
};

export const extractVendorHints = (contentText: string) => ({
  heatVendor: extractHeatFromText(contentText),
  tastingNotesVendor: extractVendorNotesFromText(contentText)
});

const parseLlmEnrichment = (parsed: Record<string, unknown>): AgentEnrichment => ({
  name: typeof parsed.name === "string" ? parsed.name : undefined,
  maker: typeof parsed.maker === "string" ? parsed.maker : undefined,
  style: typeof parsed.style === "string" ? parsed.style : undefined,
  heatVendor: clampScore(normalizeNumber(parsed.heat_vendor)),
  tastingNotesVendor: typeof parsed.tasting_notes_vendor === "string" ? parsed.tasting_notes_vendor : undefined,
  productUrl: typeof parsed.product_url === "string" ? parsed.product_url : undefined
});

export const runImageExtraction = async (imageBase64: string, imageMimeType: string): Promise<ImageExtraction> => {
  const instructions = `Analyze this product image and extract information.

First, determine the product type:
- "sauce" = hot sauce, pepper sauce, chili sauce, salsa
- "drink" = non-alcoholic beverage (kombucha, juice, soda, sparkling water, tea, coffee, NA beer, mocktail, smoothie, sports drink)

Return JSON with these keys:
{
  "product_type": "sauce" or "drink",
  "name": "product name",
  "maker": "brand/manufacturer",
  "style": "style category",
  "keywords": ["relevant", "search", "keywords"]
}

Style examples:
- For sauces: Habanero, Ghost Pepper, Chipotle, Cayenne, Carolina Reaper, Sriracha, Buffalo
- For drinks: Kombucha, NA Beer, Mocktail, Juice, Soda, Sparkling Water, Tea, Coffee, Smoothie, Sports Drink

Use null for any field you cannot determine.`;
  const payload = buildVisionPrompt(instructions, imageBase64, imageMimeType);
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    return {};
  }
  const productType = parsed.product_type === "drink" ? "drink" : "sauce";
  return {
    productType,
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    maker: typeof parsed.maker === "string" ? parsed.maker : undefined,
    style: typeof parsed.style === "string" ? parsed.style : undefined,
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.filter((item) => typeof item === "string") : undefined
  };
};

export const runIngredientsExtraction = async (imageBase64: string, imageMimeType: string): Promise<IngredientsExtraction> => {
  const instructions = `Extract the ingredients list from this hot sauce label image.

Return JSON with exactly these keys:
{
  "ingredients": ["ingredient1", "ingredient2", ...]
}

Guidelines:
- Find the ingredients list (usually starts with "Ingredients:")
- List each ingredient separately, in order shown on label
- Simplify ingredient names: "Red Habanero Peppers" not "Red Habanero Peppers (Capsicum chinense)"
- If no ingredients list visible, set ingredients to empty array`;
  const payload = buildVisionPrompt(instructions, imageBase64, imageMimeType);
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    return {};
  }
  const ingredients = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : undefined;
  return { ingredients };
};

export const runNutritionFactsExtraction = async (imageBase64: string, imageMimeType: string): Promise<NutritionExtraction> => {
  const instructions = `Extract nutrition facts from this hot sauce label image.

Return JSON with exactly these keys:
{
  "nutrition_facts": {
    "serving_size": "e.g. 1 tsp (5g)",
    "calories": number or null,
    "total_fat": "e.g. 0g",
    "sodium": "e.g. 190mg",
    "total_carbs": "e.g. 1g",
    "sugars": "e.g. 0g",
    "protein": "e.g. 0g"
  }
}

Guidelines:
- Look for "Nutrition Facts" panel - extract serving size and per-serving values
- Include units with values (mg, g, etc.) except calories which is just a number
- Use null for any nutrition value not visible or legible
- If no nutrition panel visible, set nutrition_facts to null`;
  const payload = buildVisionPrompt(instructions, imageBase64, imageMimeType);
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    return {};
  }
  const rawNutrition = parsed.nutrition_facts as Record<string, unknown> | undefined;
  const nutritionFacts: NutritionFacts | undefined = rawNutrition ? {
    servingSize: typeof rawNutrition.serving_size === "string" ? rawNutrition.serving_size : undefined,
    calories: normalizeNumber(rawNutrition.calories) ?? undefined,
    totalFat: typeof rawNutrition.total_fat === "string" ? rawNutrition.total_fat : undefined,
    sodium: typeof rawNutrition.sodium === "string" ? rawNutrition.sodium : undefined,
    totalCarbs: typeof rawNutrition.total_carbs === "string" ? rawNutrition.total_carbs : undefined,
    sugars: typeof rawNutrition.sugars === "string" ? rawNutrition.sugars : undefined,
    protein: typeof rawNutrition.protein === "string" ? rawNutrition.protein : undefined
  } : undefined;
  return { nutritionFacts };
};

export const extractFromSearchResults = async (
  context: SearchContext,
  results: SearchResult[],
  bestUrl?: string
): Promise<AgentEnrichment> => {
  logInfo("agent.search.extract.start", { resultCount: results.length, bestUrl });
  const instructions =
    "You are selecting the best hot sauce product info from search results. Prefer the official product page. Return JSON only with keys: name, maker, style, heat_vendor, tasting_notes_vendor, product_url. Use null for unknowns.";
  const summarizedResults = results.map((result) => ({
    title: result.title, url: result.url, snippet: result.snippet
  }));
  const payload = buildTextPrompt(
    instructions,
    JSON.stringify({ context, best_url: bestUrl ?? null, results: summarizedResults })
  );
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    logWarn("agent.search.extract.failed", { reason: "parse_failed" });
    return {};
  }
  const enrichment = parseLlmEnrichment(parsed);
  logInfo("agent.search.extract.complete", { fields: summarizeEnrichmentFields(enrichment) });
  return enrichment;
};

const applyVendorHints = (
  enrichment: AgentEnrichment,
  hints: { heatVendor?: number; tastingNotesVendor?: string },
  pageUrl: string
) => {
  if ((enrichment.heatVendor === undefined || enrichment.heatVendor === null) && hints.heatVendor !== undefined) {
    enrichment.heatVendor = hints.heatVendor;
  }
  if (!enrichment.tastingNotesVendor && hints.tastingNotesVendor) {
    enrichment.tastingNotesVendor = hints.tastingNotesVendor;
  }
  if (!enrichment.productUrl && (enrichment.name || enrichment.maker)) {
    enrichment.productUrl = pageUrl;
  }
};

export const extractFromPageContent = async (context: SearchContext, page: PageSignals): Promise<AgentEnrichment | null> => {
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
    JSON.stringify({ context, url: page.result.url, title: page.result.title, content: relevantContent, hints })
  );
  const text = await invokeClaude(payload);
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    logWarn("agent.search.extract.page.failed", { reason: "parse_failed", url: page.result.url });
    return null;
  }
  if (parsed.relevant === false) {
    logInfo("agent.search.extract.page.skipped", { reason: "irrelevant", url: page.result.url });
    return null;
  }
  const enrichment = parseLlmEnrichment(parsed);
  applyVendorHints(enrichment, hints, page.result.url);
  logInfo("agent.search.extract.page.complete", { url: page.result.url, fields: summarizeEnrichmentFields(enrichment) });
  return enrichment;
};

const adoptStringField = (
  merged: AgentEnrichment,
  secondary: AgentEnrichment,
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

export const mergeExtractions = (primary: AgentEnrichment, secondary: AgentEnrichment | undefined, context: SearchContext) => {
  if (!secondary) {
    return primary;
  }
  const nameConsensus = isLikelySameValue(primary.name, secondary.name);
  const makerConsensus = isLikelySameValue(primary.maker, secondary.maker);
  if (!nameConsensus && !makerConsensus) {
    return primary;
  }

  const merged: AgentEnrichment = { ...primary };
  adoptStringField(merged, secondary, "name", context.name);
  adoptStringField(merged, secondary, "maker", context.maker);
  adoptStringField(merged, secondary, "style", context.style);
  adoptStringField(merged, secondary, "tastingNotesVendor");

  if (merged.heatVendor == null && secondary.heatVendor != null) {
    merged.heatVendor = secondary.heatVendor;
  }
  if (!merged.productUrl && typeof secondary.productUrl === "string" && secondary.productUrl.trim().length > 0) {
    if (scoreUrlCandidate(secondary.productUrl, context) >= 0) {
      merged.productUrl = secondary.productUrl;
    }
  }
  return merged;
};

export const extractFromTopPages = async (context: SearchContext, pages: PageSignals[]): Promise<AgentEnrichment> => {
  if (!pages.length) {
    return {};
  }
  const candidates = pages.slice(0, 3);
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
