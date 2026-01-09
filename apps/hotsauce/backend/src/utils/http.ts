import type { APIGatewayProxyResultV2 } from "aws-lambda";

const defaultHeaders = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff"
};

export const jsonResponse = (statusCode: number, body: unknown, headers?: Record<string, string>): APIGatewayProxyResultV2 => {
  return {
    statusCode,
    headers: {
      ...defaultHeaders,
      ...headers
    },
    body: JSON.stringify(body)
  };
};

export const emptyResponse = (statusCode: number, headers?: Record<string, string>): APIGatewayProxyResultV2 => {
  return {
    statusCode,
    headers: {
      ...defaultHeaders,
      ...headers
    }
  };
};
