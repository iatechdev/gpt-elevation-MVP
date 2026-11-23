#!/bin/bash
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE; PW=$(cat $Q/pw.txt)
for id in "$@"; do
  git -C $Q/mut checkout -q -- backend; node qa/qa5-mut388.cjs $id || continue
  kill $(cat $Q/be.pid) 2>/dev/null; sleep 1; BDIR=$Q/mut/backend bash qa/qa5-backend.sh qa5_m >/dev/null
  (cd $Q/mut/backend && ES279_TEST_DATABASE_URL="postgres://qa5:$PW@127.0.0.1:54361/postgres" node --test test/integration/es-279-postgres.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; echo " <- es-279-postgres $id")
  bash qa/qa5-run.sh qa5-388.cjs pr388 qa5_m ONLY=B1,B2,B4 2>&1 | grep -E "^FALLA|RESUMEN" | cut -c1-200 | sed "s/^/$id guion: /" | head -4
  git -C $Q/mut checkout -q -- backend
done
kill $(cat $Q/be.pid) 2>/dev/null
