#!/bin/bash
# Construye las variantes de la vista previa para #261 (cabeza f416f322) y la de main (control).
export PATH="/c/Users/Usuario/tools/node22:$PATH"
V=/c/Users/Usuario/Documents/qa13/v261; PR=/c/Users/Usuario/Documents/qa-pr-221; MAIN=/c/Users/Usuario/Documents/qa-pr-221
cd $PR/frontend; git checkout -q -- .; git checkout -q --detach f416f322e15fa64b5b3b487afa4c4a646fccc92f; echo "PR $(git rev-parse HEAD)"
b() { name=$1; scen=$2; flag=$3; env VITE_ENABLE_FACILITATION_PREVIEW=$flag VITE_FACILITATION_FIXTURE_SCENARIO=$scen npx vite build --outDir $V/dist-$name --emptyOutDir > $V/build-$name.log 2>&1; echo "$name exit=$?"; }
b normal normal true; b empty empty true; b load-error load-error true; b revoked revoked true; b off normal false
# variantes INSTRUMENTADAS (solo para QA, en este árbol de trabajo y revertidas): el fallo de guardado/ack perdido/conflicto cae en la OBJECIÓN de la persona y no en la revisión del profesional
F=src/facilitation/fixture.ts
patch() { node -e "const fs=require('fs');let s=fs.readFileSync('$F','utf8');const a=process.argv[1],b=process.argv[2];if(s.split(a).length!==2)throw new Error('no único: '+a);fs.writeFileSync('$F',s.replace(a,()=>b))" "$1" "$2"; }
patch "if (scenario === 'save-error' && !failed)" "if (scenario === 'save-error' && command.kind === 'objection' && !failed)"; b obj-save save-error true; git checkout -q -- .
patch "if (scenario === 'lost-ack' && !failed)" "if (scenario === 'lost-ack' && command.kind === 'objection' && !failed)"; b obj-lost lost-ack true; git checkout -q -- .
patch "if (scenario === 'conflict' && !failed) {" "if (scenario === 'conflict' && command.kind === 'objection' && !failed) {"; b obj-conflict conflict true; git checkout -q -- .
git status --short | head -2
# control: main
cd $MAIN/frontend; git checkout -q --detach origin/main; echo "MAIN $(git rev-parse HEAD)"; b main-normal normal true 2>/dev/null; cd $MAIN/frontend && env VITE_ENABLE_FACILITATION_PREVIEW=true VITE_FACILITATION_FIXTURE_SCENARIO=normal npx vite build --outDir $V/dist-main --emptyOutDir > $V/build-main.log 2>&1; echo "main exit=$?"
git checkout -q --detach 368cceb9f3adf9a2f311564c98531b3fef69dfe3
echo FIN
