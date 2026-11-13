#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
V=/c/Users/Usuario/Documents/qa13/v256; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
echo "carga: 16 procesos de CPU"; pids=""; for i in $(seq 1 16); do node -e "const e=Date.now()+900000;while(Date.now()<e){}" & pids="$pids $!"; done
sleep 2
loop() { # nombre carpeta n
  cd $2/backend; for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
  ok=0; ko=0; det=""; for i in $(seq 1 $3); do r=$(node --test test/integration/es-29-postgres.cjs 2>&1 | tee $V/es29.$1.$i.log | grep -E '^# fail' | tr -d '\n# fail '); if [ "$r" = "0" ]; then ok=$((ok+1)); else ko=$((ko+1)); det="$det $i"; fi; done
  echo "$1: $ok verdes, $ko con fallos (corridas:$det) de $3 con 16 procesos de carga"
}
loop PR /c/Users/Usuario/Documents/qa-pr-221 20
loop main /c/Users/Usuario/Documents/qa-main-256 20
kill $pids 2>/dev/null; sleep 1
echo "--- sin carga (3 corridas, PR)"; cd /c/Users/Usuario/Documents/qa-pr-221/backend; for i in 1 2 3; do echo "sin carga $i: $(node --test test/integration/es-29-postgres.cjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ')"; done
echo FIN
