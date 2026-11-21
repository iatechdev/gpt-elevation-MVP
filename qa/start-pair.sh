#!/bin/bash
# [QA-Claude-3] Dos instancias del backend (8190 con reloj +SKEW_A ms, 8191 con reloj +SKEW_B ms) sobre la MISMA base y los mismos secretos. Uso: qa/start-pair.sh <base> [SKEW_A SKEW_B]
export PATH="/c/Users/Usuario/tools/node22:$PATH"; Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; DBN=${1:-qa3_pair}; SA=${2:-600000}; SB=${3:--600000}; PGPORT=54341
ROOT="$(git rev-parse --show-toplevel)"; cd "${BACKEND_DIR:-$Q/wt/backend}"
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgres://elevation:elevation_local@127.0.0.1:$PGPORT/postgres'});await c.connect();await c.query('DROP DATABASE IF EXISTS $DBN WITH (FORCE)');await c.query('CREATE DATABASE $DBN');await c.end()})()" || exit 1
export DATABASE_URL="postgres://elevation:elevation_local@127.0.0.1:$PGPORT/$DBN" DB_SSL=false FRONTEND_URL=http://localhost:5273 NODE_ENV=development ALLOW_SYNTHETIC_CATALOG=true REGISTER_RATE_LIMIT_MAX=5000 LOGIN_RATE_LIMIT_MAX=5000 PLANS_CACHE_TTL_MS=0
export PROMPT_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" DATA_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
printf %s "$JWT_SECRET" > "$Q/jwt.secret"
PORT=8190 SKEW_MS=$SA NODE_OPTIONS="--require $ROOT/qa/skew.cjs" node server.js > "$Q/be-A.log" 2>&1 & echo $! > "$Q/beA.pid"
for i in $(seq 1 40); do sleep 1; curl -s localhost:8190/api/health >/dev/null && break; done
PORT=8191 SKEW_MS=$SB NODE_OPTIONS="--require $ROOT/qa/skew.cjs" node server.js > "$Q/be-B.log" 2>&1 & echo $! > "$Q/beB.pid"
for i in $(seq 1 40); do sleep 1; curl -s localhost:8191/api/health >/dev/null && { echo "pareja lista ($DBN) A=$SA B=$SB"; exit 0; }; done; echo "NO arrancó"; tail -n 15 "$Q/be-B.log"; exit 1
