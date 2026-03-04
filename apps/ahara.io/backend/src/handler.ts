import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { verifyAuth } from "./services/auth";
import {
  listUsers,
  putUser,
  deleteUser,
  ensureCognitoUser,
  disableCognitoUser,
  type UserRecord
} from "./services/users";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "*").split(",").map((s) => s.trim());

const resolveOrigin = (origin?: string): string => {
  if (allowedOrigins.includes("*")) return "*";
  if (allowedOrigins.includes(origin ?? "")) return origin ?? "";
  return "";
};

const getCorsHeaders = (origin?: string) => {
  const allowOrigin = resolveOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowOrigin || allowedOrigins[0] || "*",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS",
  };
};

const json = (status: number, body: unknown, cors: Record<string, string>): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", ...cors },
  body: JSON.stringify(body)
});

const empty = (status: number, cors: Record<string, string>): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: cors,
});

const parseBody = (body?: string, isBase64Encoded?: boolean): Record<string, unknown> => {
  if (!body) return {};
  const raw = isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body;
  return JSON.parse(raw) as Record<string, unknown>;
};

const isAuthError = (message: string): boolean =>
  message.includes("Authorization") || message.includes("token") || message.includes("Access denied");

const handleGet = async (path: string, cors: Record<string, string>) => {
  if (path === "/users") {
    const users = await listUsers();
    return json(200, { data: users }, cors);
  }
  return null;
};

const handlePut = async (username: string, event: APIGatewayProxyEventV2, cors: Record<string, string>) => {
  const body = parseBody(event.body, event.isBase64Encoded);
  const password = body.password as string | undefined;
  const email = body.email as string | undefined;
  const record: UserRecord = {
    username,
    email,
    displayName: (body.displayName as string) ?? username,
    apps: (body.apps as Record<string, string>) ?? {},
  };
  await putUser(record);
  await ensureCognitoUser(username, password, email);
  return json(200, { data: record }, cors);
};

const handleDelete = async (username: string, cors: Record<string, string>) => {
  await deleteUser(username);
  await disableCognitoUser(username);
  return empty(204, cors);
};

const getAuthHeader = (headers: APIGatewayProxyEventV2["headers"]) =>
  headers.authorization ?? headers.Authorization;

const routeUserRequest = async (method: string, path: string, event: APIGatewayProxyEventV2, cors: Record<string, string>) => {
  const userMatch = /^\/users\/([^/]+)$/.exec(path);
  if (!userMatch) return json(404, { message: "Not found" }, cors);
  const username = decodeURIComponent(userMatch[1]);
  if (method === "PUT") return handlePut(username, event, cors);
  if (method === "DELETE") return handleDelete(username, cors);
  return json(404, { message: "Not found" }, cors);
};

const routeRequest = async (method: string, path: string, event: APIGatewayProxyEventV2, cors: Record<string, string>) => {
  await verifyAuth(getAuthHeader(event.headers));
  if (method === "GET") {
    const result = await handleGet(path, cors);
    if (result) return result;
  }
  return routeUserRequest(method, path, event, cors);
};

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method.toUpperCase();
  const cors = getCorsHeaders(event.headers.origin ?? event.headers.Origin);
  if (method === "OPTIONS") return empty(204, cors);
  try {
    return await routeRequest(method, event.rawPath, event, cors);
  } catch (error) {
    const message = (error as Error).message;
    return json(isAuthError(message) ? 401 : 400, { message }, cors);
  }
};
