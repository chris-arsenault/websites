export type ProcessingStatus =
  | "pending"
  | "image_extracted"
  | "back_extracted"
  | "voice_transcribed"
  | "voice_extracted"
  | "notes_formatted"
  | "complete"
  | "error";

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
  name: string;
  maker: string;
  date: string;
  score: number | null;
  style: string;
  heatUser: number | null;
  heatVendor: number | null;
  tastingNotesUser: string;
  tastingNotesVendor: string;
  productUrl: string;
  imageUrl?: string;
  imageKey?: string;
  backImageUrl?: string;
  backImageKey?: string;
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
  tastingNotesUser?: string;
  tastingNotesVendor?: string;
  productUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  backImageBase64?: string;
  backImageMimeType?: string;
  voiceBase64?: string;
  voiceMimeType?: string;
};

export type AgentEnrichment = {
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
