#!/bin/sh
set -e

PRIVATE_KEY_FILE=$(mktemp)
printf '%s' "$GITHUB_APP_PRIVATE_KEY" > "$PRIVATE_KEY_FILE"

NOW=$(date +%s)
HEADER=$(printf '{"alg":"RS256","typ":"JWT"}' | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')
PAYLOAD=$(printf '{"iat":%d,"exp":%d,"iss":"%s"}' "$((NOW-60))" "$((NOW+540))" "$GITHUB_APP_ID" | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')
SIG=$(printf '%s.%s' "$HEADER" "$PAYLOAD" | openssl dgst -sha256 -sign "$PRIVATE_KEY_FILE" | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')
JWT="$HEADER.$PAYLOAD.$SIG"

TOKEN=$(curl -sf -X POST \
  -H "Authorization: Bearer $JWT" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/app/installations/$GITHUB_APP_INSTALLATION_ID/access_tokens" \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

curl -sf -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/tadjh/pragmatic-papers/dispatches" \
  -d "{\"event_type\":\"coolify-deploy-success\",\"client_payload\":{\"url\":\"https://$COOLIFY_FQDN\"}}"

rm -f "$PRIVATE_KEY_FILE"
