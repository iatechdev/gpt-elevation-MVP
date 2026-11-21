#!/bin/bash
# [QA-Claude-3] Construye main + un PR (ref refs/qa3/<ref>) en el worktree aparte y deja $QA3_DIR/dist-<name> y fetest-<name>.log. Uso: qa/build-one.sh <name> <ref>
export PATH="/c/Users/Usuario/tools/node22:$PATH"; Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; REPO="$(git rev-parse --show-toplevel)"; W=$Q/wt; N=$1; REF=$2
git -C "$REPO" fetch -q origin main || exit 1; G="git -C $W -c user.name=qa -c user.email=qa@x"
$G checkout -q -f --detach origin/main; $G merge -q --no-edit refs/qa3/$REF >/dev/null 2>&1 || { echo CONFLICTO; exit 2; }; echo "$N head $(git -C $W rev-parse --short HEAD)"
(cd $W/frontend && VITE_BACKEND_URL=http://localhost:8190 npm run build > "$Q/build-$N.log" 2>&1; rm -rf "$Q/dist-$N"; mv dist "$Q/dist-$N"; node "$REPO/qa/jsgz.cjs" "$Q/dist-$N"; npm test > "$Q/fetest-$N.log" 2>&1; echo "$N pruebas: $(grep -E '^# (tests|pass|fail) ' "$Q/fetest-$N.log" | tr '\n' ' ')")
$G checkout -q -f --detach origin/main; echo listo
