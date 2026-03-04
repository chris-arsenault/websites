import { config } from "./config";
import { getIdToken } from "./auth";

export type UserRecord = {
  username: string;
  displayName?: string;
  apps: Record<string, string>;
  password?: string;
};

const authHeaders = async () => {
  const token = await getIdToken();
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

export const fetchUsers = async (): Promise<UserRecord[]> => {
  const res = await fetch(`${config.apiBaseUrl}/users`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  const body = (await res.json()) as { data: UserRecord[] };
  return body.data;
};

export const saveUser = async (user: UserRecord): Promise<UserRecord> => {
  const res = await fetch(`${config.apiBaseUrl}/users/${encodeURIComponent(user.username)}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify({ displayName: user.displayName, apps: user.apps, password: user.password })
  });
  if (!res.ok) throw new Error(await res.text());
  const body = (await res.json()) as { data: UserRecord };
  return body.data;
};

export const removeUser = async (username: string): Promise<void> => {
  const res = await fetch(`${config.apiBaseUrl}/users/${encodeURIComponent(username)}`, {
    method: "DELETE",
    headers: await authHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
};
