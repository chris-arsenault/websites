import { z } from "zod";

const OptionalString = z.string().trim().min(1).max(1000).optional();

export const CreateTastingSchema = z.object({
  name: OptionalString,
  maker: OptionalString,
  date: z.string().trim().min(4).max(32).optional(),
  score: z.number().min(0).max(10).nullable().optional(),
  style: OptionalString,
  heatUser: z.number().min(0).max(10).nullable().optional(),
  heatVendor: z.number().min(0).max(10).nullable().optional(),
  tastingNotesUser: z.string().trim().max(4000).optional(),
  tastingNotesVendor: z.string().trim().max(4000).optional(),
  productUrl: z.string().url().max(2000).optional(),
  imageBase64: z.string().max(10_000_000).optional(),
  imageMimeType: z.string().max(128).optional(),
  backImageBase64: z.string().max(10_000_000).optional(),
  backImageMimeType: z.string().max(128).optional(),
  voiceBase64: z.string().max(10_000_000).optional(),
  voiceMimeType: z.string().max(128).optional()
});

export const validateCreateTasting = (payload: unknown) => {
  return CreateTastingSchema.parse(payload);
};
