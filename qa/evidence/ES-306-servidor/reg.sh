#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
cd /c/Users/Usuario/Documents/qa-pr-253/backend; git checkout -q -- .
U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres; for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
export DATA_RIGHTS_ENABLED=true
echo "npm test: $(npm test 2>&1 | grep -E '^# (tests|pass|fail|skipped)' | tr '\n' ' ')"
n=0; bad=0; for s in $(grep -oE "npm run test:[a-z0-9:-]+:pg\b" ../.github/workflows/ci.yml | awk '{print $3}' | sort -u); do n=$((n+1)); out=$(timeout 400 npm run $s 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' '); case "$out" in *"# fail 0"*) ;; *) bad=$((bad+1)); echo "NO VERDE $s: $out";; esac; done
echo "suites *:pg del CI: $n, no verdes: $bad"
echo "db:drift: $(timeout 300 npm run db:drift 2>&1 | tail -2 | tr '\n' ' ')"
echo "audit: $(npm audit --omit=dev 2>&1 | tail -3 | tr '\n' ' ')"
git status --short | head -2; echo FIN
