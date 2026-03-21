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

while IFS='=' read -r key value; do
  # skip empty lines and comments
  [[ -z "$key" || "$key" == \#* ]] && continue
  printf "  %-40s = %s\n" "$key" "$value"
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
