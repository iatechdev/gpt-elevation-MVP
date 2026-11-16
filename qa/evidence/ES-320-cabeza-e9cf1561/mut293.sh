#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
F=/c/Users/Usuario/Documents/qa-pr-test/frontend; S=/c/Users/Usuario/Documents/qa13
SC=C:/Users/Usuario/Documents/gpt-elevation-qa/qa/e2e/es293-chat.cjs
cd /c/Users/Usuario/Documents/qa-pr-test && git checkout -q --detach qa293 && cd $F
unit() { node --test test/es-112-space.test.mjs test/es-123-chat-layout.test.mjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { VITE_BACKEND_URL=http://localhost:8190 npx vite build --outDir dist293_mut > /dev/null 2>&1; (cd $S && bash run184p.sh mm$RANDOM $SC C:/Users/Usuario/Documents/qa-pr-test/frontend/dist293_mut pr 2>&1 | grep -E "RESUMEN|^FALLA" | grep -v "palabra\|A5 " | cut -c1-140 | head -3); }
run_mut() { name="$1"; file="$2"; from="$3"; to="$4"; echo "== $name"
  node $S/mutapply.cjs "$file" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- src; return; }
  echo "  unit es-112/es-123: $(unit)"; echo "  mi guion (sin las fallas base de palabra/A5):"; mine; git checkout -q -- src; }
CP=src/pages/ChatPage.tsx; CSS=src/space/space.css
echo "== base"; echo "  unit: $(unit)"
run_mut "m1 reponer cabecera interna con selector de idioma" $CP "<h1 className=\"sr-only\">{lang === 'es' ? 'Conversación' : 'Conversation'}</h1>" "<h1 className=\"sr-only\">{lang === 'es' ? 'Conversación' : 'Conversation'}</h1><header><button type=\"button\">ES</button></header>"
run_mut "m2 quitar aria-pressed de Recomendaciones" $CP "aria-pressed={showRecs} onClick" "onClick"
run_mut "m3 mostrar Administración sin chequear el rol" $CP "{['admin', 'superadmin'].includes(role) && <button type=\"button\" className=\"elv-btn\" onClick={openAdmin}>" "{true && <button type=\"button\" className=\"elv-btn\" onClick={openAdmin}>"
run_mut "m4 bajar el ancho a 760" $CSS "max-width: 1240px;" "max-width: 760px;"
run_mut "m5 quitar la regla móvil de 2 columnas" $CSS ".chat-actions .elv-btn { flex: 1 1 calc(50% - 8px);" ".chat-actions .elv-btn { flex: 1 1 100%;"
git status --short | grep -v -E "dist|node_modules" | head -2; echo fin
