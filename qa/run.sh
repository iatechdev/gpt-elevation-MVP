#!/bin/bash
# [QA-Claude-3] Ejecuta un script de qa/ contra un build. Uso: qa/run.sh <script.cjs> <build: main|322|324|322+324|321|323> <base_de_datos> [ONLY=F1,F3]
# Requiere el backend arrancado con qa/start-backend.sh <base_de_datos>.
export PATH="/c/Users/Usuario/tools/node22:$PATH"; Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; T=/c/Users/Usuario/tools
ROOT="$(git rev-parse --show-toplevel)"; S=$1; B=$2; D=$3; shift 3
export PLAYWRIGHT_MODULE=C:/Users/Usuario/tools/playwright/node_modules/playwright PLAYWRIGHT_BROWSERS_PATH=C:/Users/Usuario/tools/pw-browsers BACKEND="$ROOT/backend" AXE=C:/Users/Usuario/tools/lh/node_modules/axe-core/axe.min.js
export DIST="C:/Users/Usuario/tools/qa3/dist-$B" DATABASE_URL="postgres://elevation:elevation_local@127.0.0.1:54341/$D" LABEL=$([ "$B" = main ] && echo main || echo pr)
for kv in "$@"; do export "$kv"; done
exec node "$ROOT/qa/$S" < /dev/null
