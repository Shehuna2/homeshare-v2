#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

health_body=$(curl -s -w "\n%{http_code}" "${BASE_URL}/v1/health")
health_json=$(printf '%s' "${health_body}" | head -n1)
health_status=$(printf '%s' "${health_body}" | tail -n1)

if [[ "${health_status}" != "200" ]]; then
  echo "GET /v1/health failed with status ${health_status}"
  exit 1
fi

node -e "const data = JSON.parse(process.argv[1]); if (!data.ok) { throw new Error('health ok flag missing'); }" "${health_json}"

properties_body=$(curl -s -w "\n%{http_code}" "${BASE_URL}/v1/properties")
properties_json=$(printf '%s' "${properties_body}" | head -n1)
properties_status=$(printf '%s' "${properties_body}" | tail -n1)

if [[ "${properties_status}" != "200" ]]; then
  echo "GET /v1/properties failed with status ${properties_status}"
  exit 1
fi

node -e "const data = JSON.parse(process.argv[1]); if (!Array.isArray(data.properties)) { throw new Error('properties array missing'); }" "${properties_json}"

echo "v1 smoke checks passed"
