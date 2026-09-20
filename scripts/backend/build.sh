#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../../backend"
npm install
npm run lint:syntax
