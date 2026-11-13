#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"; export DATA_RIGHTS_ENABLED=true
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v257; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B; git checkout -q -- .
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa && TAG=m QA_ROUNDS=6 QA_OUT=$V QA296_DB=$U timeout 600 node qa/integration/es296-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL|"ok":false' | sed -E 's/.*"id":"(F[0-9a-z\/]+) .*"ok":false.*/FALLA \1/' | cut -c1-60 | tr '\n' ' '); }
echo "base | es-296: $(node --test test/integration/es-296-postgres.cjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ')"
for m in N1; do
  git checkout -q -- .
  if node /c/Users/Usuario/Documents/qa13/mut257.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 400 node --test test/integration/es-296-postgres.cjs 2>&1 | tee $V/m.$m.296.log | grep -E '^# fail' | tr -d '\n#')
    f=$(grep -E "^\s+not ok [0-9]+ - " $V/m.$m.296.log | sed -E 's/^\s+not ok ([0-9]+) - (.{0,40}).*/#\1 \2/' | head -2 | tr '\n' ';')
    echo "$m | es-296 del PR:$a $f| mi guion: $(mine)"
  else echo "$m | NO APLICADA: $(head -1 $V/m.$m.apply)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
