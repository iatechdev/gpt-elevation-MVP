#!/bin/bash
# QA-Claude-2 — ES-134/ES-135: levanta (o reinicia) backend + vite del worktree t2 con base local desechable y proveedor de IA SIMULADO.
# Uso: es134-up.sh <db> <tokens_por_persona> [tokens_cohorte] [data_rights: true|false]
# Solo loopback y Postgres local (puerto 54331). Claves sintéticas aleatorias por arranque. NO toca staging ni producción.
DB=$1; PER=${2:-20000}; COH=$3; DR=${4:-false}; export PATH="/c/Users/Usuario/tools/node22:$PATH"; T=C:/Users/Usuario/tools/qa2
for p in 8090; do timeout 30 powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force -ErrorAction SilentlyContinue }"; done
cd $T/t2/backend
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgres://elevation:elevation_local@127.0.0.1:54331/postgres'});await c.connect();const r=await c.query('SELECT 1 FROM pg_database WHERE datname=\$1',['$DB']);if(!r.rowCount)await c.query('CREATE DATABASE $DB');await c.end()})()"
if ! curl -s -m2 localhost:8097/__log >/dev/null; then (node C:/Users/Usuario/Documents/gpt-elevation-MVP/.claude/worktrees/qa2-cadena-mapa-de38a7/qa/fake-anthropic.cjs > $T/be-fake.log 2>&1 &); fi
export DATABASE_URL="postgres://elevation:elevation_local@127.0.0.1:54331/$DB" DB_SSL=false PORT=8090 FRONTEND_URL=http://localhost:5173 NODE_ENV=development
export ANTHROPIC_BASE_URL=http://127.0.0.1:8097 ANTHROPIC_API_KEY=sk-ant-SIMULADO-local AI_BUDGET_TOKENS_PER_USER=$PER AI_BUDGET_PERIOD=month AI_MAX_RETRIES=0
[ -n "$COH" ] && export AI_BUDGET_TOKENS_COHORT=$COH
[ "$DR" = "true" ] && export DATA_RIGHTS_ENABLED=true
export JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")" DATA_ENCRYPTION_KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
(node server.js > $T/be-$DB.log 2>&1 &)
if ! curl -s -m2 localhost:5173 >/dev/null; then (cd ../frontend && VITE_BACKEND_URL=http://localhost:8090 npx vite --port 5173 --strictPort > $T/vite-$DB.log 2>&1 &); fi
for i in $(seq 1 30); do curl -s -m2 localhost:8090/api/health >/dev/null && break; sleep 1; done
echo "backend: $(curl -s localhost:8090/api/health) db=$DB por_persona=$PER cohorte=${COH:-sin tope} data_rights=$DR"
