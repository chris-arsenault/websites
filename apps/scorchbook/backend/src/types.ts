export type ProcessingStatus =
  | "pending"
  | "image_extracted"
  | "ingredients_extracted"
  | "nutrition_extracted"
  | "voice_transcribed"
  | "voice_extracted"
  | "notes_formatted"
  | "complete"
  | "error"
  | "back_extracted";

export type ProductType = "sauce" | "drink";

export type NutritionFacts = {
  servingSize?: string;
  calories?: number;
  totalFat?: string;
  sodium?: string;
  totalCarbs?: string;
  sugars?: string;
  protein?: string;
};

export type TastingRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status?: ProcessingStatus;
  processingError?: string;
  needsAttention?: boolean;
  attentionReason?: string;
  productType?: ProductType;
  name: string;
  maker: string;
  date: string;
  score: number | null;
  style: string;
  // Sauce-specific
  heatUser: number | null;
  heatVendor: number | null;
  // Drink-specific
  refreshing: number | null;
  sweet: number | null;
  tastingNotesUser: string;
  tastingNotesVendor: string;
  productUrl: string;
  imageUrl?: string;
  imageKey?: string;
  ingredientsImageUrl?: string;
  ingredientsImageKey?: string;
  nutritionImageUrl?: string;
  nutritionImageKey?: string;
  nutritionFacts?: NutritionFacts;
  ingredients?: string[];
  voiceKey?: string;
  voiceTranscript?: string;
  createdBy?: string;
};

export type CreateTastingInput = {
  name?: string;
  maker?: string;
  date?: string;
  score?: number | null;
  style?: string;
  heatUser?: number | null;
  heatVendor?: number | null;
  refreshing?: number | null;
  sweet?: number | null;
  tastingNotesUser?: string;
  tastingNotesVendor?: string;
  productUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  ingredientsImageBase64?: string;
  ingredientsImageMimeType?: string;
  nutritionImageBase64?: string;
  nutritionImageMimeType?: string;
  voiceBase64?: string;
  voiceMimeType?: string;
};

export type UpdateTastingMediaInput = {
  imageBase64?: string;
  imageMimeType?: string;
  ingredientsImageBase64?: string;
  ingredientsImageMimeType?: string;
  nutritionImageBase64?: string;
  nutritionImageMimeType?: string;
};

export type AgentEnrichment = {
  productType?: ProductType;
  name?: string;
  maker?: string;
  style?: string;
  heatVendor?: number | null;
  tastingNotesVendor?: string;
  score?: number | null;
  heatUser?: number | null;
  tastingNotesUser?: string;
  voiceTranscript?: string;
  productUrl?: string;
};

export type UserContext = {
  sub: string;
  email?: string;
};
