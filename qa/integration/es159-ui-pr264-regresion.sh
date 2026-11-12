#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"; export PLAYWRIGHT_BROWSERS_PATH=C:/Users/Usuario/tools/pw-browsers
SUT=/c/Users/Usuario/Documents/qa-pr-221; F=$SUT/frontend; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v264; U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
AX=C:/Users/Usuario/tools/playwright/node_modules/axe-core/axe.min.js; PW=C:/Users/Usuario/tools/playwright/node_modules/playwright
cd $SUT; git checkout -q -- .; git rev-parse HEAD; cd $F
echo "frontend: $(npm test 2>&1 | grep -E '^# (tests|pass|fail)' | tr '\n' ' ')"; npx tsc -b > $V/tsc.log 2>&1; echo "tsc=$?"; npx eslint src --quiet > $V/eslint.log 2>&1; echo "eslint=$?"; npx vite build > $V/build.log 2>&1; echo "build=$?"; npm run build:check 2>&1 | tail -3 | cut -c1-160
node $V/serve.cjs $F/dist 4297 & S=$!; sleep 1; echo "es159-check: $(ES159_URL=http://127.0.0.1:4297 PLAYWRIGHT_MODULE=$PW AXE_PATH=$AX node scripts/es159-check.cjs 2>&1 | tail -2 | tr '\n' ' ')"; kill $S
echo "es159-api-integration: $(ES159_BACKEND_DIR=$B node scripts/es159-api-integration.cjs 2>&1 | tail -2 | tr '\n' ' ')"
cd $B; for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
echo "backend: $(npm test 2>&1 | grep -E '^# (pass|fail|skipped)' | tr '\n' ' ')"
git status --short | head -2; echo FIN
