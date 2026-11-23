#!/bin/bash
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE; PW=$(cat $Q/pw.txt)
export QA_PG="postgres://qa5:$PW@127.0.0.1:54361/postgres" ES288_TEST_DATABASE_URL="postgres://qa5:$PW@127.0.0.1:54361/postgres"
for id in "$@"; do git -C $Q/m385 checkout -q -- backend; node qa/qa5-mut385.cjs $id || continue
  d=$(cd $Q/m385/backend && node --test test/integration/es-288-postgres.cjs 2>&1 | grep -E "^# fail" | tr -d '\n')
  m=$(QA_BACKEND=$Q/m385/backend node qa/qa5-385.cjs 2>&1 | grep -E "^FALLA|^RESUMEN|ABORTA" | cut -c1-90 | head -3 | tr '\n' '|')
  echo "$id Dev: $d | mi script: $m"; git -C $Q/m385 checkout -q -- backend; done
