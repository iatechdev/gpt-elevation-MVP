#!/bin/bash
# [QA-Claude] ES-185 PR #216 PANTALLA: backend real (qa-pr-253 = cabeza 552b59ef) en :8090 + build servido por el guion de QA-Claude-2 en :5173
# Uso: v216s.sh <etiqueta> <carpeta-dist> [ONLY]
export PATH="/c/Users/Usuario/tools/node22:$PATH"
LABEL=$1; DIST=$2; ONLY=$3
S=/c/Users/Usuario/Documents/qa13; BACK=/c/Users/Usuario/Documents/qa-pr-253/backend
DB=q216s_$LABEL; ADM=postgres://elevation:elevation_local@127.0.0.1:54459/postgres; URL=postgres://elevation:elevation_local@127.0.0.1:54459/$DB
cd $BACK
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$ADM'});await c.connect();await c.query('DROP DATABASE IF EXISTS $DB WITH (FORCE)');await c.query('CREATE DATABASE $DB');await c.end()})()" || exit 2
export JWT_SECRET=$(cat $S/jwt) DATA_ENCRYPTION_KEY=$(cat $S/dek) PROMPT_ENCRYPTION_KEY=$(cat $S/pek)
DATABASE_URL=$URL DB_SSL=false NODE_ENV=development node node_modules/sequelize-cli/lib/sequelize db:migrate > $S/v216/mig.$LABEL.log 2>&1; echo "migrate=$?"
PORT=8190 DATABASE_URL=$URL DB_SSL=false NODE_ENV=development ALLOW_SYNTHETIC_CATALOG=true FRONTEND_URL=http://localhost:5273 ANTHROPIC_API_KEY=sk-synthetic-not-real ANTHROPIC_BASE_URL=http://127.0.0.1:9 LOGIN_RATE_MAX=100000 REGISTER_RATE_MAX=100000 node server.js > $S/v216/srv.$LABEL.log 2>&1 &
SP=$!
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8190/api/health && break; sleep 1; done
for i in $(seq 1 60); do node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$URL'});await c.connect();const r=await c.query(\"select to_regclass('\\\"DiaryEntries\\\"') d\");await c.end();process.exit(r.rows[0].d?0:1)})()" && break; sleep 1; done
sleep 2
cd /c/Users/Usuario/tools/playwright
PLAYWRIGHT_MODULE=C:/Users/Usuario/tools/playwright/node_modules/playwright BACKEND=C:/Users/Usuario/Documents/qa-pr-253/backend DATABASE_URL=$URL AXE=C:/Users/Usuario/Documents/Central/node_modules/axe-core/axe.min.js DIST=$DIST LABEL=$LABEL ONLY=$ONLY PLAYWRIGHT_BROWSERS_PATH=C:/Users/Usuario/tools/pw-browsers timeout 900 node $S/es216b-8190.cjs > $S/v216/es216b.$LABEL.log 2>&1
echo "script rc=$?"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8190 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id ([int]\$_.OwningProcess) -Force }"; sleep 1
grep -c "^OK" $S/v216/es216b.$LABEL.log; grep "^FALLA" $S/v216/es216b.$LABEL.log | cut -c1-260
