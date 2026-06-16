#!/usr/bin/env bash
# Deploy the resume site to PRODUCTION only → https://derek-chen.pages.dev
#
# Always targets the production branch (main). This is deliberate: the
# derek-chen Pages project is direct-upload (no Git integration), so a
# deploy that passes any OTHER --branch name creates a stray, publicly
# reachable preview subdomain (e.g. content.derek-chen.pages.dev) that
# lingers as "an old site". Routing every deploy through this script
# keeps that from happening — there is no branch knob to get wrong.
#
# Usage:  ./deploy.sh
set -euo pipefail

# API worker domain injected into the build for /ask and /status.
PUBLIC_API_URL="https://devbox-api.chinte-cheng.workers.dev"

cd "$(dirname "$0")/site"

echo "▶ Building site (PUBLIC_API_URL=$PUBLIC_API_URL)…"
PUBLIC_API_URL="$PUBLIC_API_URL" npm run build

[[ -d dist && -n "$(ls -A dist)" ]] || { echo "✗ build produced no dist/ output" >&2; exit 1; }

echo "▶ Deploying to production (branch: main)…"
npx --no-install wrangler pages deploy dist \
  --project-name derek-chen \
  --branch main \
  --commit-dirty=true

echo "✅ Production deploy complete → https://derek-chen.pages.dev"
