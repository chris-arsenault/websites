# Hot Sauce Backend

AWS Lambda (Node.js/TypeScript) for hot sauce tasting entries.

## Endpoints

- `GET /tastings` - public list
- `POST /tastings` - authenticated create (Cognito ID token)

## Environment variables

See `.env.example` for the full list.

## Notes

- The create route uploads media to `MEDIA_BUCKET` and uses Amazon Transcribe + Bedrock for enrichment.
- Product lookup uses Tavily search with page validation heuristics plus Bedrock extraction.
- For production, consider adding GSIs on `name`, `style`, and `date` instead of scanning.
