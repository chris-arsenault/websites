# Hot Sauce Tasting Tracker

Quick-and-dirty Vite + React frontend with a Node.js Lambda backend, DynamoDB storage, and Cognito auth.

## Structure

- `frontend/` Vite + React + TypeScript UI
- `backend/` Node.js Lambda (TypeScript) with DynamoDB + Bedrock workflow
- `infra/` Terraform for AWS resources

## Deploy with Terraform

```bash
cp .env.example .env
npm run deploy
```

Requirements:

- Terraform >= 1.5
- AWS credentials + region in `.env`
- Route53 hosted zone for `ahara.io` in the same AWS account

The deploy script builds the backend, builds the frontend, and applies Terraform (which uploads frontend assets).
Run `npm install` in `frontend/` and `backend/` once before the first deploy.

The frontend reads runtime settings from `/config.js`, which Terraform writes with the API + Cognito IDs.

`.env` is for secrets only and is ignored by git.

By default the stack binds to `sauce.ahara.io` (frontend) and `sauce-api.ahara.io/api` (API). Override in `infra/prod.tfvars` only if needed.

Terraform creates a seed Cognito user (default `admin@ahara.io`, derived from the hosted zone) with a random password; the deploy script prints the credentials at the end.
The seed user has a display name of "Hot Sauce Admin" and preferred username "admin".

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Required env vars:

- `VITE_API_BASE_URL`
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_CLIENT_ID`

## Backend setup

```bash
cd backend
npm install
npm run build
```

Required env vars:

- `TABLE_NAME`
- `MEDIA_BUCKET`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`

Optional:

- `PUBLIC_MEDIA_BASE_URL`
- `BEDROCK_MODEL_ID`
- `TRANSCRIBE_LANGUAGE`

## DynamoDB

Terraform creates a table with a string partition key named `id`.

## Cognito

Terraform creates a User Pool + App Client. Create users in Cognito before signing in.

## Notes

- Image + voice enrichment uses Bedrock and Transcribe; see `backend/README.md`.
- API Gateway should pass through `Authorization` headers and enable CORS.
- Camera/mic capture requires HTTPS (or localhost) in modern browsers.
