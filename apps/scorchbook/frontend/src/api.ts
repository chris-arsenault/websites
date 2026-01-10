import { config } from "./config";
import type { CreateTastingInput, TastingRecord } from "./types";

export const fetchTastings = async (): Promise<TastingRecord[]> => {
  const response = await fetch(`${config.apiBaseUrl}/tastings`);
  if (!response.ok) {
    throw new Error("Failed to fetch tastings");
  }
  const payload = (await response.json()) as { data: TastingRecord[] };
  return payload.data ?? [];
};

export const createTasting = async (payload: CreateTastingInput, token: string): Promise<TastingRecord | null> => {
  const response = await fetch(`${config.apiBaseUrl}/tastings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message ?? "Failed to create tasting");
  }

  if (response.status === 204) {
    return null;
  }

  const responseBody = (await response.json()) as { data: TastingRecord };
  return responseBody.data ?? null;
};

export const rerunTasting = async (id: string, token: string): Promise<void> => {
  const response = await fetch(`${config.apiBaseUrl}/tastings/${id}/rerun`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message ?? "Failed to rerun pipeline");
  }
};

export const deleteTasting = async (id: string, token: string): Promise<void> => {
  const response = await fetch(`${config.apiBaseUrl}/tastings/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message ?? "Failed to delete tasting");
  }
};
