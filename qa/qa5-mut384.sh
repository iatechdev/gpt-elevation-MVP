#!/bin/bash
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE; PW=$(cat $Q/pw.txt); export QA_PG="postgres://qa5:$PW@127.0.0.1:54361/postgres"
for id in "$@"; do git -C $Q/m384 checkout -q -- backend; node qa/qa5-mut384.cjs $id || continue
  d=$(cd $Q/m384/backend && node --test test/es-287-tags.test.cjs 2>&1 | grep -E "^# fail" | tr -d '\n'); m=$(QA_BACKEND=$Q/m384/backend node qa/qa5-384.cjs 2>&1 | grep -E "^FALLA|^RESUMEN|ABORTA" | cut -c1-100 | head -3 | tr '\n' '|'); echo "$id Dev: $d | mi script: $m"; git -C $Q/m384 checkout -q -- backend; done
