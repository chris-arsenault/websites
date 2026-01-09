import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { TastingRecord } from "../types";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true }
});

const tableName = () => {
  const name = process.env.TABLE_NAME;
  if (!name) {
    throw new Error("TABLE_NAME env var is required");
  }
  return name;
};

export type ListFilters = {
  name?: string;
  style?: string;
  minScore?: number;
  maxScore?: number;
  minHeat?: number;
  maxHeat?: number;
  date?: string;
};

export const listTastings = async (filters: ListFilters): Promise<TastingRecord[]> => {
  const expressionParts: string[] = [];
  const expressionValues: Record<string, unknown> = {};
  const expressionNames: Record<string, string> = {};

  if (filters.name) {
    expressionParts.push("contains(#name, :name)");
    expressionValues[":name"] = filters.name;
    expressionNames["#name"] = "name";
  }

  if (filters.style) {
    expressionParts.push("contains(#style, :style)");
    expressionValues[":style"] = filters.style;
    expressionNames["#style"] = "style";
  }

  if (filters.minScore !== undefined) {
    expressionParts.push("score >= :minScore");
    expressionValues[":minScore"] = filters.minScore;
  }

  if (filters.maxScore !== undefined) {
    expressionParts.push("score <= :maxScore");
    expressionValues[":maxScore"] = filters.maxScore;
  }

  if (filters.minHeat !== undefined) {
    expressionParts.push("heatUser >= :minHeat");
    expressionValues[":minHeat"] = filters.minHeat;
  }

  if (filters.maxHeat !== undefined) {
    expressionParts.push("heatUser <= :maxHeat");
    expressionValues[":maxHeat"] = filters.maxHeat;
  }

  if (filters.date) {
    expressionParts.push("#date = :date");
    expressionValues[":date"] = filters.date;
    expressionNames["#date"] = "date";
  }

  const command = new ScanCommand({
    TableName: tableName(),
    FilterExpression: expressionParts.length > 0 ? expressionParts.join(" AND ") : undefined,
    ExpressionAttributeValues: Object.keys(expressionValues).length ? expressionValues : undefined,
    ExpressionAttributeNames: Object.keys(expressionNames).length ? expressionNames : undefined
  });

  const response = await docClient.send(command);
  return (response.Items as TastingRecord[]) ?? [];
};

export const createTasting = async (item: TastingRecord): Promise<void> => {
  const command = new PutCommand({
    TableName: tableName(),
    Item: item
  });

  await docClient.send(command);
};

export const putTasting = async (item: TastingRecord): Promise<void> => {
  const command = new PutCommand({
    TableName: tableName(),
    Item: item
  });

  await docClient.send(command);
};

export const getTasting = async (id: string): Promise<TastingRecord | null> => {
  const command = new GetCommand({
    TableName: tableName(),
    Key: { id }
  });

  const response = await docClient.send(command);
  return (response.Item as TastingRecord) ?? null;
};
