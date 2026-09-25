#!/usr/bin/env bash
# Build the frontend and package the whole project (without node_modules / dist) into a zip.
#   ./scripts/generate.sh [output.zip]
source "$(dirname "$0")/_common.sh"
need zip
OUT="${1:-$ROOT_DIR/../wbfmh-appointment.zip}"
"$(dirname "$0")/frontend.sh" build
rm -f "$OUT"
(cd "$ROOT_DIR/.." && zip -rq "$OUT" "$(basename "$ROOT_DIR")" \
  -x '*/node_modules/*' '*/dist/*' '*/coverage/*' '*.log' '*/.DS_Store')
ok "Created $OUT"
