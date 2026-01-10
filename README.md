# Websites

Assumptions: this repo targets a fixed set of domains/accounts, so defaults are set accordingly and documented for visibility.

Monorepo for small web properties under `apps/` with shared Terraform in `infrastructure/terraform`.

## Apps

- `apps/scorchbook` - Scorchbook, a hot sauce tasting tracker (Vite + React frontend, Node.js Lambda backend).
- `apps/ru-ai.net` - Static site with a small Lambda-powered backend.
- `apps/ahara.io` - Vite + React project portfolio site.
- `apps/stack-atlas` - Stack Atlas, a tech stack standardization explorer (Vite + React).

## Deploy

```bash
./scripts/deploy.sh
```

The deploy script builds app assets (any `apps/**/package.json` with a build script) and applies Terraform for the full stack.
Ensure AWS credentials + region are available in your shell.

## Terraform

Infra lives in `infrastructure/terraform`, including shared modules and per-site stacks.
