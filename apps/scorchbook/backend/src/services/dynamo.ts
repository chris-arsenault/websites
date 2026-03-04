import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
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

type FilterExpression = {
  parts: string[];
  values: Record<string, unknown>;
  names: Record<string, string>;
};

const filterRules: Array<{
  key: keyof ListFilters;
  expr: string;
  valueKey: string;
  nameKey?: string;
  nameValue?: string;
  contains?: boolean;
}> = [
  { key: "name", expr: "contains(#name, :name)", valueKey: ":name", nameKey: "#name", nameValue: "name" },
  { key: "style", expr: "contains(#style, :style)", valueKey: ":style", nameKey: "#style", nameValue: "style" },
  { key: "minScore", expr: "score >= :minScore", valueKey: ":minScore" },
  { key: "maxScore", expr: "score <= :maxScore", valueKey: ":maxScore" },
  { key: "minHeat", expr: "heatUser >= :minHeat", valueKey: ":minHeat" },
  { key: "maxHeat", expr: "heatUser <= :maxHeat", valueKey: ":maxHeat" },
  { key: "date", expr: "#date = :date", valueKey: ":date", nameKey: "#date", nameValue: "date" }
];

const buildFilterExpression = (filters: ListFilters): FilterExpression => {
  const result: FilterExpression = { parts: [], values: {}, names: {} };
  for (const rule of filterRules) {
    const value = filters[rule.key];
    if (value === undefined || value === "") continue;
    result.parts.push(rule.expr);
    result.values[rule.valueKey] = value;
    if (rule.nameKey && rule.nameValue) {
      result.names[rule.nameKey] = rule.nameValue;
    }
  }
  return result;
};

const orUndefined = <T,>(obj: Record<string, T>) => Object.keys(obj).length ? obj : undefined;

export const listTastings = async (filters: ListFilters): Promise<TastingRecord[]> => {
  const expr = buildFilterExpression(filters);
  const command = new ScanCommand({
    TableName: tableName(),
    FilterExpression: expr.parts.length > 0 ? expr.parts.join(" AND ") : undefined,
    ExpressionAttributeValues: orUndefined(expr.values),
    ExpressionAttributeNames: orUndefined(expr.names)
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

export const deleteTasting = async (id: string): Promise<void> => {
  const command = new DeleteCommand({
    TableName: tableName(),
    Key: { id }
  });
  await docClient.send(command);
};
