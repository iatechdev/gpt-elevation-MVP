#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres; V=/c/Users/Usuario/Documents/qa13/v262
cd $B; git checkout -q -- .; git rev-parse HEAD
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
for f in es-175-postgres es-23-postgres es-117-postgres es-280-postgres es-281-postgres es-233-postgres es-296-postgres es-229-postgres es-integration-consent-hooks; do [ -f test/integration/$f.cjs ] && echo "$f: $(node --test test/integration/$f.cjs 2>&1 | grep -E '^# (pass|fail|skipped)' | tr '\n' ' ')" || echo "$f: no existe"; done
echo "backend: $(npm test 2>&1 | grep -E '^# (pass|fail|skipped)' | tr '\n' ' ')"
echo "drift:"; DATABASE_URL=$U DB_SSL=false npm run db:drift 2>&1 | tail -3 | cut -c1-200
echo "audit:"; npm audit --omit=dev 2>&1 | tail -4 | cut -c1-200
git status --short | head -2; echo FIN
