#!/bin/bash
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE; PW=$(cat $Q/pw.txt); U="postgres://qa5:$PW@127.0.0.1:54361/postgres"
for id in "$@"; do git -C $Q/m396 checkout -q -- backend; node qa/qa5-mut396.cjs $id || continue
  d=$(cd $Q/m396/backend && ES303_TEST_DATABASE_URL="$U" node --test test/integration/es-303-postgres.cjs 2>&1 | grep -E "^# fail" | tr -d '\n'); m=$(QA_BACKEND=$Q/m396/backend QA_396_DB="$U" node --test qa/qa5-396.cjs 2>&1 | grep -E "^# (FALLA|RESUMEN)" | cut -c1-110 | head -3 | tr '\n' '|')
  echo "$id Dev: $d | mi suite: $m"; git -C $Q/m396 checkout -q -- backend; done
