#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v267; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B; git checkout -q -- .
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa && QA_FAST=1 TAG=m QA_SUT=$SUT QA_OUT=$V QA298_DB=$U timeout 900 node qa/integration/es298-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL|"ok":false' | sed -E 's/.*"id":"(C[0-9a-z\/]+) .*"ok":false.*/FALLA \1/' | cut -c1-40 | tr '\n' ' '); }
echo "base | es-298: $(node --test test/es-298-crisis-history.test.cjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ') | es-281: $(node --test test/integration/es-281-postgres.cjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ')"
for m in Q1 Q2 Q3 Q4 Q5 Q6 Q7 Q8; do
  git checkout -q -- .
  if node /c/Users/Usuario/Documents/qa13/mut267.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(node --test test/es-298-crisis-history.test.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n'); b=$(timeout 600 node --test test/integration/es-281-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n')
    echo "$m | es-298 del PR:$a | es-281 PG:$b | mi guion: $(mine)"
  else echo "$m | NO APLICADA: $(grep -m1 Error $V/m.$m.apply | cut -c1-120)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
