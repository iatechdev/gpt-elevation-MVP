#!/bin/bash
# Para cada mutación que sobrevive a CI+integración: construye el mutante, reinicia la vista previa y corre mis guiones E2E y de API contra él; revierte.
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE
export PLAYWRIGHT_MODULE=$QA_TOOLS/playwright/node_modules/playwright PLAYWRIGHT_BROWSERS_PATH=$QA_TOOLS/pw-browsers AXE=$QA_TOOLS/lh/node_modules/axe-core/axe.min.js BASE=http://127.0.0.1:4365 API=http://127.0.0.1:8199 FRONT=$Q/pr377/frontend OUT=$Q/out/e377 CLONE=$Q/pr377
for id in "$@"; do
  git -C $Q/pr377 checkout -q -- frontend/src; node qa/qa5-mut377-one.cjs $id || continue
  (cd $Q/pr377/frontend && rm -rf dist && VITE_ENABLE_CAREER_PREVIEW=true VITE_CAREER_SOURCE=api VITE_BACKEND_URL=http://127.0.0.1:8199 npm run build >/dev/null 2>&1; echo "$id build=$?")
  kill $(cat $Q/prev-pr.pid) 2>/dev/null; sleep 1; (cd $Q/pr377/frontend && nohup npx vite preview --host 127.0.0.1 --port 4365 --strictPort >/dev/null 2>&1 & echo $! > $Q/prev-pr.pid); sleep 4
  r=$(timeout 300 node qa/qa5-e377-real.cjs 2>&1 | grep -E "FALLA|comprobaciones correctas" | cut -c1-150 | head -3 | tr '\n' '|'); echo "$id e2e-real: $r"
  a=$(timeout 300 node qa/qa5-e377-api.cjs 2>&1 | grep -E "^FALLA|comprobaciones correctas" | grep -v "HALLAZGO" | cut -c1-150 | head -3 | tr '\n' '|'); echo "$id api: $a"
  git -C $Q/pr377 checkout -q -- frontend/src
done
