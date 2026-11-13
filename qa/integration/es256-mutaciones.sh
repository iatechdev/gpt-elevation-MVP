#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-221; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v256; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B; git checkout -q -- .
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
mine() { (cd /c/Users/Usuario/Documents/gpt-elevation-qa && TAG=m QA_ROUNDS=3 QA_SUT=$SUT QA_OUT=$V QA256_DB=$U timeout 600 node --expose-gc qa/integration/es256-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL|"ok":false' | sed -E 's/.*"id":"(C[0-9a-z]+) .*"ok":false.*/FALLA \1/' | cut -c1-80 | tr '\n' ' '); }
echo "base | es-29: $(node --test test/integration/es-29-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '\n#') | mi guion: $(mine)"
for m in M1 M2 M3 M4 M5 M6; do
  git checkout -q -- .
  if node /c/Users/Usuario/Documents/qa13/mut256.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 200 node --test test/integration/es-29-postgres.cjs 2>&1 | tee $V/m.$m.29.log | grep -E '^# fail' | tr -d '\n#')
    f=$(grep -E "^\s+not ok [0-9]+ - " $V/m.$m.29.log | sed -E 's/^\s+not ok ([0-9]+) - (.{0,40}).*/#\1 \2/' | head -2 | tr '\n' ';')
    echo "$m | es-29 del PR:$a $f| mi guion: $(mine)"
  else echo "$m | NO APLICADA: $(head -1 $V/m.$m.apply)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
