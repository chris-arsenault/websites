# ru-ai.net

Static site with a small Bedrock proxy API.

This site targets a single deployment, so defaults are baked in and documented for clarity.

## Architecture

- Static HTML/JS in `static/`, served via CloudFront (shared `static-website` module).
- POST /invoke Lambda behind the shared ALB (shared `alb-api` module).
- Per-user rate limiting using a DynamoDB TTL window.
- Frontend reads `config.js` for the invoke URL.

## Defaults

- Site URL: https://ru-ai.ahara.io
- API URL: https://api.ru-ai.ahara.io/invoke
- Rate limit: 10 requests per minute
- Model: anthropic.claude-3-haiku-20240307-v1:0
- CORS: handled by Lambda response headers
