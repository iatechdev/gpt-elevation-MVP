#!/bin/bash
# [QA-Claude-5] Backend de main contra MI Postgres (54361) en el puerto 8198, base nueva. Claves sintéticas aleatorias. 0 IA.
export PATH="$QA_TOOLS/node22:$PATH"; Q=$QA_TOOLS/qa5; DBN=${1:-qa5_run}; PW=$(cat $Q/pw.txt)
cd ${BDIR:-$Q/main/backend}
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgres://qa5:$PW@127.0.0.1:54361/postgres'});await c.connect();await c.query('DROP DATABASE IF EXISTS $DBN WITH (FORCE)');await c.query('CREATE DATABASE $DBN');await c.end()})()" || exit 1
export DATABASE_URL="postgres://qa5:$PW@127.0.0.1:54361/$DBN" DB_SSL=false PORT=8198 FRONTEND_URL=http://localhost:5278 NODE_ENV=development ALLOW_SYNTHETIC_CATALOG=true REGISTER_RATE_LIMIT_MAX=5000 LOGIN_RATE_LIMIT_MAX=5000 PLANS_CACHE_TTL_MS=0
export PROMPT_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" DATA_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
node server.js > "$Q/be-$DBN.log" 2>&1 &
echo $! > $Q/be.pid; for i in $(seq 1 40); do sleep 1; curl -s localhost:8198/api/health >/dev/null && { echo "backend listo ($DBN)"; exit 0; }; done; echo "backend NO arrancó"; tail -n 20 "$Q/be-$DBN.log"; exit 1
