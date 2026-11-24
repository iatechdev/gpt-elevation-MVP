#!/bin/bash
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE
for id in "$@"; do
  git -C $Q/pr389 checkout -q -- frontend/src; node qa/qa5-mut389.cjs $id || continue
  (cd $Q/pr389/frontend && rm -rf dist && VITE_BACKEND_URL=http://localhost:8198 npm run build >$Q/out/mut389-$id.build 2>&1; echo "$id build=$?"; rm -rf $Q/dist-mut; mv dist $Q/dist-mut
   node --test test/es-357-plan-heredado.test.mjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; echo " <- unit $id")
  bash qa/qa5-run.sh qa5-389.cjs mut qa5_b ONLY=F1,F2,F4 2>&1 | grep -E "^FALLA|RESUMEN" | cut -c1-170 | sed "s/^/$id e2e: /" | head -6
  git -C $Q/pr389 checkout -q -- frontend/src
done
