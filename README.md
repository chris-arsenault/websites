# Websites

Monorepo for small web properties under `apps/` with shared Terraform in `infrastructure/terraform`.

## Apps

- `apps/ru-ai.net` - Static site with a small Lambda-powered backend, served at `ru-ai.ahara.io`.

## Deploy

```bash
./scripts/deploy.sh
```

The deploy script builds app assets (any `apps/**/package.json` with a build script) and applies Terraform for the full stack.
Ensure AWS credentials + region are available in your shell.

## Terraform

Infra lives in `infrastructure/terraform`, using shared modules from [ahara-tf-patterns](https://github.com/chris-arsenault/ahara-tf-patterns).
