#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v262; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B; git checkout -q -- .
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa && QA_FAST=1 TAG=m QA_ROUNDS=6 QA_SUT=$SUT QA_OUT=$V QA175_DB=$U timeout 900 node qa/integration/es175-servidor-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL|"ok":false' | sed -E 's/.*"id":"(S[0-9a-z]+) .*"ok":false.*/FALLA \1/' | cut -c1-60 | tr '\n' ' '); }
for m in P1 P2 P3 P4 N5 N23 N19 N20; do
  git checkout -q -- .
  if node /c/Users/Usuario/Documents/qa13/mut262.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 600 node --test test/integration/es-175-postgres.cjs 2>&1 | tee $V/m.$m.175.log | grep -E '^# fail' | tr -d '\n#')
    f=$(grep -E "^\s+not ok [0-9]+ - " $V/m.$m.175.log | sed -E 's/^\s+not ok ([0-9]+) - (.{0,30}).*/#\1 \2/' | head -2 | tr '\n' ';')
    echo "$m | es-175 del PR:$a $f| mi guion: $(mine)"
  else echo "$m | NO APLICADA: $(grep -m1 Error $V/m.$m.apply | cut -c1-120)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
