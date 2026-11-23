#!/bin/bash
# [QA-Claude-5] qa/qa5-run.sh <script.cjs> <build: pr392|main> <base> [K=V...]
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; ROOT="$(git rev-parse --show-toplevel)"; S=$1; B=$2; D=$3; shift 3
export PLAYWRIGHT_MODULE=$QA_TOOLS/playwright/node_modules/playwright PLAYWRIGHT_BROWSERS_PATH=$QA_TOOLS/pw-browsers BACKEND="$Q/main/backend" AXE=$QA_TOOLS/lh/node_modules/axe-core/axe.min.js
export DIST="$Q/dist-$B" DATABASE_URL="postgres://qa5:$(cat $Q/pw.txt)@127.0.0.1:54361/$D" LABEL=$([ "$B" = main ] && echo main || echo pr)
for kv in "$@"; do export "$kv"; done
exec node "$ROOT/qa/$S" < /dev/null
