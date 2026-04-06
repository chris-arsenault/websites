# Claude Guide

These are production-only, personal sites. Keep work fast and simple. Avoid extra configuration, defensive programming, or enterprise-style scaffolding. Prefer direct edits that match existing patterns.

## Sites and Domains

- `apps/ru-ai.net` -> `https://ru-ai.ahara.io` (site), `https://api.ru-ai.ahara.io` (API)

## Deployment Pattern

- `scripts/deploy.sh` builds any app under `apps/**` that has a `build` script, then applies Terraform in `infrastructure/terraform`.
- Terraform uses shared modules from `ahara-tf-patterns`: `static-website` for static sites, `alb-api` for APIs behind the shared ALB.

## Architecture Summary

- Static assets live in S3 and are served via CloudFront.
- DNS and TLS are managed by Route53 + ACM from Terraform.
- APIs are Lambda functions behind the shared ALB via `alb-api` module.
- All infrastructure uses shared platform modules from `ahara-tf-patterns`.

## Security

- The only real security concern is AWS access through Lambda IAM policies. Keep those narrow and scoped.

## Pre-commit CI check

**Run `make ci` before committing any change.** This runs the same lint, format, typecheck, and test steps as GitHub Actions. Do not commit if it fails.
