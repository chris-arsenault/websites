import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  ListUsersCommand
} from "@aws-sdk/client-cognito-identity-provider";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const cognito = new CognitoIdentityProviderClient({});
const tableName = process.env.TABLE_NAME!;
const userPoolId = process.env.COGNITO_USER_POOL_ID!;

export type UserRecord = {
  username: string;
  displayName?: string;
  apps: Record<string, string>;
};

export const listUsers = async (): Promise<UserRecord[]> => {
  const result = await ddb.send(new ScanCommand({ TableName: tableName }));
  return (result.Items ?? []) as UserRecord[];
};

export const getUser = async (username: string): Promise<UserRecord | undefined> => {
  const result = await ddb.send(
    new GetCommand({ TableName: tableName, Key: { username } })
  );
  return result.Item as UserRecord | undefined;
};

export const putUser = async (user: UserRecord): Promise<void> => {
  await ddb.send(
    new PutCommand({ TableName: tableName, Item: user })
  );
};

export const deleteUser = async (username: string): Promise<void> => {
  await ddb.send(
    new DeleteCommand({ TableName: tableName, Key: { username } })
  );
};

export const ensureCognitoUser = async (username: string): Promise<void> => {
  const existing = await cognito.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${username}"`,
      Limit: 1
    })
  );

  if (existing.Users && existing.Users.length > 0) {
    await cognito.send(
      new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: username })
    );
    return;
  }

  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      UserAttributes: [
        { Name: "email", Value: username },
        { Name: "email_verified", Value: "true" }
      ],
      DesiredDeliveryMediums: ["EMAIL"]
    })
  );
};

export const disableCognitoUser = async (username: string): Promise<void> => {
  try {
    await cognito.send(
      new AdminDisableUserCommand({ UserPoolId: userPoolId, Username: username })
    );
  } catch (error: unknown) {
    if ((error as { name?: string }).name === "UserNotFoundException") return;
    throw error;
  }
};
