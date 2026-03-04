import type { PreAuthenticationTriggerEvent, PreAuthenticationTriggerHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME!;

// CLIENT_MAP env var: JSON string mapping clientId -> app key
// e.g. {"abc123": "scorchbook", "def456": "svap"}
const clientMap: Record<string, string> = JSON.parse(process.env.CLIENT_MAP ?? "{}");

export const handler: PreAuthenticationTriggerHandler = async (
  event: PreAuthenticationTriggerEvent
) => {
  const clientId = event.callerContext.clientId;
  const username = event.userName;

  const appKey = clientMap[clientId];
  if (!appKey) {
    throw new Error("Unknown application");
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: { username }
    })
  );

  const record = result.Item;
  if (!record) {
    throw new Error("Access denied");
  }

  const apps = record.apps as Record<string, string> | undefined;
  if (!apps || !apps[appKey]) {
    throw new Error("Access denied");
  }

  return event;
};
