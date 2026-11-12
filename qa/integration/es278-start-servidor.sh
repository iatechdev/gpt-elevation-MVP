#!/bin/bash
# [QA-Claude] ES-285: servidor real completo del PR #243 (sirve ../frontend/dist) con secretos sintéticos locales
S=/c/Users/Usuario/Documents/qa13
cd /c/Users/Usuario/Documents/qa-pr-221/backend
export PATH="/c/Users/Usuario/tools/node22:$PATH"
export PORT=$1 DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54459/qa245 DB_SSL=false NODE_ENV=test
export JWT_SECRET=$(cat $S/jwt) DATA_ENCRYPTION_KEY=$(cat $S/dek) PROMPT_ENCRYPTION_KEY=$(cat $S/pek)
export ANTHROPIC_API_KEY=sk-synthetic-not-real ANTHROPIC_BASE_URL=http://127.0.0.1:9913
export AI_BUDGET_TOKENS_PER_USER=200000 AI_BUDGET_TOKENS_COHORT=2000000 AI_BUDGET_PERIOD=day AI_MAX_RETRIES=0
exec node server.js
