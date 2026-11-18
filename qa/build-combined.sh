#!/bin/bash
# [QA-Claude-3] Construye el merge de #322 + #324 resolviendo el conflicto previsto (misma línea de MIGRATED_PERSON_PATHS y fin de pages.css): se conserva TODO de ambos lados. Salida: $QA3_DIR/dist-322+324
export PATH="/c/Users/Usuario/tools/node22:$PATH"; Q=${QA3_DIR:-/c/Users/Usuario/tools/qa3}; cd "$(git rev-parse --show-toplevel)"
git checkout -q --detach origin/main && git -c user.name=qa -c user.email=qa@x merge --no-edit refs/qa3/322 >/dev/null 2>&1 || exit 1
git -c user.name=qa -c user.email=qa@x merge --no-edit refs/qa3/324 >/dev/null 2>&1
git diff --name-only --diff-filter=U | tee "$Q/conflicts-322+324.txt"
# pages.css: conservar ambos lados (quitar marcadores); personLayoutState.ts: tomar la versión de #322 y añadir la ruta de #324
sed -i '/^<<<<<<< /d;/^=======$/d;/^>>>>>>> /d' frontend/src/cartografia/pages.css
git checkout --ours frontend/src/shell/personLayoutState.ts && sed -i "s#'/app/dashboard'#'/app/dashboard', '/app/my-therapist'#" frontend/src/shell/personLayoutState.ts
grep -c "my-therapist" frontend/src/shell/personLayoutState.ts
(cd frontend && VITE_BACKEND_URL=http://localhost:8190 npm run build > "$Q/build-322+324.log" 2>&1; npm run build:check 2>&1 | tail -n 4 >> "$Q/build-322+324.log"; rm -rf "$Q/dist-322+324"; mv dist "$Q/dist-322+324"; npm test > "$Q/fetest-322+324.log" 2>&1)
git checkout -q -f qa3-es329-es310; echo done
