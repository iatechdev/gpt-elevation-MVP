#!/bin/bash
# [QA-Claude] Lanza la muestra con Claude (real o ensayo con proveedor simulado) contra una base LOCAL DESECHABLE.
#
# Uso (en Git Bash, desde la carpeta del repositorio ya con main actualizado y las dependencias de backend instaladas):
#   Ensayo sin gasto :  PGADMIN=postgres://usuario:clave@127.0.0.1:5432/postgres QA_MOCK=http://127.0.0.1:9913 bash qa/real/run-real-sample.sh mock
#   Muestra real     :  PGADMIN=postgres://usuario:clave@127.0.0.1:5432/postgres bash qa/real/run-real-sample.sh real
#
# SEGURIDAD
#  - La clave de Anthropic NO se pasa por argumentos ni se escribe en archivos: en modo real el script la lee de la variable ANTHROPIC_API_KEY que ya tengas
#    cargada en TU sesión (o te la pide sin mostrarla en pantalla). QA no la ve, no la lee y no se pega en el chat ni en Jira/GitHub.
#  - PGADMIN debe apuntar a un Postgres LOCAL desechable (superusuario): el script crea y BORRA la base `qa_real_sample`. NUNCA a staging ni producción.
#  - Los secretos de la prueba (JWT, cifrado) se generan al azar en memoria y no se guardan.
#  - Tope de gasto: AI_BUDGET_TOKENS_PER_USER=40000 y AI_BUDGET_TOKENS_COHORT=200000 (ajustables por variable). Son ~10 llamadas pequeñas.
set -e
MODE="${1:-mock}"; [ "$MODE" = "real" ] || [ "$MODE" = "mock" ] || { echo "Modo: mock|real"; exit 1; }
: "${PGADMIN:?Falta PGADMIN (Postgres local desechable)}"
case "$PGADMIN" in *127.0.0.1*|*localhost*) ;; *) echo "PGADMIN debe ser local (127.0.0.1/localhost). Abortado."; exit 1;; esac
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; SUT="${SUT:-$ROOT}"; OUT="${OUT:-$ROOT/qa/real/resultado}"; PORT="${PORT:-9933}"
[ -d "$SUT/backend/node_modules" ] || { echo "Instala dependencias: (cd $SUT/backend && npm install)"; exit 1; }
if [ "$MODE" = "real" ] && [ -z "${ANTHROPIC_API_KEY:-}" ]; then read -r -s -p "ANTHROPIC_API_KEY (no se muestra): " ANTHROPIC_API_KEY; echo; export ANTHROPIC_API_KEY; fi
rnd(){ node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))"; }
export JWT_SECRET="$(rnd)" DATA_ENCRYPTION_KEY="$(rnd)" PROMPT_ENCRYPTION_KEY="$(rnd)" PROFESSIONAL_ENCRYPTION_KEY="$(rnd)"
DBURL="$(node -e "const u=new URL(process.argv[1]);u.pathname='/qa_real_sample';process.stdout.write(u.toString())" "$PGADMIN")"
node -e "
const {createRequire}=require('module');const r=createRequire(process.argv[2]+'/backend/package.json');const {Client}=r('pg');
(async()=>{const c=new Client({connectionString:process.argv[1]});await c.connect();await c.query('drop database if exists qa_real_sample with (force)');await c.query('create database qa_real_sample');await c.end()})().catch(e=>{console.error('No pude preparar la base:',e.message);process.exit(1)})" "$PGADMIN" "$SUT"
( cd "$SUT/backend" && DATABASE_URL="$DBURL" DB_SSL=false NODE_ENV=test npx sequelize-cli db:migrate >/dev/null 2>&1 ) || { echo "Falló la migración"; exit 1; }
# servidor de la API (en modo real usa la clave real y NO define ANTHROPIC_BASE_URL)
( cd "$SUT/backend" && export PORT DATABASE_URL="$DBURL" DB_SSL=false AI_BUDGET_PERIOD=day AI_MAX_RETRIES=0 AI_BUDGET_TOKENS_PER_USER="${AI_BUDGET_TOKENS_PER_USER:-40000}" AI_BUDGET_TOKENS_COHORT="${AI_BUDGET_TOKENS_COHORT:-200000}"
  if [ "$MODE" = "mock" ]; then export ANTHROPIC_API_KEY=sk-synthetic-not-real ANTHROPIC_BASE_URL="${QA_MOCK:-http://127.0.0.1:9913}"; else unset ANTHROPIC_BASE_URL; fi
  nohup node server.js > "${TMPDIR:-/tmp}/qa-real-api.log" 2>&1 & echo $! > "${TMPDIR:-/tmp}/qa-real-api.pid" )
trap 'kill $(cat "${TMPDIR:-/tmp}/qa-real-api.pid") 2>/dev/null || true' EXIT
for i in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$PORT/api/health" && break; sleep 1; done
curl -s -o /dev/null "http://127.0.0.1:$PORT/api/health" || { echo "El servidor no arrancó (ver ${TMPDIR:-/tmp}/qa-real-api.log)"; exit 1; }
QA_MODE="$MODE" QA_SUT="$SUT" QA_API="http://127.0.0.1:$PORT" QA_MOCK="${QA_MOCK:-}" DATABASE_URL="$DBURL" QA_ADMIN_URL="$DBURL" QA_JWT_SECRET="$JWT_SECRET" QA_PRO_KEY="$PROFESSIONAL_ENCRYPTION_KEY" OUT="$OUT" \
  node "$ROOT/qa/real/es-real-sample.mjs"
echo "Listo. Informe en: $OUT/real-sample-report-$MODE.md (no contiene claves). Puedes borrar la base: drop database qa_real_sample."
