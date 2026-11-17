#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
B=/c/Users/Usuario/Documents/qa-pr-253/backend; S=/c/Users/Usuario/Documents/qa13
cd $B; export NODE_PATH=$B/node_modules
pgt() { node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgres://elevation:elevation_local@127.0.0.1:54459/postgres'});await c.connect();await c.query('DROP DATABASE IF EXISTS q325_mut WITH (FORCE)');await c.query('CREATE DATABASE q325_mut');await c.end()})()"; ES173_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54459/q325_mut JWT_SECRET=x DATA_ENCRYPTION_KEY=$(cat $S/dek) timeout 300 node --test test/integration/es-173-postgres.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { (cd $S && bash run325.sh mq$RANDOM contract,bands,utility 2>&1 | grep -E "RESUMEN|^FALLA" | cut -c1-170 | head -3); }
run_mut() { name="$1"; from="$2"; to="$3"; echo "== $name"
  node $S/mutapply.cjs "$B/utils/pilotFeedback.js" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- .; return; }
  echo "  PG es-173 (prueba del PR): $(pgt)"; echo "  mi guion (contract,bands,utility):"; mine; git checkout -q -- . ; }
echo "== base"; echo "  PG es-173 (prueba del PR): $(pgt)"
run_mut "m1 sin supresión con positive = 0" "positive > 0 && positive < responded" "positive < responded"
run_mut "m2 sin supresión con positive = responded" "&& positive > 0 && positive < responded" "&& positive > 0"
run_mut "m3 BAND = 1 (conteo exacto)" "const BAND = 5;" "const BAND = 1;"
run_mut "m4 vuelve «missing»" "positive: band(positive) } }" "positive: band(positive), missing: eligible - responded } }"
run_mut "m5 redondeo en vez de suelo" "const band = (n) => ({ min: Math.floor(n / BAND) * BAND, max: Math.floor(n / BAND) * BAND + BAND - 1 });" "const band = (n) => ({ min: Math.round(n / BAND) * BAND, max: Math.round(n / BAND) * BAND + BAND - 1 });"
run_mut "m6 umbral de personas 5 → 3" "const MIN_PEOPLE = 5;" "const MIN_PEOPLE = 3;"
git status --short | grep -v node_modules | head -3; echo fin
