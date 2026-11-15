#!/bin/bash
# [QA-Claude] Mutaciones PR #216 (ES-185 servidor) cabeza 552b59ef. SUT: qa-pr-253 (cabeza fusionada con main)
export PATH="/c/Users/Usuario/tools/node22:$PATH"
B=/c/Users/Usuario/Documents/qa-pr-253/backend; S=/c/Users/Usuario/Documents/qa13
U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B
prt() { node --require ./test/quiet-console.cjs --test test/es-185-content.test.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
p278() { ES278_TEST_DATABASE_URL=$U timeout 200 node --test test/integration/es-278-postgres.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
p281() { ES281_TEST_DATABASE_URL=$U timeout 200 node --test test/integration/es-281-postgres.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { (cd $S && timeout 400 node r42c/run216.mjs pr >/dev/null 2>&1; grep RESUMEN v172/es185-servidor-pr216.cjs.x.log); }
echo "== base"; echo "  es-185: $(prt)"; echo "  es-278 PG: $(p278)"; echo "  es-281 PG: $(p281)"; echo "  mi script: $(mine)"
run_mut() { name="$1"; file="$2"; from="$3"; to="$4"; echo "== $name"
  node $S/mutapply.cjs "$file" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- "$file"; return; }
  echo "  es-185: $(prt)"; echo "  es-278 PG: $(p278)"; echo "  es-281 PG: $(p281)"; echo "  mi script: $(mine)"; git checkout -q -- "$file"; }
L=routes/landingContent.js; P=routes/pricing.js; F=test/fixtures/routes-roles.json
run_mut "M1 GET /admin sin verificarAdmin" $L "router.get('/admin', verificarAdmin," "router.get('/admin',"
run_mut "M2 el catch del administrativo devuelve 200 vacio" $L "res.status(503).json({ error: 'No se pudo cargar el contenido.' });" "res.json({});"
run_mut "M4 el PUT de planes vuelve a aceptar slug" $P "'name_es','name_en','description_es'" "'slug','name_es','name_en','description_es'"
run_mut "M5 el POST de planes ignora isActive" $P "v.isActive      ?? true," "true,"
run_mut "M6 sin politica de roles del GET /admin" $F '"GET /api/landing-content/admin": {' '"GET /api/landing-content/admin-qa": {'
git status --short | grep -v dist | head -2; echo fin
