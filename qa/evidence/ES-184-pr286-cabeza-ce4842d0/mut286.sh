#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
F=/c/Users/Usuario/Documents/qa-pr-test/frontend; S=/c/Users/Usuario/Documents/qa13
SC=C:/Users/Usuario/Documents/gpt-elevation-qa/qa/e2e/es286-aprobar.cjs
cd $F
unit() { node --test test/es-184-contenido.test.mjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { VITE_BACKEND_URL=http://localhost:8190 npx vite build --outDir dist286_mut > /dev/null 2>&1; (cd $S && bash run184p.sh mm$RANDOM $SC C:/Users/Usuario/Documents/qa-pr-test/frontend/dist286_mut pr 2>&1 | grep -E "RESUMEN|^FALLA" | cut -c1-150 | head -3); }
run_mut() { name="$1"; file="$2"; from="$3"; to="$4"; echo "== $name"
  node $S/mutapply.cjs "$file" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- src; return; }
  echo "  unit: $(unit)"; echo "  mi guion:"; mine; git checkout -q -- src; }
PA=src/pages/admin/ProfessionalApplicationsPanel.tsx; CP=src/i18n/adminCopy.ts
echo "== base"; echo "  unit: $(unit)"
run_mut "M1 volver al texto viejo en aprobar" $PA "tr('Aprobar esta solicitud no crea ni activa una cuenta. Después, usa «Crear cuenta de profesional».')}</p>" "tr('Queda activa en la plataforma y puede recibir personas.')}</p>"
run_mut "M2 quitar la traducción EN" $CP "'Aprobar esta solicitud no crea ni activa una cuenta. Después, usa «Crear cuenta de profesional».': 'Approving this application does not create or activate an account. Use “Create professional account” afterward.'," ""
run_mut "M3 el aviso de rechazar usa el de aprobar" $PA "tr('El motivo lo verá la persona.') : tr('Aprobar" "tr('Aprobar esta solicitud no crea ni activa una cuenta. Después, usa «Crear cuenta de profesional».') : tr('Aprobar"
git status --short | grep -v -E "dist|node_modules" | head -2; echo fin
