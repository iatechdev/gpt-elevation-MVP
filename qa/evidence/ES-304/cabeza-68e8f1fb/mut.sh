#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-253; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v279c; Q=/c/Users/Usuario/Documents/gpt-elevation-qa
cd $B; git checkout -q -- .
mine() { (cd $Q && QA_SUT=$SUT timeout 120 node qa/security/es304-mut-detector.cjs 2>&1 | tail -1 | cut -c1-210); }
pr() { timeout 300 node --test test/es-304-detector-normalization.test.cjs 2>&1 | grep -E '^# fail' | tr -d '#\n'; }
echo "base | PR es-304:$(pr) | mi batería: $(mine)"
for m in ${MUTS:-N2 N3 N14 N20 N21 N22 N23 N24 N25 N26 N27 Z3 Z19 Z40}; do
  git checkout -q -- .
  if node $V/mut279c.cjs $m > $V/m.$m.apply 2>&1; then echo "$m | PR es-304:$(pr) | mi batería: $(mine)"
  else echo "$m | NO APLICADA: $(grep -m1 Error $V/m.$m.apply | cut -c1-140)"; fi
  git checkout -q -- .
done
git status --short | head -2; echo FIN
