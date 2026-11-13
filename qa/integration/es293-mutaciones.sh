#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v270; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B; git checkout -q -- .
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa && TAG=m QA_SUT=$SUT QA_OUT=$V QA293_DB=$U timeout 900 node qa/integration/es293-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL|"ok":false' | sed -E 's/.*"id":"(M[0-9a-z]+) .*"ok":false.*/FALLA \1/' | cut -c1-40 | tr '\n' ' '); }
echo "base | es-293: $(node --test test/integration/es-293-postgres.cjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ') | mi guion: $(mine)"
for m in R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14; do
  git checkout -q -- .
  if node /c/Users/Usuario/Documents/qa13/mut270.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 600 node --test test/integration/es-293-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n'); echo "$m | es-293 del PR:$a | mi guion: $(mine)"
  else echo "$m | NO APLICADA: $(grep -m1 Error $V/m.$m.apply | cut -c1-120)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
