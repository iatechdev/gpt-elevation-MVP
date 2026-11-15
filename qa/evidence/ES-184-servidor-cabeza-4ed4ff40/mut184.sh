#!/bin/bash
# [QA-Claude] Mutaciones del servidor PR #284 (ES-184) cabeza 4ed4ff40. SUT: qa-pr-253
export PATH="/c/Users/Usuario/tools/node22:$PATH"
B=/c/Users/Usuario/Documents/qa-pr-253/backend; S=/c/Users/Usuario/Documents/qa13
U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
SC=C:/Users/Usuario/Documents/gpt-elevation-qa/qa/integration/es184-servidor-pr284.cjs
cd $B
p293() { ES293_TEST_DATABASE_URL=$U timeout 200 node --test test/integration/es-293-postgres.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { (cd $S && timeout 500 bash run184.sh m$RANDOM $SC x pr 2>&1 | grep RESUMEN); }
echo "== base"; echo "  es-293 PG: $(p293)"
run_mut() { name="$1"; from="$2"; to="$3"; echo "== $name"
  node $S/mutapply.cjs routes/professionalApplications.js "$from" "$to" || { echo "NO APLICA"; git checkout -q -- routes; return; }
  echo "  es-293 PG: $(p293)"; echo "  mi script: $(mine)"; git checkout -q -- routes; }
run_mut "M1 condición invertida (== null)" "minimized: row.minimizedAt != null," "minimized: row.minimizedAt == null,"
run_mut "M2 devuelve la fecha en vez del booleano" "minimized: row.minimizedAt != null," "minimized: row.minimizedAt ?? false,"
run_mut "M3 quita el campo" "  minimized: row.minimizedAt != null, // ES-184" "  // ES-184"
run_mut "M4 siempre true" "minimized: row.minimizedAt != null," "minimized: true,"
run_mut "M5 decide por el correo @deleted.invalid" "minimized: row.minimizedAt != null," "minimized: /@deleted\\.invalid\$/.test(row.email),"
git status --short | grep -v dist | head -2; echo fin
