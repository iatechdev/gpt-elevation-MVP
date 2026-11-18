#!/bin/bash
# [QA-Claude-3] Arranca el backend del worktree contra un Postgres local desechable (base nueva) en el puerto 8190. Claves sintéticas aleatorias por arranque. 0 IA (sin clave de Anthropic).
# Uso: qa/start-backend.sh <nombre_base> ; deja el PID en $QA3_DIR/be.pid y el log en $QA3_DIR/be-<base>.log
export PATH="/c/Users/Usuario/tools/node22:$PATH"; Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; DBN=${1:-qa3_run}; PGPORT=${PGPORT_QA3:-54341}
cd "$(git rev-parse --show-toplevel)/backend"
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgres://elevation:elevation_local@127.0.0.1:$PGPORT/postgres'});await c.connect();await c.query('DROP DATABASE IF EXISTS $DBN');await c.query('CREATE DATABASE $DBN');await c.end()})()" || exit 1
export DATABASE_URL="postgres://elevation:elevation_local@127.0.0.1:$PGPORT/$DBN" DB_SSL=false PORT=8190 FRONTEND_URL=http://localhost:5273 NODE_ENV=development ALLOW_SYNTHETIC_CATALOG=true REGISTER_RATE_LIMIT_MAX=5000 LOGIN_RATE_LIMIT_MAX=5000
export JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" DATA_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
node server.js > "$Q/be-$DBN.log" 2>&1 &
echo $! > "$Q/be.pid"; for i in $(seq 1 40); do sleep 1; curl -s localhost:8190/api/health >/dev/null && { echo "backend listo ($DBN)"; exit 0; }; done; echo "backend NO arrancó"; tail -n 20 "$Q/be-$DBN.log"; exit 1
