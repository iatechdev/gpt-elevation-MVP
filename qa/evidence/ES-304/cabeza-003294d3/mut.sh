#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v279b; Q=/c/Users/Usuario/Documents/gpt-elevation-qa
cd $B; git checkout -q -- .
mine() { (cd $Q && QA_SUT=$SUT timeout 120 node qa/security/es304-mut-detector.cjs 2>&1 | tail -1 | cut -c1-170); }
pr() { timeout 300 node --test test/es-304-detector-normalization.test.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n'; }
echo "base | PR es-304:$(pr) | mi batería: $(mine)"
for m in ${MUTS:-Z1 Z2 Z3 Z4 Z18 Z19 Z20 Z25 Z26 Z27 Z28 Z29 Z30 Z31 Z32 Z33 Z34 Z35 Z36 Z37 Z38 Z39 Z40 Z41 Z42 Z43 Z14 N1 N2 N3 N4 N5 N6 N7 N8 N9 N10 N11 N12 N13 N14 N15 N16 N17 N18 N19 N20 N21}; do
  git checkout -q -- .
  if node $V/mut279b.cjs $m > $V/m.$m.apply 2>&1; then echo "$m | PR es-304:$(pr) | mi batería: $(mine)"
  else echo "$m | NO APLICADA: $(grep -m1 Error $V/m.$m.apply | cut -c1-140)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
