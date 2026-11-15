#!/bin/bash
# [QA-Claude] Mutaciones de pantalla PR #284 (ES-184) cabeza 4ed4ff40. Árbol: qa-pr-test/frontend
export PATH="/c/Users/Usuario/tools/node22:$PATH"
F=/c/Users/Usuario/Documents/qa-pr-test/frontend; S=/c/Users/Usuario/Documents/qa13
SC=C:/Users/Usuario/Documents/gpt-elevation-qa/qa/e2e/es184-pantalla.cjs
cd $F
unit() { node --test test/es-184-contenido.test.mjs test/es-95-professional.test.mjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { VITE_BACKEND_URL=http://localhost:8190 npx vite build --outDir dist284_mut > /dev/null 2>&1; (cd $S && bash run184p.sh mm$RANDOM $SC C:/Users/Usuario/Documents/qa-pr-test/frontend/dist284_mut pr 2>&1 | grep -E "RESUMEN|^FALLA" | cut -c1-170 | head -4); }
run_mut() { name="$1"; file="$2"; from="$3"; to="$4"; echo "== $name"
  node $S/mutapply.cjs "$file" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- src; return; }
  echo "  unit es-184/es-95: $(unit)"; echo "  mi guion:"; mine; git checkout -q -- src; }
AC=src/pages/admin/AdminContent.tsx; PA=src/pages/admin/ProfessionalApplicationsPanel.tsx
echo "== base"; echo "  unit es-184/es-95: $(unit)"
run_mut "M1 «Datos depurados» por el correo @deleted.invalid en vez de la marca" $PA "if (item.minimized) {" "if (/@deleted\.invalid\$/.test(item.email)) {"
run_mut "M2 eliminar vuelve a window.confirm" $PA "onClick={() => removing && void remove(removing)}" "onClick={() => removing && window.confirm('Seguro?') && void remove(removing)}"
run_mut "M3 reponer un emoji en el botón de la hoja de vida" $PA "{tr('Descargar hoja de vida')} (" "{'👁 '}{tr('Descargar hoja de vida')} ("
run_mut "M4 contador inventado (0) cuando el servidor falla" $AC "return Array.isArray(data) ? data.length : null" "return Array.isArray(data) ? data.length : 0"
run_mut "M5 rechazar sin motivo permitido en Validaciones" $AC "if (actionType === 'reject' && !note.trim()) {" "if (false) {"
git status --short | grep -v -E "dist|node_modules" | head -2; echo fin
