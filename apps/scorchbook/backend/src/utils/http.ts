import type { APIGatewayProxyResultV2 } from "aws-lambda";

const defaultHeaders = {
  "Content-Type": "application/json",
  "X-Content-Type-Options": "nosniff"
};

// eslint-disable-next-line sonarjs/function-return-type -- always returns APIGatewayProxyResultV2
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

// eslint-disable-next-line sonarjs/function-return-type -- always returns APIGatewayProxyResultV2
export const emptyResponse = (statusCode: number, headers?: Record<string, string>): APIGatewayProxyResultV2 => {
  return {
    statusCode,
    headers: {
      ...defaultHeaders,
      ...headers
    }
  };
};
