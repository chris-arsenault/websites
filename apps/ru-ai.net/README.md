# ru-ai.net

Static site with a small Bedrock proxy API.

This site targets a single deployment, so defaults are baked in and documented for clarity.

## Architecture

- Static HTML/JS in `static/`, served as a CDN-backed site.
- POST /invoke Lambda that forwards prompts to Bedrock.
- Per-user rate limiting using a DynamoDB TTL window.
- Frontend reads `config.js` for the invoke URL.

## Defaults

- Site URL: https://ru-ai.net
- API URL: https://api.ru-ai.net/invoke
- Rate limit: 10 requests per minute
- Model: anthropic.claude-3-haiku-20240307-v1:0
- CORS: allow all origins
