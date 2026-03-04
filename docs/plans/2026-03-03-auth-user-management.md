# Auth & User Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Centralized per-app user access control via Cognito Pre-Auth trigger + DynamoDB, with an admin UI on ahara.io for user management.

**Architecture:** A DynamoDB table stores per-user app access maps. A Pre-Authentication Lambda trigger reads this table and blocks logins for unauthorized app/user combinations. ahara.io gets a backend API and authenticated admin section for managing users and their app access.

**Tech Stack:** Terraform, AWS Lambda (Node.js 24), DynamoDB, Cognito, React 19, Vite, TypeScript, esbuild, amazon-cognito-identity-js, aws-jwt-verify, @aws-sdk/client-cognito-identity-provider, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb

---

### Task 1: Create DynamoDB table for user access

**Files:**
- Modify: `infrastructure/terraform/locals.tf` — add table name local
- Modify: `infrastructure/terraform/identity.tf` — add table module call

**Step 1: Add local for table name**

In `infrastructure/terraform/locals.tf`, add to the existing locals block:

```hcl
  user_access_table_name = "websites-user-access"
```

**Step 2: Add DynamoDB table to identity.tf**

In `infrastructure/terraform/identity.tf`, add after the cognito module:

```hcl
module "user_access_table" {
  source = "./modules/dynamo-table"

  name     = local.user_access_table_name
  hash_key = "username"
}
```

**Step 3: Commit**

```bash
git add infrastructure/terraform/locals.tf infrastructure/terraform/identity.tf
git commit -m "feat: add user access DynamoDB table"
```

---

### Task 2: Create Pre-Auth Lambda trigger

This Lambda is invoked directly by Cognito (not behind API Gateway), so it needs its own IAM role and Lambda resource outside the `api-http` module.

**Files:**
- Create: `apps/auth-trigger/handler.ts` — Pre-Auth Lambda source
- Create: `apps/auth-trigger/package.json` — dependencies
- Create: `apps/auth-trigger/tsconfig.json` — TypeScript config
- Create: `infrastructure/terraform/auth-trigger.tf` — Lambda + IAM resources

**Step 1: Create the Lambda handler**

Create `apps/auth-trigger/package.json`:

```json
{
  "name": "auth-trigger",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "main": "dist/handler.js",
  "scripts": {
    "build": "esbuild src/handler.ts --bundle --platform=node --target=node24 --outdir=dist --sourcemap"
  },
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.577.0",
    "@aws-sdk/lib-dynamodb": "^3.577.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.130",
    "@types/node": "^20.12.12",
    "esbuild": "^0.21.5",
    "typescript": "^5.5.4"
  },
  "engines": {
    "node": "24.12.0"
  }
}
```

Create `apps/auth-trigger/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

Create `apps/auth-trigger/src/handler.ts`:

```typescript
import type { PreAuthenticationTriggerEvent, PreAuthenticationTriggerHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME!;

// CLIENT_MAP env var: JSON string mapping clientId -> app key
// e.g. {"abc123": "scorchbook", "def456": "svap", "ghi789": "ahara"}
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
```

**Step 2: Create Terraform resources for the trigger**

Create `infrastructure/terraform/auth-trigger.tf`:

```hcl
data "archive_file" "auth_trigger" {
  type        = "zip"
  source_file = "${path.module}/../../apps/auth-trigger/dist/handler.js"
  output_path = "${path.module}/auth-trigger-lambda.zip"
}

data "aws_iam_policy_document" "auth_trigger_assume" {
  statement {
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
    actions = ["sts:AssumeRole"]
  }
}

data "aws_iam_policy_document" "auth_trigger" {
  statement {
    actions   = ["dynamodb:GetItem"]
    resources = [module.user_access_table.arn]
  }
}

resource "aws_iam_role" "auth_trigger" {
  name               = "websites-auth-trigger"
  assume_role_policy = data.aws_iam_policy_document.auth_trigger_assume.json

  tags = {
    Project   = "Websites"
    ManagedBy = "Terraform"
  }
}

resource "aws_iam_role_policy_attachment" "auth_trigger_basic" {
  role       = aws_iam_role.auth_trigger.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "auth_trigger" {
  name   = "websites-auth-trigger-inline"
  role   = aws_iam_role.auth_trigger.id
  policy = data.aws_iam_policy_document.auth_trigger.json
}

resource "aws_lambda_function" "auth_trigger" {
  function_name = "websites-auth-trigger"
  role          = aws_iam_role.auth_trigger.arn
  handler       = "handler.handler"
  runtime       = "nodejs24.x"

  filename         = data.archive_file.auth_trigger.output_path
  source_code_hash = data.archive_file.auth_trigger.output_base64sha256

  timeout     = 5
  memory_size = 128

  environment {
    variables = {
      TABLE_NAME = module.user_access_table.name
      CLIENT_MAP = jsonencode({
        for key, id in module.cognito.client_ids : id => key
      })
    }
  }

  tags = {
    Project   = "Websites"
    ManagedBy = "Terraform"
  }
}

resource "aws_lambda_permission" "auth_trigger_cognito" {
  statement_id  = "AllowCognitoInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.auth_trigger.function_name
  principal     = "cognito-idp.amazonaws.com"
  source_arn    = module.cognito.user_pool_arn
}
```

**Step 3: Commit**

```bash
git add apps/auth-trigger/ infrastructure/terraform/auth-trigger.tf
git commit -m "feat: add pre-auth Lambda trigger for per-app access control"
```

---

### Task 3: Update Cognito module to support Pre-Auth trigger + add ahara client

**Files:**
- Modify: `infrastructure/terraform/modules/cognito/variables.tf` — add pre_auth_lambda_arn variable
- Modify: `infrastructure/terraform/modules/cognito/main.tf` — add lambda_config block
- Modify: `infrastructure/terraform/locals.tf` — add ahara client to cognito_clients
- Modify: `infrastructure/terraform/identity.tf` — pass pre_auth_lambda_arn

**Step 1: Add variable to Cognito module**

In `infrastructure/terraform/modules/cognito/variables.tf`, add:

```hcl
variable "pre_auth_lambda_arn" {
  description = "ARN of the Pre-Authentication Lambda trigger (optional)"
  type        = string
  default     = ""
}
```

**Step 2: Add lambda_config to the user pool**

In `infrastructure/terraform/modules/cognito/main.tf`, add a `lambda_config` block inside `aws_cognito_user_pool.pool`:

```hcl
  dynamic "lambda_config" {
    for_each = var.pre_auth_lambda_arn != "" ? [1] : []
    content {
      pre_authentication = var.pre_auth_lambda_arn
    }
  }
```

Place this inside the `aws_cognito_user_pool "pool"` resource, after the `password_policy` block.

**Step 3: Add ahara client and pass trigger ARN**

In `infrastructure/terraform/locals.tf`, update `cognito_clients`:

```hcl
  cognito_clients = {
    scorchbook = "${local.scorchbook_name_prefix}-app"
    svap       = "svap-app"
    canonry    = "${local.scorchbook_name_prefix}-canonry-app"
    ahara      = "ahara-app"
  }
```

In `infrastructure/terraform/identity.tf`, update the cognito module call:

```hcl
module "cognito" {
  source = "./modules/cognito"

  user_pool_name      = local.cognito_user_pool_name
  domain_name         = "auth.ahara.io"
  domain_zone_name    = "ahara.io"
  clients             = local.cognito_clients
  pre_auth_lambda_arn = aws_lambda_function.auth_trigger.arn
}
```

**Step 4: Commit**

```bash
git add infrastructure/terraform/modules/cognito/ infrastructure/terraform/locals.tf infrastructure/terraform/identity.tf
git commit -m "feat: add pre-auth trigger to Cognito and ahara client"
```

---

### Task 4: Create ahara.io API backend

Follow the exact pattern from scorchbook backend. This API manages users in DynamoDB and Cognito.

**Files:**
- Create: `apps/ahara.io/backend/package.json`
- Create: `apps/ahara.io/backend/tsconfig.json`
- Create: `apps/ahara.io/backend/src/handler.ts`
- Create: `apps/ahara.io/backend/src/services/auth.ts` (copy pattern from scorchbook)
- Create: `apps/ahara.io/backend/src/services/users.ts`

**Step 1: Create package.json**

Create `apps/ahara.io/backend/package.json`:

```json
{
  "name": "ahara-api",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "main": "dist/handler.js",
  "scripts": {
    "build": "esbuild src/handler.ts --bundle --platform=node --target=node24 --outdir=dist --sourcemap"
  },
  "dependencies": {
    "@aws-sdk/client-cognito-identity-provider": "^3.577.0",
    "@aws-sdk/client-dynamodb": "^3.577.0",
    "@aws-sdk/lib-dynamodb": "^3.577.0",
    "aws-jwt-verify": "^4.0.0"
  },
  "devDependencies": {
    "@types/aws-lambda": "^8.10.130",
    "@types/node": "^20.12.12",
    "esbuild": "^0.21.5",
    "typescript": "^5.5.4"
  },
  "engines": {
    "node": "24.12.0"
  }
}
```

**Step 2: Create tsconfig.json**

Create `apps/ahara.io/backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

**Step 3: Create auth service**

Create `apps/ahara.io/backend/src/services/auth.ts` — same pattern as scorchbook:

```typescript
import { CognitoJwtVerifier } from "aws-jwt-verify";

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

const getVerifier = () => {
  if (verifier) return verifier;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) throw new Error("Missing Cognito configuration");
  verifier = CognitoJwtVerifier.create({ userPoolId, clientId, tokenUse: "id" });
  return verifier;
};

export const verifyAuth = async (authorization?: string) => {
  if (!authorization) throw new Error("Missing Authorization header");
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Missing Bearer token");
  const payload = await getVerifier().verify(token);
  return { sub: payload.sub, email: payload.email };
};
```

**Step 4: Create users service**

Create `apps/ahara.io/backend/src/services/users.ts`:

```typescript
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
  // Check if user exists in Cognito
  const existing = await cognito.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${username}"`,
      Limit: 1
    })
  );

  if (existing.Users && existing.Users.length > 0) {
    // Re-enable if disabled
    await cognito.send(
      new AdminEnableUserCommand({ UserPoolId: userPoolId, Username: username })
    );
    return;
  }

  // Create new user — Cognito sends invite email with temp password
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: username,
      UserAttributes: [{ Name: "email", Value: username }, { Name: "email_verified", Value: "true" }],
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
```

**Step 5: Create handler**

Create `apps/ahara.io/backend/src/handler.ts`:

```typescript
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { verifyAuth } from "./services/auth";
import { listUsers, getUser, putUser, deleteUser, ensureCognitoUser, disableCognitoUser, type UserRecord } from "./services/users";

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
```

**Step 6: Commit**

```bash
git add apps/ahara.io/backend/
git commit -m "feat: add ahara.io admin API for user management"
```

---

### Task 5: Terraform for ahara.io API + switch to SPA module

**Files:**
- Modify: `infrastructure/terraform/locals.tf` — add ahara API locals
- Modify: `infrastructure/terraform/site-ahara.tf` — replace static-website with spa-website, add API module
- Modify: `infrastructure/terraform/outputs.tf` — update ahara entry

**Step 1: Add locals**

In `infrastructure/terraform/locals.tf`, add:

```hcl
  ahara_api_domain    = "api.${local.ahara_domain_name}"
  ahara_frontend_bucket = "ahara-io-frontend"
  ahara_allowed_origins = [
    "http://localhost:5173",
    "https://${local.ahara_hostname}"
  ]
```

**Step 2: Replace site-ahara.tf**

Replace the full contents of `infrastructure/terraform/site-ahara.tf`:

```hcl
data "aws_iam_policy_document" "ahara_lambda" {
  statement {
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:DeleteItem",
      "dynamodb:Scan"
    ]
    resources = [module.user_access_table.arn]
  }

  statement {
    actions = [
      "cognito-idp:AdminCreateUser",
      "cognito-idp:AdminDisableUser",
      "cognito-idp:AdminEnableUser",
      "cognito-idp:ListUsers"
    ]
    resources = [module.cognito.user_pool_arn]
  }
}

module "ahara_api" {
  source = "./modules/api-http"

  name              = "ahara-io"
  lambda_entry_path = "${path.module}/../../apps/ahara.io/backend/dist/handler.js"
  lambda_runtime    = "nodejs24.x"
  lambda_handler    = "handler.handler"
  lambda_environment = {
    TABLE_NAME           = module.user_access_table.name
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_ID    = module.cognito.client_ids["ahara"]
    ALLOWED_ORIGINS      = join(",", local.ahara_allowed_origins)
  }
  iam_policy_json    = data.aws_iam_policy_document.ahara_lambda.json
  routes             = ["GET /users", "PUT /users/{username}", "DELETE /users/{username}"]
  cors_allow_origins = local.ahara_allowed_origins
  custom_domain_name = local.ahara_api_domain
  domain_zone_name   = local.ahara_domain_name
}

module "ahara_site" {
  source = "./modules/spa-website"

  hostname            = local.ahara_hostname
  domain_name         = local.ahara_domain_name
  site_directory_path = "${path.module}/../../apps/ahara.io/dist"
  bucket_name         = local.ahara_frontend_bucket
  runtime_config = {
    apiBaseUrl        = "https://${local.ahara_api_domain}"
    cognitoUserPoolId = module.cognito.user_pool_id
    cognitoClientId   = module.cognito.client_ids["ahara"]
  }
}
```

**Step 3: Update outputs.tf**

In `infrastructure/terraform/outputs.tf`, update the ahara entry in `all_sites` to match the spa-website output pattern (same fields as scorchbook):

The ahara entry already references `module.ahara_site.*` so if the spa-website module exposes the same outputs as static-website, no change needed. Verify spa-website outputs match. If they differ, update accordingly.

**Step 4: Commit**

```bash
git add infrastructure/terraform/site-ahara.tf infrastructure/terraform/locals.tf infrastructure/terraform/outputs.tf
git commit -m "feat: add ahara.io API and switch to spa-website module"
```

---

### Task 6: ahara.io frontend — add auth + admin UI

**Files:**
- Modify: `apps/ahara.io/package.json` — add dependencies
- Create: `apps/ahara.io/src/config.ts` — runtime config (same pattern as scorchbook)
- Create: `apps/ahara.io/src/auth.ts` — auth functions (same pattern as scorchbook)
- Create: `apps/ahara.io/src/api.ts` — API client for user management
- Create: `apps/ahara.io/src/admin/UserList.tsx` — user list component
- Create: `apps/ahara.io/src/admin/UserEditor.tsx` — user edit/create component
- Create: `apps/ahara.io/src/admin/AdminPage.tsx` — admin page wrapper
- Create: `apps/ahara.io/src/admin/Login.tsx` — login form
- Modify: `apps/ahara.io/src/App.tsx` — add Admin tab (only when authenticated)
- Modify: `apps/ahara.io/src/App.css` — add admin styles

**Step 1: Add dependencies**

Add to `apps/ahara.io/package.json` dependencies:

```json
"amazon-cognito-identity-js": "^6.4.0"
```

Run `npm install` in `apps/ahara.io/`.

**Step 2: Create config.ts**

Create `apps/ahara.io/src/config.ts`:

```typescript
type RuntimeConfig = {
  apiBaseUrl?: string;
  cognitoUserPoolId?: string;
  cognitoClientId?: string;
};

declare global {
  interface Window {
    __APP_CONFIG__?: RuntimeConfig;
  }
}

const runtimeConfig = typeof window !== "undefined" ? window.__APP_CONFIG__ : undefined;
const readRuntime = (value?: string) => (value && value.trim().length > 0 ? value : undefined);

export const config = {
  apiBaseUrl: readRuntime(runtimeConfig?.apiBaseUrl) ?? import.meta.env.VITE_API_BASE_URL ?? "",
  cognitoUserPoolId: readRuntime(runtimeConfig?.cognitoUserPoolId) ?? import.meta.env.VITE_COGNITO_USER_POOL_ID ?? "",
  cognitoClientId: readRuntime(runtimeConfig?.cognitoClientId) ?? import.meta.env.VITE_COGNITO_CLIENT_ID ?? ""
};
```

**Step 3: Create auth.ts**

Create `apps/ahara.io/src/auth.ts` — same pattern as scorchbook's `auth.ts`:

```typescript
import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession
} from "amazon-cognito-identity-js";
import { config } from "./config";

const getUserPool = () => {
  if (!config.cognitoUserPoolId || !config.cognitoClientId) {
    throw new Error("Missing Cognito configuration");
  }
  return new CognitoUserPool({
    UserPoolId: config.cognitoUserPoolId,
    ClientId: config.cognitoClientId
  });
};

const getCurrentUser = () => {
  try { return getUserPool().getCurrentUser(); } catch { return null; }
};

export const signIn = (username: string, password: string): Promise<CognitoUserSession> => {
  const user = new CognitoUser({ Username: username, Pool: getUserPool() });
  const details = new AuthenticationDetails({ Username: username, Password: password });
  return new Promise((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: (session) => resolve(session),
      onFailure: (error) => reject(error),
      newPasswordRequired: (userAttributes) => {
        // Handle first login forced password change
        // Remove non-writable attributes
        delete userAttributes.email_verified;
        delete userAttributes.email;
        // For now, reject — the user needs to set a new password via hosted UI or the admin sets it
        reject(new Error("NEW_PASSWORD_REQUIRED"));
      }
    });
  });
};

export const signOut = () => { getCurrentUser()?.signOut(); };

export const getSession = (): Promise<CognitoUserSession | null> => {
  const user = getCurrentUser();
  if (!user) return Promise.resolve(null);
  return new Promise((resolve) => {
    user.getSession((error: Error | null, session: CognitoUserSession | null) => {
      resolve(error || !session ? null : session);
    });
  });
};

export const getIdToken = async (): Promise<string | null> => {
  const session = await getSession();
  return session?.getIdToken().getJwtToken() ?? null;
};
```

**Step 4: Create api.ts**

Create `apps/ahara.io/src/api.ts`:

```typescript
import { config } from "./config";
import { getIdToken } from "./auth";

export type UserRecord = {
  username: string;
  displayName?: string;
  apps: Record<string, string>;
};

const authHeaders = async () => {
  const token = await getIdToken();
  if (!token) throw new Error("Not authenticated");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
};

export const fetchUsers = async (): Promise<UserRecord[]> => {
  const res = await fetch(`${config.apiBaseUrl}/users`, { headers: await authHeaders() });
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  return body.data;
};

export const saveUser = async (user: UserRecord): Promise<UserRecord> => {
  const res = await fetch(`${config.apiBaseUrl}/users/${encodeURIComponent(user.username)}`, {
    method: "PUT",
    headers: await authHeaders(),
    body: JSON.stringify({ displayName: user.displayName, apps: user.apps })
  });
  if (!res.ok) throw new Error(await res.text());
  const body = await res.json();
  return body.data;
};

export const removeUser = async (username: string): Promise<void> => {
  const res = await fetch(`${config.apiBaseUrl}/users/${encodeURIComponent(username)}`, {
    method: "DELETE",
    headers: await authHeaders()
  });
  if (!res.ok) throw new Error(await res.text());
};
```

**Step 5: Create admin components**

The known app keys are: `scorchbook`, `svap`, `canonry`, `ahara`. These should be presented as toggleable options in the UI.

Create `apps/ahara.io/src/admin/Login.tsx`:

```tsx
import { useState } from "react";
import { signIn } from "../auth";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signIn(email, password);
      onLogin();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>Admin Login</h2>
      {error && <p className="error">{error}</p>}
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign In"}</button>
    </form>
  );
}
```

Create `apps/ahara.io/src/admin/UserEditor.tsx`:

```tsx
import { useState } from "react";
import type { UserRecord } from "../api";

const APP_KEYS = ["scorchbook", "svap", "canonry", "ahara"];
const DEFAULT_ROLE = "admin";

type Props = {
  user?: UserRecord;
  onSave: (user: UserRecord) => void;
  onCancel: () => void;
};

export function UserEditor({ user, onSave, onCancel }: Props) {
  const [username, setUsername] = useState(user?.username ?? "");
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [apps, setApps] = useState<Record<string, string>>(user?.apps ?? {});

  const toggleApp = (key: string) => {
    setApps((prev) => {
      const next = { ...prev };
      if (next[key]) { delete next[key]; } else { next[key] = DEFAULT_ROLE; }
      return next;
    });
  };

  const setRole = (key: string, role: string) => {
    setApps((prev) => ({ ...prev, [key]: role }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ username, displayName, apps });
  };

  return (
    <form className="user-editor" onSubmit={handleSubmit}>
      <h3>{user ? "Edit User" : "Add User"}</h3>
      <label>
        Email
        <input type="email" value={username} onChange={(e) => setUsername(e.target.value)} disabled={!!user} required />
      </label>
      <label>
        Display Name
        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </label>
      <fieldset>
        <legend>App Access</legend>
        {APP_KEYS.map((key) => (
          <div key={key} className="app-toggle">
            <label>
              <input type="checkbox" checked={!!apps[key]} onChange={() => toggleApp(key)} />
              {key}
            </label>
            {apps[key] && (
              <select value={apps[key]} onChange={(e) => setRole(key, e.target.value)}>
                <option value="admin">admin</option>
                <option value="readonly">readonly</option>
              </select>
            )}
          </div>
        ))}
      </fieldset>
      <div className="editor-actions">
        <button type="submit">Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

Create `apps/ahara.io/src/admin/UserList.tsx`:

```tsx
import type { UserRecord } from "../api";

type Props = {
  users: UserRecord[];
  onEdit: (user: UserRecord) => void;
  onDelete: (username: string) => void;
  onAdd: () => void;
};

export function UserList({ users, onEdit, onDelete, onAdd }: Props) {
  return (
    <div className="user-list">
      <div className="user-list-header">
        <h2>Users</h2>
        <button className="btn btn-primary" onClick={onAdd}>Add User</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Apps</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.username}>
              <td>{u.username}</td>
              <td>{u.displayName ?? "—"}</td>
              <td>{Object.entries(u.apps ?? {}).map(([k, v]) => `${k}:${v}`).join(", ") || "none"}</td>
              <td>
                <button onClick={() => onEdit(u)}>Edit</button>
                <button onClick={() => onDelete(u.username)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Create `apps/ahara.io/src/admin/AdminPage.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import { fetchUsers, saveUser, removeUser, type UserRecord } from "../api";
import { UserList } from "./UserList";
import { UserEditor } from "./UserEditor";

export function AdminPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [editing, setEditing] = useState<UserRecord | "new" | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setUsers(await fetchUsers());
      setError("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (user: UserRecord) => {
    try {
      await saveUser(user);
      setEditing(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Delete user ${username}?`)) return;
    try {
      await removeUser(username);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="admin-page">
      {error && <p className="error">{error}</p>}
      {editing ? (
        <UserEditor
          user={editing === "new" ? undefined : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <UserList
          users={users}
          onEdit={(u) => setEditing(u)}
          onDelete={handleDelete}
          onAdd={() => setEditing("new")}
        />
      )}
    </div>
  );
}
```

**Step 6: Update App.tsx**

Modify `apps/ahara.io/src/App.tsx`:

- Import `getSession`, `signOut` from `./auth`
- Import `AdminPage` from `./admin/AdminPage`
- Import `Login` from `./admin/Login`
- Add `'admin'` to the Tab type
- Add state: `const [session, setSession] = useState<unknown>(null)`
- On mount, check `getSession()` and set session
- Add "Admin" tab in nav (always visible — Pre-Auth controls who can log in)
- When admin tab is active: if session, show AdminPage; if not, show Login
- Add sign out button when authenticated

**Step 7: Add admin styles to App.css**

Add basic styles for `.login-form`, `.admin-page`, `.user-list`, `.user-editor`, `.app-toggle`, `.error`, table styling. Keep it minimal and consistent with existing card-based design.

**Step 8: Commit**

```bash
git add apps/ahara.io/
git commit -m "feat: add admin UI for user management on ahara.io"
```

---

### Task 7: Seed initial user access record

After deploy, the Pre-Auth trigger will block all logins until there's at least one record in the DynamoDB table. We need to seed your access record.

**Files:**
- Modify: `infrastructure/terraform/identity.tf` — add DynamoDB item for initial user

**Step 1: Add seed record**

In `infrastructure/terraform/identity.tf`, add:

```hcl
resource "aws_dynamodb_table_item" "seed_user" {
  table_name = module.user_access_table.name
  hash_key   = "username"

  item = jsonencode({
    username    = { S = "chris@chris-arsenault.net" }
    displayName = { S = "Chris" }
    apps        = { M = {
      scorchbook = { S = "admin" }
      svap       = { S = "admin" }
      canonry    = { S = "admin" }
      ahara      = { S = "admin" }
    }}
  })

  lifecycle {
    ignore_changes = [item]
  }
}
```

The `ignore_changes` ensures Terraform won't overwrite manual edits made through the admin UI later.

**Step 2: Commit**

```bash
git add infrastructure/terraform/identity.tf
git commit -m "feat: seed initial admin user access record"
```

---

### Task 8: Verify and deploy

**Step 1: Build all new apps**

```bash
cd apps/auth-trigger && npm install && npm run build && cd ../..
cd apps/ahara.io/backend && npm install && npm run build && cd ../../..
cd apps/ahara.io && npm install && npm run build && cd ../..
```

**Step 2: Terraform plan**

```bash
cd infrastructure/terraform
terraform init -backend-config="bucket=tf-state-websites-559098897826" -backend-config="region=us-east-1" -backend-config="use_lockfile=true"
terraform plan
```

Review the plan to confirm:
- 1 new DynamoDB table
- 1 new Lambda (auth trigger) + IAM role
- 1 new API Gateway + Lambda (ahara API) + IAM role + domain + cert
- Cognito user pool updated with lambda_config
- Cognito pool gets new "ahara" client
- ahara.io switches from static-website to spa-website (S3 bucket + CloudFront changes)
- 1 seed DynamoDB item

**Step 3: Deploy**

Run `scripts/deploy.sh` or `terraform apply`.

**Step 4: Verify**

1. Visit `https://ahara.io` — portfolio should still work
2. Click "Admin" tab — should show login form
3. Log in with chris@chris-arsenault.net — should show user management
4. Try logging into scorchbook — should still work (user has scorchbook access)
5. Create a test user with no scorchbook access, verify they can't log into scorchbook

**Step 5: Commit any adjustments**

```bash
git add -A
git commit -m "chore: deployment adjustments"
```
