import type { AgentEnrichment, NutritionFacts } from "../../types";

export type { AgentEnrichment, NutritionFacts };

export type SearchResult = {
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

export type TavilySearchResult = {
  title?: string;
  url?: string;
  content?: string;
  raw_content?: string;
  snippet?: string;
};

export type TavilySearchResponse = {
  results?: TavilySearchResult[];
};

export type PageSignals = {
  result: SearchResult;
  score: number;
  contentText: string;
  hasProductSchema: boolean;
  contentSource: "raw" | "fetched" | "summary" | "snippet";
};

export type NotesResult = {
  notes?: string;
  source: "llm" | "fallback" | "none";
};

export type ImageExtraction = AgentEnrichment & { keywords?: string[] };

export type IngredientsExtraction = {
  ingredients?: string[];
};

export type NutritionExtraction = {
  nutritionFacts?: NutritionFacts;
};
