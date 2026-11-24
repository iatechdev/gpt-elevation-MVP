#!/bin/bash
# [QA-Claude-3] Construye main y cada cabeza (mergeada sobre main) a carpetas ligeras, corre pruebas del frontend y build:check.
# Uso: qa/build-heads.sh main 322 324 322+324 321 323   (desde la raíz del worktree QA; requiere node_modules instalados)
export PATH="/c/Users/Usuario/tools/node22:$PATH"; Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; REPO=iatechdev/gpt-elevation-MVP
cd "$(git rev-parse --show-toplevel)"
for L in "$@"; do
  git checkout -q --detach origin/main || exit 1
  if [ "$L" != main ]; then for N in ${L//+/ }; do git fetch -q origin pull/$N/head && git -c user.name=qa -c user.email=qa@x merge --no-edit FETCH_HEAD >/dev/null 2>&1 || { echo "CONFLICTO $L"; git merge --abort 2>/dev/null; continue 2; }; done; fi
  echo "== $L head=$(git rev-parse --short HEAD)" | tee "$Q/build-$L.log"
  (cd frontend && VITE_BACKEND_URL=http://localhost:8190 npm run build >> "$Q/build-$L.log" 2>&1; npm run build:check 2>&1 | tail -n 4 >> "$Q/build-$L.log"; rm -rf "$Q/dist-$L"; mv dist "$Q/dist-$L"
   npm test > "$Q/fetest-$L.log" 2>&1; grep -E "^ℹ (tests|pass|fail)" "$Q/fetest-$L.log" | tr '\n' ' ' >> "$Q/build-$L.log")
  echo >> "$Q/build-$L.log"; tail -n 6 "$Q/build-$L.log"
done
git checkout -q qa3-es329-es310
