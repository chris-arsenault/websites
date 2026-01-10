# Scorchbook Backend

AWS Lambda (Node.js/TypeScript) for hot sauce tasting entries.

This backend targets a single deployment, so defaults are baked in and documented for clarity.

## Endpoints

- `GET /tastings` - public list
- `POST /tastings` - authenticated create (Cognito ID token)
- `POST /tastings/{id}/rerun` - re-run enrichment on existing media (Cognito ID token)
- `DELETE /tastings/{id}` - delete a tasting (Cognito ID token)

## Configuration

The Lambda reads configuration from environment variables; `.env.example` shows the expected shape and fixed defaults.

Core settings:

- `TABLE_NAME` (default: `scorchbook-ffcf7631-tastings`)
- `MEDIA_BUCKET` (default: `scorchbook-ffcf7631-media`)
- `PUBLIC_MEDIA_BASE_URL` (default: `https://scorchbook-ffcf7631-media.s3.amazonaws.com`, fallback is `s3://` URLs)
- `COGNITO_USER_POOL_ID` (deployment-specific)
- `COGNITO_CLIENT_ID` (deployment-specific)
- `ALLOWED_ORIGINS` (default: `http://localhost:5173,https://sauce.ahara.io`)
- `TAVILY_API_KEY` (raw key or JSON secret blob)

Tuning defaults:

- `BEDROCK_MODEL_ID` (default: `anthropic.claude-3-haiku-20240307-v1:0`)
- `TRANSCRIBE_LANGUAGE` (default: `en-US`)
- `TRANSCRIBE_POLL_MS` (default: `1500`)
- `TRANSCRIBE_MAX_POLLS` (default: `40`)

## Notes

- The create route uploads media to `MEDIA_BUCKET` and uses Amazon Transcribe + Bedrock for enrichment.
- Product lookup uses Tavily search with page validation heuristics plus Bedrock extraction.
- For production, consider adding GSIs on `name`, `style`, and `date` instead of scanning.
