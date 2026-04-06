# Agents Guide

This repo is a small collection of production-only personal websites. Keep changes simple and direct. There is no need for extra configuration, defensive programming, or heavy abstractions. These apps are quick and dirty by design.

## Sites

- `apps/ru-ai.net`: Static site with a small Lambda backend, served at `ru-ai.ahara.io`.

## Architecture

- Static sites use the shared `static-website` module from `ahara-tf-patterns` (S3 + CloudFront + Route53 + ACM).
- APIs use the shared `alb-api` module from `ahara-tf-patterns` (shared ALB + Lambda in VPC).
- Shared infrastructure (VPC, ALB, subnets) discovered via `platform-context` module.

## Deployment

- `scripts/deploy.sh` builds all apps with a `build` script under `apps/**/package.json`, then runs Terraform from `infrastructure/terraform`.
- Terraform state is stored in S3 (see `scripts/deploy.sh` for defaults).
- Domains are configured in `infrastructure/terraform/locals.tf` and per-site module files.

## Security

- The only meaningful security concerns are AWS resource access via Lambda IAM policies. Keep permissions minimal and scoped to the site.
