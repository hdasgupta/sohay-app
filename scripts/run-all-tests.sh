#!/usr/bin/env bash
# Runs every automated test: backend API, backend performance, frontend unit/component/view and frontend performance.
source "$(dirname "$0")/_common.sh"
DIR="$(dirname "$0")"
"$DIR/backend.sh" test
"$DIR/backend.sh" perf
"$DIR/frontend.sh" test
ok "All test suites passed"
