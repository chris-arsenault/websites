export type TastingRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status?: string;
  processingError?: string;
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
  voiceKey?: string;
  voiceTranscript?: string;
  createdBy?: string;
  needsAttention?: boolean;
  attentionReason?: string;
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
  voiceBase64?: string;
  voiceMimeType?: string;
};

export type Filters = {
  search: string;
  style: string;
  minScore: string;
  minHeat: string;
  date: string;
  sortBy: "date" | "name" | "score" | "style" | "heat";
};
