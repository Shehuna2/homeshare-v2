#!/bin/bash

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

function ensure_env_file() {
  local source_file="$1"
  local target_file="$2"
  local label="$3"

  if [ -f "$target_file" ]; then
    echo "ℹ️  ${label} env already exists: $target_file"
  else
    cp "$source_file" "$target_file"
    echo "✅ Created ${label} env from template: $target_file"
  fi
}

function warn_placeholder() {
  local file="$1"
  local label="$2"
  local pattern="$3"
  local message="$4"

  if rg -q "$pattern" "$file"; then
    echo "⚠️  ${label}: ${message}"
  fi
}

echo "🏁 Homeshare v2 Phase 1 Bootstrap"
echo "================================="

FRONTEND_ENV_TEMPLATE="$ROOT_DIR/packages/frontend/.env.example"
FRONTEND_ENV="$ROOT_DIR/packages/frontend/.env.local"
BACKEND_ENV_TEMPLATE="$ROOT_DIR/packages/backend/.env.example"
BACKEND_ENV="$ROOT_DIR/packages/backend/.env"
CONTRACTS_ENV_TEMPLATE="$ROOT_DIR/packages/contracts/.env.example"
CONTRACTS_ENV="$ROOT_DIR/packages/contracts/.env"

echo "\n📋 Ensuring environment files exist"
ensure_env_file "$FRONTEND_ENV_TEMPLATE" "$FRONTEND_ENV" "Frontend"
ensure_env_file "$BACKEND_ENV_TEMPLATE" "$BACKEND_ENV" "Backend"
ensure_env_file "$CONTRACTS_ENV_TEMPLATE" "$CONTRACTS_ENV" "Contracts"

echo "\n🔍 Scanning for placeholders"
warn_placeholder "$FRONTEND_ENV" "Frontend" "your-api-key" "Replace RPC provider API keys."
warn_placeholder "$FRONTEND_ENV" "Frontend" "0x0000000000000000000000000000000000000000" "Set real contract addresses for active networks."
warn_placeholder "$BACKEND_ENV" "Backend" "postgresql://user:password" "Update DATABASE_URL to your local or staging database."
warn_placeholder "$BACKEND_ENV" "Backend" "your-secret-key-here" "Set a strong JWT_SECRET."
warn_placeholder "$BACKEND_ENV" "Backend" "0x0000000000000000000000000000000000000000" "Set contract/token addresses for active networks."
warn_placeholder "$BACKEND_ENV" "Backend" "your-api-key" "Replace RPC provider API keys."
warn_placeholder "$CONTRACTS_ENV" "Contracts" "0x0000000000000000000000000000000000000000" "Replace zero-address placeholders (deployer key or contract addresses) before deployment."
warn_placeholder "$CONTRACTS_ENV" "Contracts" "your-etherscan-api-key" "Add verification API keys for deployed networks."

cat <<'SUMMARY'

✅ Phase 1 bootstrap complete.
Next steps:
1) Fill in the placeholder values above.
2) Start services with: pnpm dev
3) Deploy contracts when ready: cd packages/contracts && pnpm compile
SUMMARY
