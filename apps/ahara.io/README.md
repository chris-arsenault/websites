# ahara.io

Vite + React project portfolio site.

This site targets a single deployment, so defaults are baked in and documented for clarity.

## Architecture

- SPA built with Vite + React and deployed as static assets from `dist/`.
- No runtime config; content is bundled at build time.

## Defaults

- Site URL: https://ahara.io

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy

```bash
./scripts/deploy.sh
```

The deploy script builds app assets and applies Terraform for the full stack.
