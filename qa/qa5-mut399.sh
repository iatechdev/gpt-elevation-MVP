#!/bin/bash
# qa/qa5-mut399.sh G2:F4 ...  (id:ONLY de mi E2E). Dev: npm test completo; mi E2E: subconjunto.
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE
for pair in "$@"; do id=${pair%%:*}; only=${pair##*:}
  git -C $Q/pr399 checkout -q -- frontend/src; node qa/qa5-mut399.cjs $id || continue
  (cd $Q/pr399/frontend && rm -rf dist && VITE_BACKEND_URL=http://127.0.0.1:8187 npm run build >/dev/null 2>&1; echo "$id build=$?"; echo "$id CI de Dev: $(node --test test/*.test.mjs 2>&1 | grep -E '^# fail' | tr -d '\n')")
  sleep 1; echo "$id mi E2E ($only): $(bash qa/qa5-398-run.sh BASE=http://127.0.0.1:4369 NEW399=1 ONLY=$only 2>&1 | grep -E '^FALLA|^RESUMEN|ABORTA' | cut -c1-110 | head -2 | tr '\n' '|')"
  git -C $Q/pr399 checkout -q -- frontend/src
done
