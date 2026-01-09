#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT_DIR}/infrastructure/terraform"

STATE_BUCKET="${STATE_BUCKET:-tf-state-websites-559098897826}"
STATE_REGION="${STATE_REGION:-us-east-1}"
USE_LOCKFILE="${USE_LOCKFILE:-true}"

tf() {
  terraform -chdir="${TF_DIR}" "$@"
}

echo "Building hotsauce backend..."
(
  cd "${ROOT_DIR}/apps/hotsauce/backend"
  npm ci
  npm run build
)

echo "Building hotsauce frontend..."
(
  cd "${ROOT_DIR}/apps/hotsauce/frontend"
  npm ci
  npm run build
)

echo "Initializing Terraform backend..."
tf init \
  -backend-config="bucket=${STATE_BUCKET}" \
  -backend-config="region=${STATE_REGION}" \
  -backend-config="use_lockfile=${USE_LOCKFILE}"

echo "Applying Terraform..."
tf apply -auto-approve

echo "Cognito user password:"
PASSWORD="$(tf output -raw cognito_chris_password 2>/dev/null || true)"
if [ -n "${PASSWORD}" ]; then
  echo "${PASSWORD}"
else
  echo "Password not available."
fi