const AWS = require("aws-sdk");

const DDB_TABLE = process.env.TABLE_NAME;
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_PER_MINUTE || "30", 10);
const MODEL_ID = process.env.MODEL_ID;
const BEDROCK_REGION = process.env.BEDROCK_REGION;

const dynamodb = new AWS.DynamoDB.DocumentClient();
const brt = new AWS.BedrockRuntime({ region: BEDROCK_REGION });

const pad2 = (value) => String(value).padStart(2, "0");

const minuteBucket = (now) => {
  return [
    now.getUTCFullYear(),
    pad2(now.getUTCMonth() + 1),
    pad2(now.getUTCDate()),
    pad2(now.getUTCHours()),
    pad2(now.getUTCMinutes())
  ].join("");
};

const rateLimitKey = (userId, now) => `${userId}#${minuteBucket(now)}`;

const jsonResponse = (status, body, cors = true) => {
  const headers = { "Content-Type": "application/json" };
  if (cors) {
    Object.assign(headers, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "OPTIONS,POST"
    });
  }
  return {
    statusCode: status,
    headers,
    body: JSON.stringify(body)
  };
};

const getHeader = (headers, name) => {
  if (!headers) return undefined;
  const direct = headers[name];
  if (direct) return direct;
  const lower = name.toLowerCase();
  if (headers[lower]) return headers[lower];
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === lower);
  return key ? headers[key] : undefined;
};

const getUserId = (event) => {
  const headers = event.headers || {};
  const uid = getHeader(headers, "x-user-id");
  if (uid) return uid.trim();
  const claims = event?.requestContext?.authorizer?.jwt?.claims;
  if (claims?.sub) return claims.sub;
  const sourceIp = event?.requestContext?.http?.sourceIp;
  return sourceIp || "anonymous";
};

const checkAndIncrement = async (userId, now) => {
  const pk = rateLimitKey(userId, now);
  const ttl = Math.floor(Date.now() / 1000) + 120;
  try {
    const resp = await dynamodb
      .update({
        TableName: DDB_TABLE,
        Key: { pk },
        UpdateExpression: "SET #c = if_not_exists(#c, :zero) + :one, #ttl = if_not_exists(#ttl, :ttl)",
        ConditionExpression: "attribute_not_exists(#c) OR #c < :limit",
        ExpressionAttributeNames: { "#c": "count", "#ttl": "ttl" },
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":limit": RATE_LIMIT,
          ":ttl": ttl
        },
        ReturnValues: "UPDATED_NEW"
      })
      .promise();
    return [true, resp.Attributes?.count ?? 0];
  } catch (error) {
    if (error && error.code === "ConditionalCheckFailedException") {
      return [false, RATE_LIMIT];
    }
    throw error;
  }
};

const parseBody = (event) => {
  let body = event.body || "{}";
  if (event.isBase64Encoded) {
    body = Buffer.from(body, "base64").toString("utf8");
  }
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

const readBedrockBody = (value) => {
  if (!value) return "";
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (value instanceof Uint8Array) return Buffer.from(value).toString("utf8");
  if (typeof value === "string") return value;
  if (typeof value.toString === "function") return value.toString("utf8");
  return "";
};

exports.handler = async (event) => {
  const method = event?.requestContext?.http?.method || event?.httpMethod;
  if (method === "OPTIONS") {
    return jsonResponse(200, { ok: true });
  }

  const userId = getUserId(event);
  const now = new Date();

  let ok;
  let count;
  try {
    [ok, count] = await checkAndIncrement(userId, now);
  } catch (error) {
    console.log(error);
    return jsonResponse(500, { message: "Rate limit error" });
  }

  if (!ok) {
    return jsonResponse(429, { message: "Rate limit exceeded", limit_per_minute: RATE_LIMIT });
  }

  const payload = parseBody(event);
  if (!payload) {
    return jsonResponse(400, { message: "Invalid JSON body" });
  }

  const prompt = payload.prompt;
  let messages = payload.messages;

  if (messages == null) {
    if (typeof prompt !== "string" || prompt.trim().length === 0) {
      return jsonResponse(400, { message: "Provide 'prompt' (string) or 'messages' (Anthropic format)" });
    }
    messages = [{ role: "user", content: prompt }];
  }

  const bedrockBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: Number.parseInt(payload.max_tokens ?? 256, 10),
    temperature: Number(payload.temperature ?? 0),
    messages
  };

  try {
    const resp = await brt
      .invokeModel({
        modelId: MODEL_ID,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(bedrockBody)
      })
      .promise();

    const raw = readBedrockBody(resp.body);
    const data = raw ? JSON.parse(raw) : {};
    const text = data?.content?.[0]?.text ?? "";

    return jsonResponse(200, {
      user_id: userId,
      count_in_window: Number(count),
      model_id: MODEL_ID,
      raw: data,
      text
    });
  } catch (error) {
    const code = error?.code;
    const status = code === "AccessDeniedException" || code === "ForbiddenException" ? 403 : 500;
    return jsonResponse(status, { message: "Bedrock error", error: { code } });
  }
};
