#!/bin/bash
# [QA-Claude] Mutaciones PR #215 (ES-183 pantalla) cabeza 6e28b52e. Árbol: qa-pr-test/frontend
export PATH="/c/Users/Usuario/tools/node22:$PATH"
F=/c/Users/Usuario/Documents/qa-pr-test/frontend; S=/c/Users/Usuario/Documents/qa13
P=C:/Users/Usuario/Documents/gpt-elevation-qa/qa/e2e/es215-preview.cjs
cd $F
unit() { node --test test/es-183-metricas.test.mjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { # $1 variante $2 flag preview $3 etiqueta
  VITE_BACKEND_URL=http://localhost:8190 VITE_ENABLE_PILOT_FEEDBACK_PREVIEW=$2 npx vite build --outDir dist215_mut > /dev/null 2>&1
  (cd $S && bash run215.sh $3 $P C:/Users/Usuario/Documents/qa-pr-test/frontend/dist215_mut $1 | grep -E "RESUMEN" ); }
run_mut() { name="$1"; file="$2"; from="$3"; to="$4"; var="$5"; flag="$6"; echo "== $name"
  node $S/mutapply.cjs "$file" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- "$file"; return; }
  echo "  unit es-183: $(unit)"; echo "  mi guion ($var): $(mine $var "$flag" m$RANDOM)"; git checkout -q -- "$file"; }
PG=src/pilot/PilotMetricsPage.tsx; CP=src/pilot/copy.ts; MD=src/pilot/model.ts
echo "== base"; echo "  unit es-183: $(unit)"
run_mut "M1 reponer cifra de meta (5/6 · 7 días) en Targets" $PG "<p>{c.targetPending}</p>" "<p>5/6 · {c.day7}</p>" def ""
run_mut "M2 NoData pide /api/admin/pilot-metrics" $PG "function NoData() {" "function NoData() { void fetch('http://localhost:8190/api/admin/pilot-metrics', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('elevation_token') ?? '') } });" def ""
run_mut "M3 quitar el umbral «menos de 5 personas» del texto protegido (ES)" $CP "protegidos porque hay menos de 5 personas en la muestra" "protegidos por el tamaño de la muestra" pnorm true
run_mut "M4 bandera encendida por defecto" $MD "return value === 'true'" "return value !== 'false'" def ""
git status --short | grep -v -E "dist|node_modules" | head -2; echo fin
