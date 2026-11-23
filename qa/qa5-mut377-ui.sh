#!/bin/bash
# Mutaciones que sobreviven a CI+integración: construye el mutante, corre mi guion UI (y e377-real para M18) y revierte. (vite preview sirve dist sin caché: se reconstruye en sitio.)
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE
export PLAYWRIGHT_MODULE=$QA_TOOLS/playwright/node_modules/playwright PLAYWRIGHT_BROWSERS_PATH=$QA_TOOLS/pw-browsers AXE=$QA_TOOLS/lh/node_modules/axe-core/axe.min.js BASE=http://127.0.0.1:4365 API=http://127.0.0.1:8199 FRONT=$Q/pr377/frontend OUT=$Q/out/e377 CLONE=$Q/pr377
for id in "$@"; do
  git -C $Q/pr377 checkout -q -- frontend/src; node qa/qa5-mut377-one.cjs $id || continue
  (cd $Q/pr377/frontend && rm -rf dist && VITE_ENABLE_CAREER_PREVIEW=true VITE_CAREER_SOURCE=api VITE_BACKEND_URL=http://127.0.0.1:8199 npm run build >/dev/null 2>&1; echo "$id build=$?")
  sleep 2; r=$(timeout 280 node qa/qa5-377-ui.cjs 2>&1 | grep -E "^FALLA|^UI #377|ABORTA" | cut -c1-140 | head -3 | tr '\n' '|'); echo "$id ui: $r"
  if [ "$id" = M18 ] || [ "$id" = M15 ]; then e=$(timeout 280 node qa/qa5-e377-real.cjs 2>&1 | grep -E "FALLA|comprobaciones correctas" | cut -c1-140 | head -3 | tr '\n' '|'); echo "$id real: $e"; fi
  git -C $Q/pr377 checkout -q -- frontend/src
done
