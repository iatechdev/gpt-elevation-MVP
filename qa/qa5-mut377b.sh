#!/bin/bash
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE
export PLAYWRIGHT_MODULE=$QA_TOOLS/playwright/node_modules/playwright PLAYWRIGHT_BROWSERS_PATH=$QA_TOOLS/pw-browsers AXE=$QA_TOOLS/lh/node_modules/axe-core/axe.min.js BASE=http://127.0.0.1:4365 API=http://127.0.0.1:8199 FRONT=$Q/pr377/frontend OUT=$Q/out/e377 RUNS=2
for id in "$@"; do
  git -C $Q/pr377 checkout -q -- frontend/src; node qa/qa5-mut377b.cjs $id || continue
  (cd $Q/pr377/frontend && rm -rf dist && VITE_ENABLE_CAREER_PREVIEW=true VITE_CAREER_SOURCE=api VITE_BACKEND_URL=http://127.0.0.1:8199 npm run build >/dev/null 2>&1; echo "$id build=$?"; echo "$id suite CI: $(node --test test/*.test.mjs 2>&1 | grep -E '^# fail' | tr -d '\n')")
  sleep 2; echo "$id mi espera: $(timeout 250 node qa/qa5-377-wait.cjs 2>&1 | grep -E 'MIENTRAS' | grep -o 'DESPUÉS: {[^}]*}' | tr '
' '|')"
  git -C $Q/pr377 checkout -q -- frontend/src
done
