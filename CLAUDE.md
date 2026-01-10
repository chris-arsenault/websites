# Claude Guide

These are production-only, personal sites. Keep work fast and simple. Avoid extra configuration, defensive programming, or enterprise-style scaffolding. Prefer direct edits that match existing patterns.

## Sites and Domains

- `apps/ahara.io` -> `https://ahara.io`
- `apps/scorchbook` -> `https://sauce.ahara.io` (frontend), `https://sauce-api.ahara.io` (API)
- `apps/ru-ai.net` -> `https://ru-ai.net` (site), `https://api.ru-ai.net` (API)
- `apps/stack-atlas` -> `https://stack-atlas.ahara.io`

## Deployment Pattern

- `scripts/deploy.sh` builds any app under `apps/**` that has a `build` script, then applies Terraform in `infrastructure/terraform`.
- Terraform uses modules for static sites (`static-website`), SPA sites with runtime config (`spa-website`), and APIs (`api-http`).

## Architecture Summary

- Static assets live in S3 and are served via CloudFront.
- DNS and TLS are managed by Route53 + ACM from Terraform.
- APIs are Lambda functions behind API Gateway HTTP APIs.
- Supporting infrastructure includes DynamoDB, S3 media buckets, and Cognito for the scorchbook app.

## Security

- The only real security concern is AWS access through Lambda IAM policies. Keep those narrow and scoped.
