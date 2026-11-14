#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v278; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
export DATA_RIGHTS_ENABLED=true ES306_TEST_DATABASE_URL=$U
cd $B; git checkout -q -- .
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa && QA_RACE=16 TAG=m QA_SUT=$SUT QA_OUT=$V QA306_DB=$U timeout 800 node qa/integration/es306-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL' | cut -c1-90 | tr '\n' ' '); }
echo "base | es-306 PR: $(timeout 900 node --test test/integration/es-306-postgres.cjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ') | mi guion: $(mine)"
for m in ${MUTS:-Z1 Z2 Z3 Z4 Z5 Z6 Z7 Z8 Z9 Z10 Z11 Z12 Z13 Z14 Z15 Z16 Z17 Z18 Z19 Z20 Z21 Z22 Z23 Z24}; do
  git checkout -q -- .
  if node $V/mut278.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 900 node --test test/integration/es-306-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n'); echo "$m | es-306 del PR:$a | mi guion: $(mine)"
  else echo "$m | NO APLICADA: $(grep -m1 Error $V/m.$m.apply | cut -c1-140)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
