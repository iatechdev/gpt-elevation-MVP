#!/bin/bash
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; HERE=$(cd "$(dirname "$0")/.." && pwd); cd $HERE
export QA_SRC=$Q/pr391/frontend/src/context/resume/resumeDiff.ts QA_SERVER=$Q/pr391/backend/utils/resumeSkills.js
for id in "$@"; do
  git -C $Q/pr391 checkout -q -- frontend/src; node qa/qa5-mut391.cjs $id || continue
  dev=$(cd $Q/pr391/frontend && node --test test/es-110-actualizar-diferencia.test.mjs 2>&1 | grep -E "^# fail" | tr -d '\n')
  mine=$(node --experimental-strip-types --no-warnings qa/qa5-391.mjs 2>&1 | grep -E "^FALLA|^RESUMEN|ABORTA|Error" | cut -c1-110 | head -3 | tr '\n' '|')
  echo "$id | suite Dev: $dev | mi suite: $mine"
  git -C $Q/pr391 checkout -q -- frontend/src
done
