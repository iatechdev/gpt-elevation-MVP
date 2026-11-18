#!/bin/bash
# [QA-Claude-3] Builds para el QA del marco de Administración (#331): A = main, B = marco solo (lista vacía), C = marco + #318 + #319 + #321 + #323 con las 5 rutas en MIGRATED_ADMIN_PATHS.
# Trabaja en un worktree aparte ($QA3_DIR/wt, con node_modules por unión de directorio): NO toca el worktree de qa/. Salida: $QA3_DIR/dist-A, dist-B, dist-C y fetest-*.log
export PATH="/c/Users/Usuario/tools/node22:$PATH"; Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; REPO="$(git rev-parse --show-toplevel)"; W=$Q/wt
git -C "$REPO" fetch -q origin main pull/331/head:refs/qa3/331 pull/318/head:refs/qa3/318n pull/319/head:refs/qa3/319n pull/321/head:refs/qa3/321n pull/323/head:refs/qa3/323n || exit 1
G="git -C $W -c user.name=qa -c user.email=qa@x"
build() { (cd $W/frontend && VITE_BACKEND_URL=http://localhost:8190 npm run build > "$Q/build-$1.log" 2>&1; rm -rf "$Q/dist-$1"; mv dist "$Q/dist-$1"; node "$REPO/qa/jsgz.cjs" "$Q/dist-$1") }
test_() { (cd $W/frontend && npm test > "$Q/fetest-$1.log" 2>&1; echo "$1 pruebas: $(grep -E '^# (tests|pass|fail) ' "$Q/fetest-$1.log" | tr '\n' ' ')") }
$G checkout -q -f --detach origin/main; echo "A main $(git -C $W rev-parse --short HEAD)"; build A
$G merge -q --no-edit refs/qa3/331 >/dev/null 2>&1 || { echo "CONFLICTO #331"; exit 2; }; echo "B $(git -C $W rev-parse --short HEAD)"; build B; test_ B
for r in 318n 319n 321n 323n; do $G merge -q --no-edit refs/qa3/$r >/dev/null 2>&1 || { echo "CONFLICTO $r: $(git -C $W diff --name-only --diff-filter=U | tr '\n' ' ')"; $G merge --abort; echo "C incompleto"; exit 3; }; done
# las 5 rutas en la lista del marco (lo que harán los PR de pantalla tras fusionarse el marco)
F=$W/frontend/src/shell/adminLayoutState.ts; sed -i "s#MIGRATED_ADMIN_PATHS: readonly string\[\] = \[\]#MIGRATED_ADMIN_PATHS: readonly string[] = ['/admin/dashboard', '/admin/metrics', '/admin/prompts', '/admin/route-catalog', '/admin/users']#" $F; grep -c "'/admin/users'" $F
echo "C $(git -C $W rev-parse --short HEAD)+lista"; build C; test_ C
$G checkout -q -f --detach origin/main
echo "listo"
