#!/bin/bash
# aplica cada mutación, construye a dist-mut, corre los casos del E2E y las pruebas unitarias dirigidas, revierte
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE
for id in "$@"; do
  git -C $Q/pr392 checkout -q -- frontend/src; node qa/qa5-mut392.cjs $id || continue
  (cd $Q/pr392/frontend && rm -rf dist && VITE_BACKEND_URL=http://localhost:8198 npm run build >$Q/out/mut392-$id.build 2>&1; echo "$id build=$?"; rm -rf $Q/dist-mut; mv dist $Q/dist-mut
   node --test test/es-359-sesion-abierta.test.mjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; echo " <- unit $id")
  cp -r $Q/dist-mut $Q/dist-mut-$id 2>/dev/null; rm -rf $Q/dist-mut-$id
  QA_DISTNAME=mut bash qa/qa5-run.sh qa5-392.cjs mut qa5_a ONLY=C1,C2,C3,C4 2>&1 | grep -E "^FALLA|FALLA \[|RESUMEN" | cut -c1-200 | sed "s/^/$id e2e: /"
  git -C $Q/pr392 checkout -q -- frontend/src
done
