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

echo "Building app assets..."
while IFS= read -r package_json; do
  app_dir="$(dirname "${package_json}")"
  if node -e "const pkg=require(process.argv[1]); process.exit(pkg.scripts && pkg.scripts.build ? 0 : 1)" "${package_json}"; then
    echo "Building ${app_dir##${ROOT_DIR}/}..."
    if [ -f "${app_dir}/package-lock.json" ]; then
      (cd "${app_dir}" && npm ci)
    else
      (cd "${app_dir}" && npm install)
    fi
    (cd "${app_dir}" && npm run build)
  fi
done < <(find "${ROOT_DIR}/apps" -name package.json -not -path "*/node_modules/*" -not -path "*/dist/*")

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
