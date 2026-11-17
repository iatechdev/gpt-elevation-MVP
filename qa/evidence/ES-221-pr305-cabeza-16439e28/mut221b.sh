#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
B=/c/Users/Usuario/Documents/qa-pr-253/backend; S=/c/Users/Usuario/Documents/qa13
cd $B; export NODE_PATH=$B/node_modules
unit() { node --test test/es-221-hashgate.test.cjs test/es-221-limite.test.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
pgt() { node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgres://elevation:elevation_local@127.0.0.1:54459/postgres'});await c.connect();await c.query('DROP DATABASE IF EXISTS q221_mut WITH (FORCE)');await c.query('CREATE DATABASE q221_mut');await c.end()})()"; ES221_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54459/q221_mut JWT_SECRET=x DATA_ENCRYPTION_KEY=$(cat $S/dek) timeout 240 node --test test/integration/es-221-postgres.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { (cd $S && TMO=150 bash run221.sh mb$RANDOM pr "$1" "$2" 30 none 2>&1 | grep -E "rc=|RESUMEN|^FALLA" | cut -c1-150 | head -3); }
run_mut() { name="$1"; file="$2"; from="$3"; to="$4"; cases="$5"; senv="$6"; echo "== $name"
  node $S/mutapply.cjs "$file" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- .; return; }
  echo "  unit: $(unit)"; echo "  PG es-221: $(pgt)"; echo "  mi guion ($cases):"; mine "$cases" "$senv"; git checkout -q -- . ; }
G=utils/hashGate.js; A=routes/auth.js
echo "== base"; echo "  unit: $(unit)"
run_mut "g1 el cupo no se libera" $G "try { return await fn(); } finally { release(); }" "return await fn();" "timing" "REGISTER_RATE_LIMIT_MAX=100000"
run_mut "g2 cola sin tope" $G "else if (waiting.length >= limit) throw new ServerBusyError();" "" "busy" "TRUST_PROXY_HOPS=1"
BURST=new run_mut "g3 concurrencia 1000 (sin acotar)" $G "const size = Number.isSafeInteger(max) && max > 0 ? max : DEFAULT_MAX;" "const size = 1000;" "perf" "REGISTER_RATE_LIMIT_MAX=100000"
run_mut "g4 el rechazo por cola llena responde 500" $A "if (error instanceof ServerBusyError) return res.status(503).json({ code: error.code, error: error.message });" "" "busy" "TRUST_PROXY_HOPS=1"
run_mut "g5 el hash sale del semáforo" $A "await hashGate.run(() => bcrypt.hash(password, 10))" "await bcrypt.hash(password, 10)" "perf" "REGISTER_RATE_LIMIT_MAX=100000"
run_mut "g6 cola por defecto 100 (E305-6 deshecho)" $G "const DEFAULT_QUEUE = 20;" "const DEFAULT_QUEUE = 100;" "busy" "TRUST_PROXY_HOPS=1"
git status --short | grep -v node_modules | head -3; echo fin
