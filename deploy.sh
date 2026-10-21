#!/bin/bash
set -e

PROJECT="vercel-nextjs-typescript-starter"
VERCEL_TOKEN=$VERCEL_TOKEN

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  DevOps Agent — Deploy to Production"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Show env vars ────────────────────────────────────────
echo "📋  Environment Variables (.env.local)"
echo ""

if [[ ! -f .env.local ]]; then
  echo "❌  .env.local not found"
  exit 1
fi

# Show which variables are set without printing their values: only *_URL values are shown.
while IFS='=' read -r key value; do
  # skip empty lines and comments
  [[ -z "$key" || "$key" == \#* ]] && continue
  if [[ -z "$value" ]]; then
    shown="(empty)"
  elif [[ "$key" == *_URL ]]; then
    shown="$value"
  else
    shown="set (${#value} chars, hidden)"
  fi
  printf "  %-40s = %s\n" "$key" "$shown"
done < .env.local

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 2. Build ────────────────────────────────────────────────
echo "🔨  Building..."
echo ""
pnpm build

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 3. Deploy ───────────────────────────────────────────────
echo "🚀  Deploying to production..."
echo ""
npx vercel --prod

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  Done"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
