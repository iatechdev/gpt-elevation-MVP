#!/bin/bash
# Para cada mutación: aplica, construye, corre la prueba de pantalla de Dev y mi subconjunto E2E, y revierte. Uso: qa/qa5-mut398.sh G1:F3 G2:F4 ...
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE
for pair in "$@"; do id=${pair%%:*}; only=${pair##*:}
  git -C $Q/pr398 checkout -q -- frontend/src; node qa/qa5-mut398.cjs $id || continue
  (cd $Q/pr398/frontend && rm -rf dist && VITE_BACKEND_URL=http://127.0.0.1:8187 npm run build >/dev/null 2>&1; echo "$id build=$?"; dev=$(node --test test/es-110-actualizar-pantalla.test.mjs test/es-110-actualizar-diferencia.test.mjs 2>&1 | grep -E "^# fail" | tr -d '\n'); echo "$id suite Dev: $dev")
  r=$(bash qa/qa5-398-run.sh ONLY=$only 2>&1 | grep -E "^FALLA|^RESUMEN|ABORTA" | cut -c1-120 | head -3 | tr '\n' '|'); echo "$id mi E2E ($only): $r"
  git -C $Q/pr398 checkout -q -- frontend/src
done
