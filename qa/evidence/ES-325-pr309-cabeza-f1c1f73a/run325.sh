#!/bin/bash
# [QA-Claude] ES-237 PR #307: backend real (qa-pr-253, main+305: sin cambios en careerPlan) en :8192 + script del cliente.
# Uso: run237.sh <etiqueta> <casos> [FRONT_WORKTREE]
export PATH="/c/Users/Usuario/tools/node22:$PATH"
LABEL=$1; CASES=${2:-all}; FRONT=${3:-C:/Users/Usuario/Documents/qa-pr-test}
S=/c/Users/Usuario/Documents/qa13; BACK=/c/Users/Usuario/Documents/qa-pr-253/backend; mkdir -p $S/v325
DB=q325_$LABEL; ADM=postgres://elevation:elevation_local@127.0.0.1:54459/postgres; URL=postgres://elevation:elevation_local@127.0.0.1:54459/$DB
cd $BACK
node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'$ADM'});await c.connect();await c.query('DROP DATABASE IF EXISTS $DB WITH (FORCE)');await c.query('CREATE DATABASE $DB');await c.end()})()" || exit 2
export JWT_SECRET=$(cat $S/jwt) DATA_ENCRYPTION_KEY=$(cat $S/dek) PROMPT_ENCRYPTION_KEY=$(cat $S/pek)
DATABASE_URL=$URL DB_SSL=false NODE_ENV=development node node_modules/sequelize-cli/lib/sequelize db:migrate > $S/v325/mig.$LABEL.log 2>&1; echo "migrate=$?"
PORT=8192 DATABASE_URL=$URL DB_SSL=false NODE_ENV=development ALLOW_SYNTHETIC_CATALOG=true FRONTEND_URL=http://localhost:5273 ANTHROPIC_API_KEY=sk-synthetic-not-real ANTHROPIC_BASE_URL=http://127.0.0.1:9 LOGIN_RATE_LIMIT_MAX=100000 REGISTER_RATE_LIMIT_MAX=100000 node server.js > $S/v325/srv.$LABEL.log 2>&1 &
for i in $(seq 1 60); do curl -s -o /dev/null http://localhost:8192/api/health && break; sleep 1; done
sleep 2
cd /c/Users/Usuario/Documents/gpt-elevation-qa
DATABASE_URL=$URL DB_SSL=false QA_SUT=C:/Users/Usuario/Documents/qa-pr-253 QA_API=http://localhost:8192 CASES=$CASES MODE=${MODE:-pr} TAG=$LABEL OUT=C:/Users/Usuario/Documents/qa13/v325 timeout 900 node qa/integration/es325-metricas.cjs > $S/v325/out.$LABEL.log 2>&1
echo "script rc=$?"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8192 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id ([int]\$_.OwningProcess) -Force }"; sleep 1
grep -E "RESUMEN" $S/v325/out.$LABEL.log; grep -E "^(FALLA|EXCEPCION)" $S/v325/out.$LABEL.log | cut -c1-300
