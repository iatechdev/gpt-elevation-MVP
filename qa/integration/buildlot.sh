#!/bin/bash
# [QA-Claude] compila una variante del lote landing: buildlot.sh <rama> <etiqueta> [VAR=valor ...]
export PATH="/c/Users/Usuario/tools/node22:$PATH"
cd /c/Users/Usuario/Documents/qa-pr-test && git checkout -q --detach $1 || exit 1
cd frontend && shift && L=$1 && shift
env "$@" npx vite build --outDir /c/Users/Usuario/Documents/qa13/lot-$L > /c/Users/Usuario/Documents/qa13/lot-$L.log 2>&1; echo "$L exit=$?"; grep -E "kB|error" /c/Users/Usuario/Documents/qa13/lot-$L.log | tail -4
