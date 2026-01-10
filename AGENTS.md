# Agents Guide

This repo is a small collection of production-only personal websites. Keep changes simple and direct. There is no need for extra configuration, defensive programming, or heavy abstractions. These apps are quick and dirty by design.

## Sites

- `apps/ahara.io`: Vite + React static site deployed to S3 + CloudFront.
- `apps/scorchbook`: Scorchbook with a Vite + React frontend and a Node.js Lambda backend.
- `apps/ru-ai.net`: Static site with a small Python Lambda backend.
- `apps/stack-atlas`: Stack Atlas Vite + React static site.

## Architecture

- Static sites use the Terraform `static-website` module (S3 + CloudFront + Route53 + ACM).
- SPA runtime-config sites use the `spa-website` module (same stack plus runtime `config.js`).
- APIs use the `api-http` module (API Gateway HTTP API + Lambda).
- Supporting modules: `dynamo-table`, `s3-media`, `cognito`.

## Deployment

- `scripts/deploy.sh` builds all apps with a `build` script under `apps/**/package.json`, then runs Terraform from `infrastructure/terraform`.
- Terraform state is stored in S3 (see `scripts/deploy.sh` for defaults).
- Domains are configured in `infrastructure/terraform/locals.tf` and per-site module files.

## Security

- The only meaningful security concerns are AWS resource access via Lambda IAM policies. Keep permissions minimal and scoped to the site.
