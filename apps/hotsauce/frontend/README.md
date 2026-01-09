# Scorchbook Frontend

Vite + React + TypeScript UI for the hot sauce tasting tracker.

This UI targets a single deployment, so defaults are baked in and documented for clarity.

## Development

```bash
npm install
cp .env.example .env
npm run dev
```

## Configuration

The app reads runtime config from `/config.js` when deployed, or Vite env for local dev.
`.env.example` shows the expected keys and fixed defaults.

- `VITE_API_BASE_URL` (default: `https://sauce-api.ahara.io`)
- `VITE_COGNITO_USER_POOL_ID` (deployment-specific)
- `VITE_COGNITO_CLIENT_ID` (deployment-specific)

## Production

The runtime `/config.js` file provides the API base URL and Cognito IDs.
The Vite build reads that file at runtime so the same build can be deployed across environments.

## Features

- Photo + voice capture for tasting entries
- Filters, scoring, and tasting notes
- Pipeline re-run and delete actions for signed-in users
