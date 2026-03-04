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

const getCorsHeaders = (origin?: string) => {
  const allowOrigin = allowedOrigins.includes("*")
    ? "*"
    : allowedOrigins.includes(origin ?? "")
      ? origin ?? ""
      : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin || allowedOrigins[0] || "*",
    "Access-Control-Allow-Headers": "authorization,content-type",
    "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS"
  };
};

const json = (status: number, body: unknown, cors: Record<string, string>): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: { "Content-Type": "application/json", ...cors },
  body: JSON.stringify(body)
});

const empty = (status: number, cors: Record<string, string>): APIGatewayProxyResultV2 => ({
  statusCode: status,
  headers: cors
});

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method.toUpperCase();
  const path = event.rawPath;
  const cors = getCorsHeaders(event.headers.origin ?? event.headers.Origin);

  if (method === "OPTIONS") return empty(204, cors);

  try {
    await verifyAuth(event.headers.authorization ?? event.headers.Authorization);

    if (method === "GET" && path === "/users") {
      const users = await listUsers();
      return json(200, { data: users }, cors);
    }

    const userMatch = path.match(/^\/users\/([^/]+)$/);
    if (!userMatch) return json(404, { message: "Not found" }, cors);

    const username = decodeURIComponent(userMatch[1]);

    if (method === "PUT") {
      const body = event.body
        ? JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body)
        : {};

      const record: UserRecord = {
        username,
        displayName: body.displayName ?? username.split("@")[0],
        apps: body.apps ?? {}
      };

      await putUser(record);
      await ensureCognitoUser(username);
      return json(200, { data: record }, cors);
    }

    if (method === "DELETE") {
      await deleteUser(username);
      await disableCognitoUser(username);
      return empty(204, cors);
    }

    return json(404, { message: "Not found" }, cors);
  } catch (error) {
    const message = (error as Error).message;
    if (message.includes("Authorization") || message.includes("token") || message.includes("Access denied")) {
      return json(401, { message }, cors);
    }
    return json(400, { message }, cors);
  }
};
