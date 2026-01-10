# Scorchbook Tasting Tracker

Vite + React UI with a Node.js Lambda API for logging hot sauce tastings.

This app targets a single deployment, so defaults are baked in and documented for clarity.

## Architecture

- Frontend SPA with photo + voice capture and sign-in.
- API for ingest, enrichment, and listing tastings.
- Storage in S3 (media) and DynamoDB (tastings).
- Auth via Cognito ID tokens on write routes.
- Enrichment via Transcribe + Bedrock, with Tavily search for product lookup.

## Defaults

- App URL: https://sauce.ahara.io
- API URL: https://sauce-api.ahara.io
- Resource prefix: scorchbook-ffcf7631 (table and buckets)
- Allowed origins: http://localhost:5173, https://sauce.ahara.io
- Public media base: https://scorchbook-ffcf7631-media.s3.amazonaws.com
- Model tuning: anthropic.claude-3-haiku-20240307-v1:0, en-US, poll 1500ms, max polls 40
- Tavily key: loaded from Secrets Manager entry tavily/dev in deployed environments

## Local development

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

```bash
cd backend
npm install
npm run build
```

The frontend reads runtime settings from `/config.js` when deployed; the `.env.example` files mirror defaults for local use.

## Deploy

```bash
./scripts/deploy.sh
```

The deploy script builds both apps and applies the infrastructure.
