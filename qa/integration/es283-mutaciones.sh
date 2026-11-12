#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-221; B=$SUT/backend; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres; V=/c/Users/Usuario/Documents/qa13/v249; mkdir -p $V
cd $B
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done; export DATA_RIGHTS_ENABLED=true
res() { grep -E '^# fail' | tr -d '\n#'; }
one() { # id script
  git checkout -q -- . 
  if node /c/Users/Usuario/Documents/qa13/$2 $1 > $V/m.$1.apply 2>&1; then
    a=$(timeout 200 node --test test/integration/es-283-postgres.cjs 2>&1 | tee $V/m.$1.283.log | res)
    b=$(timeout 200 node --test test/integration/es-274-postgres.cjs 2>&1 | res)
    f=$(grep -E "^\s+not ok [0-9]+ - " $V/m.$1.283.log | sed -E 's/^\s+not ok ([0-9]+) - (.{0,48}).*/#\1 \2/' | head -2 | tr '\n' ';')
    echo "$1 | es-283:$a | es-274:$b | $f"
  else echo "$1 | NO APLICADA: $(cat $V/m.$1.apply | head -1)"; fi
  git checkout -q -- .
}
for m in a b c d e f g h; do one $m mut235.cjs; done
for m in r0 r1 r2 r3 r4 r5 r6 r7 r8 r9 s1 s2 s3 s4 s5 s6 s7 p1; do one $m mut249.cjs; done
git status --short | head -2; echo FIN
