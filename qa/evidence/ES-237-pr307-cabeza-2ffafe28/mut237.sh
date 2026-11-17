#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
F=/c/Users/Usuario/Documents/qa-pr-test/frontend; S=/c/Users/Usuario/Documents/qa13; API=src/career/api.ts
cd $F
unit() { node --test test/es-237-api-career.test.mjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { (cd $S && bash run237.sh mm$RANDOM "$1" 2>&1 | grep -E "RESUMEN|^FALLA" | cut -c1-150 | head -3); }
run_mut() { name="$1"; from="$2"; to="$3"; cases="$4"; echo "== $name"
  node $S/mutapply.cjs "$F/$API" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- .; return; }
  echo "  prueba del PR: $(unit)"; echo "  mi guion ($cases):"; mine "$cases"; cd $F; git checkout -q -- . ; }
echo "== base"; echo "  prueba del PR: $(unit)"; git status --short | grep -v "dist2\|node_modules" | head -2
run_mut "m1 sin cabecera Authorization" 'headers: { Authorization: `Bearer ${token}`, Accept' 'headers: { Accept' c4
run_mut "m2 userId en el cuerpo" '...(body !== undefined ? { body: JSON.stringify(body) } : {}),' '...(body !== undefined ? { body: JSON.stringify({ ...(body as object), userId: 1 }) } : {}),' c3
run_mut "m3 vocabulario «postpone»" "export type Decision = 'continue' | 'adjust' | 'pause' | 'discard'" "export type Decision = 'continue' | 'adjust' | 'pause' | 'discard' | 'postpone'" c4
run_mut "m4 isUncertain invertido" "(error.kind === 'network' || error.kind === 'unavailable')" "(error.kind !== 'network' && error.kind !== 'unavailable')" c4
run_mut "m5 sin cache no-store" "cache: 'no-store', " "" c4
run_mut "m6 sin rechazo por falta de token" "if (!token) throw new CareerApiError('expired', 401, '')" "" c4
git status --short | grep -v "dist2\|node_modules" | head -3; echo fin
