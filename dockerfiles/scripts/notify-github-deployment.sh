#!/bin/sh
# Reports a successful deploy to the GitHub Deployments API so PR pages show
# the real status instead of "This branch has not been deployed / No deployments".
# Coolify's own check/comment bot uses a separate mechanism and does not
# populate this widget, so we report it ourselves.
#
# Requires GITHUB_DEPLOYMENT_TOKEN (a PAT or fine-grained token with
# "Deployments: write" permission on the repo) to be set as a Coolify secret.
# Uses SOURCE_COMMIT and COOLIFY_FQDN, which Coolify injects automatically.
# Never fails the container startup — any error here is logged and ignored.

GITHUB_REPO="digitalgroundgame/pragmatic-papers"
API="https://api.github.com/repos/${GITHUB_REPO}"

echo "========================================="
echo "GitHub Deployment Notifier"
echo "========================================="

if [ -z "$GITHUB_DEPLOYMENT_TOKEN" ]; then
    echo "GITHUB_DEPLOYMENT_TOKEN not set, skipping GitHub deployment notification"
    exit 0
fi

if [ -z "$SOURCE_COMMIT" ]; then
    echo "SOURCE_COMMIT not set, skipping GitHub deployment notification"
    exit 0
fi

ENVIRONMENT="production"
ENVIRONMENT_URL="https://${COOLIFY_FQDN}"

if [ "$BUILD_ENV" = "preview" ] && [ -n "$COOLIFY_FQDN" ]; then
    PREFIX=$(echo "$COOLIFY_FQDN" | cut -d'.' -f1)
    ENVIRONMENT="preview-${PREFIX}"
elif [ "$BUILD_ENV" = "staging" ]; then
    ENVIRONMENT="staging"
fi

echo "Repo: ${GITHUB_REPO}"
echo "Commit: ${SOURCE_COMMIT}"
echo "Environment: ${ENVIRONMENT}"

DEPLOYMENT_RESPONSE=$(wget -q -O - \
    --header="Authorization: Bearer ${GITHUB_DEPLOYMENT_TOKEN}" \
    --header="Accept: application/vnd.github+json" \
    --header="Content-Type: application/json" \
    --post-data="{\"ref\":\"${SOURCE_COMMIT}\",\"environment\":\"${ENVIRONMENT}\",\"auto_merge\":false,\"required_contexts\":[],\"transient_environment\":true,\"production_environment\":false,\"description\":\"Coolify deployment\"}" \
    "${API}/deployments" 2>/dev/null)

DEPLOYMENT_ID=$(echo "$DEPLOYMENT_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)

if [ -z "$DEPLOYMENT_ID" ]; then
    echo "Failed to create GitHub deployment, skipping status update"
    echo "Response: ${DEPLOYMENT_RESPONSE}"
    exit 0
fi

echo "Created GitHub deployment ${DEPLOYMENT_ID}, marking as success"

wget -q -O /dev/null \
    --header="Authorization: Bearer ${GITHUB_DEPLOYMENT_TOKEN}" \
    --header="Accept: application/vnd.github+json" \
    --header="Content-Type: application/json" \
    --post-data="{\"state\":\"success\",\"environment_url\":\"${ENVIRONMENT_URL}\",\"description\":\"Deployed via Coolify\"}" \
    "${API}/deployments/${DEPLOYMENT_ID}/statuses" 2>/dev/null

echo "GitHub deployment status reported"
echo "========================================="
