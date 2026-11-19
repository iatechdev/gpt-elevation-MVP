#!/bin/bash
# [QA-Claude-3] Construye main + un PR con VITE_ENABLE_CAREER_PREVIEW=true y VITE_CAREER_SOURCE=api ($QA3_DIR/dist-<name>). Uso: qa/build-api.sh <name> <ref>   (ref = refs/qa3/<ref>)
export PATH="/c/Users/Usuario/tools/node22:$PATH"; Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; REPO="$(git rev-parse --show-toplevel)"; W=$Q/wt; N=$1; REF=$2
git -C "$REPO" fetch -q origin main || exit 1; G="git -C $W -c user.name=qa -c user.email=qa@x"
$G checkout -q -f --detach origin/main; $G merge -q --no-edit refs/qa3/$REF >/dev/null 2>&1 || { echo CONFLICTO; exit 2; }; echo "$N head $(git -C $W rev-parse --short HEAD)"
(cd $W/frontend && VITE_ENABLE_CAREER_PREVIEW=true VITE_CAREER_SOURCE=${CAREER_SOURCE:-api} VITE_BACKEND_URL=${BACKEND_URL:-http://localhost:8190} npm run build > "$Q/build-$N.log" 2>&1; rm -rf "$Q/dist-$N"; mv dist "$Q/dist-$N"; node "$REPO/qa/jsgz.cjs" "$Q/dist-$N")
$G checkout -q -f --detach origin/main; echo listo
