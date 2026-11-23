#!/bin/bash
# qa/qa5-398-run.sh [ONLY=..] [LABEL=pr|main]  (BASE 4367 = PR; 4368 = main)
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5
export PLAYWRIGHT_MODULE=$QA_TOOLS/playwright/node_modules/playwright PLAYWRIGHT_BROWSERS_PATH=$QA_TOOLS/pw-browsers AXE=$QA_TOOLS/lh/node_modules/axe-core/axe.min.js API=http://127.0.0.1:8187 BACKEND=$Q/pr398/backend LABEL=pr BASE=${BASE:-http://127.0.0.1:4367}
for kv in "$@"; do export "$kv"; done; [ "$LABEL" = main ] && export BASE=http://127.0.0.1:4368
cd "$(dirname "$0")/.." && exec node qa/qa5-398.cjs
