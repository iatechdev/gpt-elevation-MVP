#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13; Q=/c/Users/Usuario/Documents/gpt-elevation-qa
U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
export QA_SUT=C:/Users/Usuario/Documents/qa-pr-253 QA306S_DB=$U QA_OUT=C:/Users/Usuario/Documents/qa13 ES306_TEST_DATABASE_URL=$U DATA_RIGHTS_ENABLED=true
cd $B; git checkout -q -- migrations scripts test
mine() { (cd $Q && timeout 300 node qa/integration/es306-seguimientos.cjs 2>&1 | grep -E 'RESUMEN|FATAL' | cut -c1-170); }
pr() { timeout 400 node --test test/integration/es-306-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n'; }
echo "base | PR es-306 PG:$(pr) | mi guion: $(mine)"
for m in ${MUTS:-Z1 Z2 Z3 Z4 Z5 Z6 Z7 Z8 Z9 Z10 Z11 Z12 Z13 Z14}; do
  git checkout -q -- migrations scripts test
  if node $V/mut306s.cjs $m > $V/m306.$m.apply 2>&1; then echo "$m | PR es-306 PG:$(pr) | mi guion: $(mine)"; else echo "$m | NO APLICADA: $(grep -m1 Error $V/m306.$m.apply | cut -c1-140)"; fi
  git checkout -q -- migrations scripts test
done
git status --short | grep -v dist | head -2; echo FIN
