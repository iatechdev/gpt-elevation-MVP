#!/bin/bash
# [QA-Claude] ES-183 PR #215: backend real (qa-pr-253) en :8190 solo para sesiones y roles; script indicado sirve el dist en :5273
# Uso: run215.sh <etiqueta> <guion.cjs> <dist> [VARIANT]
export PATH="/c/Users/Usuario/tools/node22:$PATH"
LABEL=$1; SCRIPT=$2; DIST=$3; VARIANT=$4
S=/c/Users/Usuario/Documents/qa13; BACK=/c/Users/Usuario/Documents/qa-pr-253/backend; mkdir -p $S/v184
DB=q215s_$LABEL; ADM=postgres://elevation:elevation_local@127.0.0.1:54459/postgres; URL=postgres://elevation:elevation_local@127.0.0.1:54459/$DB
cd $BACK
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$ADM'});await c.connect();await c.query('DROP DATABASE IF EXISTS $DB WITH (FORCE)');await c.query('CREATE DATABASE $DB');await c.end()})()" || exit 2
export JWT_SECRET=$(cat $S/jwt) DATA_ENCRYPTION_KEY=$(cat $S/dek) PROMPT_ENCRYPTION_KEY=$(cat $S/pek)
DATABASE_URL=$URL DB_SSL=false NODE_ENV=development node node_modules/sequelize-cli/lib/sequelize db:migrate > $S/v184/mig.$LABEL.log 2>&1; echo "migrate=$?"
PORT=8190 DATABASE_URL=$URL DB_SSL=false NODE_ENV=development ALLOW_SYNTHETIC_CATALOG=true FRONTEND_URL=http://localhost:5273 ANTHROPIC_API_KEY=sk-synthetic-not-real ANTHROPIC_BASE_URL=http://127.0.0.1:9 LOGIN_RATE_MAX=100000 REGISTER_RATE_MAX=100000 node server.js > $S/v184/srv.$LABEL.log 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8190/api/health && break; sleep 1; done
for i in $(seq 1 60); do node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$URL'});await c.connect();const r=await c.query(\"select to_regclass('\\\"DiaryEntries\\\"') d\");await c.end();process.exit(r.rows[0].d?0:1)})()" && break; sleep 1; done
sleep 2
cd /c/Users/Usuario/Documents/gpt-elevation-qa
DATABASE_URL=$URL QA_SUT=C:/Users/Usuario/Documents/qa-pr-253 QA_API=http://localhost:8190 QA_JWT_SECRET=$JWT_SECRET QA_HEAD=4ed4ff40359dda9c68e46c1c970d1169599aa2a0 MODE=$VARIANT OUT=C:/Users/Usuario/Documents/qa13/v184 timeout 600 node $SCRIPT > $S/v184/out.$LABEL.log 2>&1
echo "script rc=$?"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8190 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id ([int]\$_.OwningProcess) -Force }"; sleep 1
grep -E "RESUMEN" $S/v184/out.$LABEL.log; grep -E "^(FALLA|EXCEPCION)" $S/v184/out.$LABEL.log | cut -c1-300
