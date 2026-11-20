#!/usr/bin/env bash

set -euo pipefail

APP_URL="${APP_URL:-https://contextops-web.vercel.app}"
APP_URL="${APP_URL%/}"
MAX_ATTEMPTS="${MAX_ATTEMPTS:-12}"
RETRY_SECONDS="${RETRY_SECONDS:-15}"

check_endpoint() {
  local name="$1"
  local url="$2"
  local expected_pattern="$3"
  local attempt
  local response

  for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1)); do
    if response="$(curl --fail --silent --show-error --location \
      --connect-timeout 10 --max-time 30 "$url")" && \
      grep -Eq "$expected_pattern" <<<"$response"; then
      echo "PASS: $name"
      return 0
    fi

    if ((attempt < MAX_ATTEMPTS)); then
      echo "WAIT: $name (attempt $attempt/$MAX_ATTEMPTS)"
      sleep "$RETRY_SECONDS"
    fi
  done

  echo "FAIL: $name did not return the expected response" >&2
  return 1
}

check_endpoint \
  "frontend" \
  "$APP_URL/login" \
  "ContextOps"

check_endpoint \
  "API health" \
  "$APP_URL/api/health" \
  '"status"[[:space:]]*:[[:space:]]*"ok"'

check_endpoint \
  "GitHub authentication configuration" \
  "$APP_URL/api/auth/github/config" \
  '"configured"[[:space:]]*:[[:space:]]*true'

echo "Production smoke test passed for $APP_URL"
