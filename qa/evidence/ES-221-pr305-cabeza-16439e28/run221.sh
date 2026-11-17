#!/bin/bash
# [QA-Claude] ES-221 PR #305: backend real (qa-pr-253, ya en la cabeza fusionada o en main) en :8190.
# Uso: run221.sh <etiqueta> <modo pr|main> <casos> "<ENV del servidor, separado por espacios>" [EXPECT_MAX] [PROXY]
export PATH="/c/Users/Usuario/tools/node22:$PATH"
LABEL=$1; MODE=$2; CASES=$3; SRVENV=$4; EXPECT=${5:-30}; PROXY=${6:-none}
S=/c/Users/Usuario/Documents/qa13; BACK=/c/Users/Usuario/Documents/qa-pr-253/backend; mkdir -p $S/v221
DB=q221_$LABEL; ADM=postgres://elevation:elevation_local@127.0.0.1:54459/postgres; URL=postgres://elevation:elevation_local@127.0.0.1:54459/$DB
cd $BACK
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$ADM'});await c.connect();await c.query('DROP DATABASE IF EXISTS $DB WITH (FORCE)');await c.query('CREATE DATABASE $DB');await c.end()})()" || exit 2
export JWT_SECRET=$(cat $S/jwt) DATA_ENCRYPTION_KEY=$(cat $S/dek) PROMPT_ENCRYPTION_KEY=$(cat $S/pek)
DATABASE_URL=$URL DB_SSL=false NODE_ENV=development node node_modules/sequelize-cli/lib/sequelize db:migrate > $S/v221/mig.$LABEL.log 2>&1; echo "migrate=$?"
env PORT=8190 DATABASE_URL=$URL DB_SSL=false NODE_ENV=development ALLOW_SYNTHETIC_CATALOG=true FRONTEND_URL=http://localhost:5273 ANTHROPIC_API_KEY=sk-synthetic-not-real ANTHROPIC_BASE_URL=http://127.0.0.1:9 LOGIN_RATE_LIMIT_MAX=100000 $SRVENV node server.js > $S/v221/srv.$LABEL.log 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8190/api/health && break; sleep 1; done
sleep 2
cd /c/Users/Usuario/Documents/gpt-elevation-qa
DATABASE_URL=$URL QA_SUT=C:/Users/Usuario/Documents/qa-pr-253 QA_API=http://localhost:8190 MODE=$MODE CASES=$CASES EXPECT_MAX=$EXPECT PROXY=$PROXY TAG=$LABEL OUT=C:/Users/Usuario/Documents/qa13/v221 timeout ${TMO:-900} node ${SCRIPT:-qa/integration/es221-servidor.cjs} > $S/v221/out.$LABEL.log 2>&1
echo "script rc=$?"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8190 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id ([int]\$_.OwningProcess) -Force }"; sleep 1
grep -E "RESUMEN" $S/v221/out.$LABEL.log; grep -E "^(FALLA|EXCEPCION)" $S/v221/out.$LABEL.log | cut -c1-300
