#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-221; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v253; mkdir -p $V
U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B; git checkout -q -- .
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done; export DATA_RIGHTS_ENABLED=true
run() { st=$(date +%s); eval "$2" > $V/$1.log 2>&1; echo "$1 | exit=$? | $(grep -E '^# (pass|fail|skipped)' $V/$1.log | tr '\n' ' ') | $(( $(date +%s)-st ))s"; }
for i in 1 2 3; do run es233.$i "node --test test/integration/es-233-postgres.cjs"; done
for n in es-229-postgres es-integration-consent-hooks es-23-postgres es-86-postgres es-88-postgres es-89-postgres; do f=test/integration/$n.cjs; [ -f $f ] && run $n "node --test $f"; done
run es25 "node --test test/es-25-bridge.test.cjs"
run es121 "node --test test/es-121-insights.test.cjs test/es-121-resume.test.cjs"
run npmtest "npm test"
echo "--- mutaciones (es-233 del PR | mi guion con 10 rondas: 17/20 es la línea base; menos = detectada)"
for m in M1 M2 M3 M4 M5 M6 M7 M8 M9 M10; do
  git checkout -q -- .
  if node /c/Users/Usuario/Documents/qa13/mut253.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 120 node --test test/integration/es-233-postgres.cjs 2>&1 | tee $V/m.$m.233.log | grep -E '^# fail' | tr -d '\n#')
    f=$(grep -E "^\s+not ok [0-9]+ - " $V/m.$m.233.log | sed -E 's/^\s+not ok ([0-9]+) - (.{0,40}).*/#\1 \2/' | head -2 | tr '\n' ';')
    c=$(cd /c/Users/Usuario/Documents/gpt-elevation-qa && TAG=m QA_ROUNDS=10 QA_SUT=$SUT QA_OUT=$V QA253_DB=$U timeout 400 node qa/integration/es233-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL' | cut -c1-50 | tr -d '\n')
    echo "$m | es-233 del PR:$a | mi guion: $c | $f"
  else echo "$m | NO APLICADA: $(head -1 $V/m.$m.apply)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
