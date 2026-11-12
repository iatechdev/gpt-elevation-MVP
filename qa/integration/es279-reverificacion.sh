#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-250; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v250r; mkdir -p $V
U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B; git checkout -q -- .
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done; export DATA_RIGHTS_ENABLED=true
run() { st=$(date +%s); eval "$2" > $V/$1.log 2>&1; echo "$1 | exit=$? | $(grep -E '^# (pass|fail|skipped)' $V/$1.log | tr '\n' ' ') | $(( $(date +%s)-st ))s"; }
for i in 1 2 3; do run es279.$i "node --test test/integration/es-279-postgres.cjs"; done
run es283 "node --test test/integration/es-283-postgres.cjs"
run es281 "node --test test/integration/es-281-postgres.cjs"
run es282static "node --test test/es-282-static.test.cjs"
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa && TAG=$1 QA_SUT=$SUT QA_OUT=$V QA250_DB=$U timeout 500 node qa/integration/es279-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL|"ok":false' | cut -c1-230); }
echo "--- mi guion sobre la cabeza limpia:"; mine pr
for m in M2 E2; do
  git checkout -q -- .
  node /c/Users/Usuario/Documents/qa13/mut250c.cjs $m > $V/m.$m.apply 2>&1 || { echo "$m NO APLICADA: $(head -1 $V/m.$m.apply)"; continue; }
  for i in 1 2 3; do echo "$m es-279 run$i: $(timeout 150 node --test test/integration/es-279-postgres.cjs 2>&1 | tee $V/m.$m.279.$i.log | grep -E '^# fail' | tr -d '\n#') | $(grep -E '^\s+not ok [0-9]+ - ' $V/m.$m.279.$i.log | sed -E 's/^\s+not ok ([0-9]+) - (.{0,40}).*/#\1 \2/' | head -2 | tr '\n' ';')"; done
  echo "$m mi guion:"; mine m$m
  git checkout -q -- .
done
git status --short | head -2; echo FIN
