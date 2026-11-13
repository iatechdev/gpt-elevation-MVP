#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v273; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B; git checkout -q -- .
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa && QA_FAST=1 TAG=m QA_ROUNDS=4 QA_SUT=$SUT QA_OUT=$V QA173_DB=$U timeout 900 node qa/integration/es173-servidor-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL|"ok":false' | sed -E 's/.*"id":"(F[0-9]+[a-z]?[\/0-9]*) .*"ok":false.*/FALLA \1/' | cut -c1-30 | tr '\n' ' '); }
echo "base | es-173: $(node --test test/integration/es-173-postgres.cjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ') | mi guion: $(mine)"
for m in T2 T15; do
  git checkout -q -- .
  if node /c/Users/Usuario/Documents/qa13/mut273.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 600 node --test test/integration/es-173-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n'); echo "$m | es-173 del PR:$a | mi guion: $(mine)"
  else echo "$m | NO APLICADA: $(grep -m1 Error $V/m.$m.apply | cut -c1-120)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
