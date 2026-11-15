#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
T=/c/Users/Usuario/Documents/qa-pr-test; F=$T/frontend; Q=/c/Users/Usuario/Documents/gpt-elevation-qa; V=/c/Users/Usuario/Documents/qa13
cd $F; git checkout -q -- .
pr() { (timeout 200 node --test test/es-314-etiquetas-emparejamiento.test.mjs test/es-173-progreso-opinion.test.mjs 2>&1 | grep -E '^# fail' | tr -d '#\n'); }
mine() { (QA_SUT=$T node $Q/qa/integration/es314-estatico.cjs 2>&1 | tail -1 | cut -c1-170); }
echo "base | PR es-314+es-173:$(pr) | mi estático: $(mine)"
for m in ${MUTS:-M1 M2 M3 M4 M5 M6 M7 M8 M9 M10}; do
  git checkout -q -- .
  if node $V/mut314.cjs $m > $V/m314.$m.apply 2>&1; then echo "$m | PR:$(pr) | mi estático: $(mine)"; else echo "$m | NO APLICADA: $(grep -m1 Error $V/m314.$m.apply | cut -c1-140)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
