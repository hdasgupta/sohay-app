#!/usr/bin/env bash
# Frontend helper
#   ./scripts/frontend.sh install    npm ci (or npm install)
#   ./scripts/frontend.sh dev        Vite dev server on http://localhost:5173 (uses .env.development)
#   ./scripts/frontend.sh build      production build into frontend/dist (uses .env.production)
#   ./scripts/frontend.sh build-dev  build that talks to the local backend
#   ./scripts/frontend.sh preview    serve the built dist folder
#   ./scripts/frontend.sh test       component / view / unit tests (Vitest)
#   ./scripts/frontend.sh perf       frontend performance tests
source "$(dirname "$0")/_common.sh"
need node; need npm
cd "$FRONTEND_DIR"
case "${1:-help}" in
  install)   if [ -f package-lock.json ]; then npm ci; else npm install; fi ;;
  dev)       npm run dev -- --port 5173 ;;
  build)     npm run build ;;
  build-dev) npm run build:dev ;;
  preview)   npm run preview ;;
  test)      npm test ;;
  perf)      npm run test:perf ;;
  *) sed -n '2,9p' "$0" ;;
esac
