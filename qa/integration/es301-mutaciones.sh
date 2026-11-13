#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v277; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
export DATA_RIGHTS_ENABLED=true ES301_TEST_DATABASE_URL=$U
cd $B; git checkout -q -- .
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa && QA_RACE=16 TAG=m QA_SUT=$SUT QA_OUT=$V QA301_DB=$U timeout 600 node qa/integration/es301-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL' | cut -c1-80 | tr '\n' ' '); }
echo "base | es-301 PR: $(timeout 900 node --test test/integration/es-301-postgres.cjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ') | mi guion: $(mine)"
for m in ${MUTS:-Y1 Y2 Y3 Y4 Y5 Y6 Y7 Y8 Y9 Y10 Y11 Y12 Y13 Y14 Y15 Y16 Y17 Y18}; do
  git checkout -q -- .
  if node $V/mut277.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 900 node --test test/integration/es-301-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n'); echo "$m | es-301 del PR:$a | mi guion: $(mine)"
  else echo "$m | NO APLICADA: $(grep -m1 Error $V/m.$m.apply | cut -c1-140)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
