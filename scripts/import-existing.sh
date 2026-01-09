#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT_DIR}/infrastructure/terraform"

STATE_BUCKET="${STATE_BUCKET:-tf-state-websites-559098897826}"
STATE_REGION="${STATE_REGION:-us-east-1}"
USE_LOCKFILE="${USE_LOCKFILE:-true}"

RU_AI_HOSTNAME="ru-ai.net"
RU_AI_BUCKET="websites-ru-ai-ru-ai-net"
RU_AI_OAC_NAME="websites-ru-ai-oac"
RU_AI_API_NAME="websites-ru-ai-bedrock-proxy-http"
RU_AI_LAMBDA_NAME="websites-ru-ai-bedrock-proxy"
RU_AI_ROLE_NAME="websites-ru-ai-bedrock-proxy-lambda-role"
RU_AI_POLICY_NAME="websites-ru-ai-bedrock-proxy-lambda-policy"
RU_AI_DYNAMO_TABLE="websites-ru-ai-rate-limit"
RU_AI_BEDROCK_PROFILE_NAME="websites-ru-ai-instance-profile"

HOTSAUCE_API_ID="7drsohnh8l"
HOTSAUCE_GET_ROUTE_ID="tbwxm6k"
HOTSAUCE_POST_ROUTE_ID="hm6ce0f"

tf() {
  terraform -chdir="${TF_DIR}" "$@"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd terraform
require_cmd aws

if command -v rg >/dev/null 2>&1; then
  state_has() {
    tf state list 2>/dev/null | rg -Fxq "$1"
  }
else
  state_has() {
    tf state list 2>/dev/null | grep -Fxq "$1"
  }
fi

import_required() {
  local addr="$1"
  local id="$2"

  if state_has "$addr"; then
    echo "Skipping ${addr} (already in state)"
    return 0
  fi

  if [ -z "${id}" ] || [ "${id}" = "None" ] || [ "${id}" = "null" ]; then
    echo "Missing import id for ${addr}" >&2
    exit 1
  fi

  tf import "$addr" "$id"
}

import_optional() {
  local addr="$1"
  local id="$2"

  if state_has "$addr"; then
    echo "Skipping ${addr} (already in state)"
    return 0
  fi

  if [ -z "${id}" ] || [ "${id}" = "None" ] || [ "${id}" = "null" ]; then
    echo "Skipping ${addr} (no existing remote object)"
    return 0
  fi

  tf import "$addr" "$id"
}

echo "Initializing Terraform backend..."
tf init \
  -backend-config="bucket=${STATE_BUCKET}" \
  -backend-config="region=${STATE_REGION}" \
  -backend-config="use_lockfile=${USE_LOCKFILE}"

ACCOUNT_ID="$(aws sts get-caller-identity --query "Account" --output text)"
ZONE_ID="$(aws route53 list-hosted-zones-by-name --dns-name "${RU_AI_HOSTNAME}" --query "HostedZones[0].Id" --output text)"
ZONE_ID="${ZONE_ID##*/}"

RU_AI_BUCKET_EXISTS="false"
if aws s3api head-bucket --bucket "${RU_AI_BUCKET}" >/dev/null 2>&1; then
  RU_AI_BUCKET_EXISTS="true"
  echo "ru-ai bucket detected: ${RU_AI_BUCKET}"
else
  echo "ru-ai bucket not found; it will be created by Terraform."
  RU_AI_BUCKET=""
fi

CERT_ARN="$(aws acm list-certificates \
  --region "${STATE_REGION}" \
  --query "CertificateSummaryList[?DomainName=='${RU_AI_HOSTNAME}'].CertificateArn | [0]" \
  --output text)"

VALIDATION_NAME="$(aws acm describe-certificate \
  --region "${STATE_REGION}" \
  --certificate-arn "${CERT_ARN}" \
  --query "Certificate.DomainValidationOptions[?DomainName=='${RU_AI_HOSTNAME}'].ResourceRecord.Name | [0]" \
  --output text)"
VALIDATION_TYPE="$(aws acm describe-certificate \
  --region "${STATE_REGION}" \
  --certificate-arn "${CERT_ARN}" \
  --query "Certificate.DomainValidationOptions[?DomainName=='${RU_AI_HOSTNAME}'].ResourceRecord.Type | [0]" \
  --output text)"

OAC_ID="$(aws cloudfront list-origin-access-controls \
  --query "OriginAccessControlList.Items[?Name=='${RU_AI_OAC_NAME}'].Id | [0]" \
  --output text)"
CF_ID="$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '${RU_AI_HOSTNAME}')].Id | [0]" \
  --output text)"

API_ID="$(aws apigatewayv2 get-apis \
  --region "${STATE_REGION}" \
  --query "Items[?Name=='${RU_AI_API_NAME}'].ApiId | [0]" \
  --output text)"
INTEGRATION_ID="$(aws apigatewayv2 get-integrations \
  --region "${STATE_REGION}" \
  --api-id "${API_ID}" \
  --query "Items[0].IntegrationId | [0]" \
  --output text)"
ROUTE_ID="$(aws apigatewayv2 get-routes \
  --region "${STATE_REGION}" \
  --api-id "${API_ID}" \
  --query "Items[?RouteKey=='POST /invoke'].RouteId | [0]" \
  --output text)"
STAGE_ID="${API_ID}/\$default"

BEDROCK_PROFILE_ID="$(aws bedrock list-inference-profiles \
  --region "${STATE_REGION}" \
  --query "inferenceProfileSummaries[?inferenceProfileName=='${RU_AI_BEDROCK_PROFILE_NAME}'].inferenceProfileId | [0]" \
  --output text)"

HOTSAUCE_MAPPING_ID="$(aws apigatewayv2 get-api-mappings \
  --domain-name sauce-api.ahara.io \
  --region "${STATE_REGION}" \
  --query "Items[?ApiMappingKey=='api'].ApiMappingId | [0]" \
  --output text)"

echo "Importing ru-ai site resources..."
import_optional module.ru_ai_site.aws_s3_bucket.website "${RU_AI_BUCKET}"
import_optional module.ru_ai_site.aws_s3_bucket_public_access_block.website "${RU_AI_BUCKET}"
import_optional module.ru_ai_site.aws_s3_bucket_versioning.website "${RU_AI_BUCKET}"
import_optional module.ru_ai_site.aws_s3_bucket_policy.website "${RU_AI_BUCKET}"
import_required module.ru_ai_site.aws_cloudfront_origin_access_control.website "${OAC_ID}"
import_required module.ru_ai_site.aws_cloudfront_distribution.website "${CF_ID}"
import_required module.ru_ai_site.aws_acm_certificate.website "${CERT_ARN}"
import_required 'module.ru_ai_site.aws_route53_record.cert_validation["ru-ai.net"]' "${ZONE_ID}_${VALIDATION_NAME}_${VALIDATION_TYPE}"
import_required module.ru_ai_site.aws_route53_record.website "${ZONE_ID}_${RU_AI_HOSTNAME}_A"
import_required module.ru_ai_site.aws_route53_record.website_ipv6 "${ZONE_ID}_${RU_AI_HOSTNAME}_AAAA"

echo "Importing ru-ai backend resources..."
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${RU_AI_POLICY_NAME}"
import_required module.ru_ai_backend.aws_dynamodb_table.rate_limits "${RU_AI_DYNAMO_TABLE}"
import_required module.ru_ai_backend.aws_iam_role.lambda_role "${RU_AI_ROLE_NAME}"
import_required module.ru_ai_backend.aws_iam_policy.lambda_policy "${POLICY_ARN}"
import_required module.ru_ai_backend.aws_iam_role_policy_attachment.lambda_inline_attach "${RU_AI_ROLE_NAME}/${POLICY_ARN}"
import_required module.ru_ai_backend.aws_iam_role_policy_attachment.lambda_basic_logs "${RU_AI_ROLE_NAME}/arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
import_required module.ru_ai_backend.aws_lambda_function.bedrock_proxy "${RU_AI_LAMBDA_NAME}"
import_required module.ru_ai_backend.aws_lambda_permission.apigw_invoke "${RU_AI_LAMBDA_NAME}/AllowAPIGatewayInvoke"
import_required module.ru_ai_backend.aws_apigatewayv2_api.http "${API_ID}"
import_required module.ru_ai_backend.aws_apigatewayv2_integration.lambda_integration "${API_ID}/${INTEGRATION_ID}"
import_required module.ru_ai_backend.aws_apigatewayv2_route.post_invoke "${API_ID}/${ROUTE_ID}"
import_required module.ru_ai_backend.aws_apigatewayv2_stage.prod "${STAGE_ID}"
import_required module.ru_ai_backend.aws_bedrock_inference_profile.model_instance_profile "${BEDROCK_PROFILE_ID}"

echo "Importing hotsauce API mapping (if present)..."
import_optional module.hotsauce_api.aws_apigatewayv2_api_mapping.api "${HOTSAUCE_MAPPING_ID}"

echo "Importing hotsauce routes (if present)..."
import_optional 'module.hotsauce_api.aws_apigatewayv2_route.routes["GET /tastings"]' "${HOTSAUCE_API_ID}/${HOTSAUCE_GET_ROUTE_ID}"
import_optional 'module.hotsauce_api.aws_apigatewayv2_route.routes["POST /tastings"]' "${HOTSAUCE_API_ID}/${HOTSAUCE_POST_ROUTE_ID}"

echo "Imports complete."
