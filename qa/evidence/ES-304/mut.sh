#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v279; Q=/c/Users/Usuario/Documents/gpt-elevation-qa
cd $B; git checkout -q -- .
mine() { (cd $Q && QA_SUT=$SUT timeout 120 node qa/security/es304-mut-detector.cjs 2>&1 | tail -1 | cut -c1-150); }
pr() { timeout 300 node --test test/es-304-detector-normalization.test.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n'; }
echo "base | PR es-304:$(pr) | mi batería: $(mine)"
for m in ${MUTS:-Z1 Z2 Z3 Z4 Z5 Z6 Z7 Z8 Z9 Z10 Z11 Z12 Z13 Z14 Z15 Z16 Z17 Z18 Z19 Z20 Z21 Z22 Z23 Z24 Z25 Z26 Z27 Z28 Z29 Z30 Z31 Z32 Z33 Z34 Z35 Z36 Z37 Z38 Z39 Z40 Z41 Z42 Z43 Z44 Z45 Z46 Z47 Z48}; do
  git checkout -q -- .
  if node $V/mut279.cjs $m > $V/m.$m.apply 2>&1; then echo "$m | PR es-304:$(pr) | mi batería: $(mine)"
  else echo "$m | NO APLICADA: $(grep -m1 Error $V/m.$m.apply | cut -c1-140)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
