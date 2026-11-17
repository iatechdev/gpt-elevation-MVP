#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
S=/c/Users/Usuario/Documents/qa13; V=$S/v312
W=/c/Users/Usuario/Documents/qa-pr-test; F=$W/frontend/scripts/audit-gate.cjs
cd $W/frontend
BASE=$(cat $V/fake-base.txt | sed 's/ |.*//' | md5sum | cut -c1-8)
run_mut() { name="$1"; from="$2"; to="$3"; echo "== $name"
  node $S/mutapply.cjs "$F" "$from" "$to" || { echo "  NO APLICA"; git -C $W checkout -q -- .; return; }
  echo "  prueba del PR: $(node --test test/audit-gate.test.mjs 2>&1 | grep -E '^# (pass|fail)' | tr '\n' ' ')"
  bash $V/run-fake.sh 2>&1 | sed 's/ |.*//' > $V/fake-mut.txt
  echo "  mi guion (npm falso): $(diff <(sed 's/ |.*//' $V/fake-base.txt) $V/fake-mut.txt | grep -c '^>') casos cambian de exit"
  diff <(sed 's/ |.*//' $V/fake-base.txt) $V/fake-mut.txt | grep '^>' | head -3
  git -C $W checkout -q -- .
}
run_mut "m1 sin comparación de fecha" "!Number.isFinite(lastDay) || today > lastDay" "!Number.isFinite(lastDay)"
run_mut "m2 excepción por paquete" "exceptions.find(candidate => candidate.id === id)" "exceptions.find(candidate => item.package === 'picomatch')"
run_mut "m3 informe sin formato pasa" "if (!vulnerabilities) return { ok: false," "if (!vulnerabilities) return { ok: true,"
run_mut "m4 solo 'high' (sin critical)" "new Set(['high', 'critical'])" "new Set(['high'])"
run_mut "m5 exit 0 siempre" "process.exit(result.ok ? 0 : 1)" "process.exit(0)"
run_mut "m6 JSON ilegible no sale con 2" "process.exit(2) }
  if (report.error)" "report = {} }
  if (report.error)"
git -C $W status --short | head -3; echo fin
