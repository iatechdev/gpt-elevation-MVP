#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v253b; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B; git checkout -q -- .
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
QA=/c/Users/Usuario/Documents/gpt-elevation-qa
mine() { a=$(cd $QA && TAG=m QA_ROUNDS=10 QA_SUT=$SUT QA_OUT=$V QA253_DB=$U timeout 400 node qa/integration/es233-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL' | cut -c1-40 | tr -d '\n'); b=$(cd $QA && TAG=m QA_ROUNDS=10 QA_SUT=$SUT QA_OUT=$V QA253_DB=$U timeout 400 node qa/integration/es233-evidencia.cjs 2>&1 | grep -E 'RESUMEN|FATAL' | cut -c1-40 | tr -d '\n'); echo "propios ${a:-sin salida} / evidencia ${b:-sin salida}"; }
echo "base | es-233: $(node --test test/integration/es-233-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '\n#') | $(mine)"
for m in M1 M2 M3 M4 M5 M6 M7 M8 M8b M10 R1 E1 E2 E3 E4; do
  git checkout -q -- .
  if node /c/Users/Usuario/Documents/qa13/mut253b.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 150 node --test test/integration/es-233-postgres.cjs 2>&1 | tee $V/m.$m.233.log | grep -E '^# fail' | tr -d '\n#')
    f=$(grep -E "^\s+not ok [0-9]+ - " $V/m.$m.233.log | sed -E 's/^\s+not ok ([0-9]+) - (.{0,36}).*/#\1 \2/' | head -2 | tr '\n' ';')
    echo "$m | es-233 del PR:$a $f| $(mine)"
  else echo "$m | NO APLICADA: $(head -1 $V/m.$m.apply)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
