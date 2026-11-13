#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-221; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v250; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
for m in M1 M2 M3 M4 M5 M6 M7 M8 M10; do
  git checkout -q -- .
  if node /c/Users/Usuario/Documents/qa13/mut250.cjs $m > $V/m.$m.apply 2>&1; then
    a=$(timeout 120 node --test test/integration/es-279-postgres.cjs 2>&1 | tee $V/m.$m.279.log | grep -E '^# fail' | tr -d '\n#')
    f=$(grep -E "^\s+not ok [0-9]+ - " $V/m.$m.279.log | sed -E 's/^\s+not ok ([0-9]+) - (.{0,46}).*/#\1 \2/' | head -2 | tr '\n' ';')
    c=$(cd /c/Users/Usuario/Documents/gpt-elevation-qa && TAG=m QA_SUT=$SUT QA_OUT=$V QA250_DB=$U timeout 200 node qa/integration/es279-propios.cjs 2>&1 | grep -E 'RESUMEN|FATAL' | cut -c1-60 | tr -d '\n')
    e=""; if [ $m = M6 ]; then e=" | es-281: $(ES281_SKIP_HOSTILE=1 timeout 200 node --test test/integration/es-281-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '\n#')"; fi
    echo "$m | es-279 del PR:$a | mi guion: $c$e | $f"
  else echo "$m | NO APLICADA: $(head -1 $V/m.$m.apply)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
