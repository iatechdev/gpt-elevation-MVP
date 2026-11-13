#!/bin/bash
# [QA-Claude] ES-278 (PR #245): mutaciones de la validación; detectores: es-278 del PR, p1-2-pricing y mi batería
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-221; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v245; QA=/c/Users/Usuario/Documents/gpt-elevation-qa
U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
M=/c/Users/Usuario/Documents/qa13/v239/mutate.cjs
mut() {
  git checkout -q -- backend 2>/dev/null; git checkout -q -- . 
  if node $M "$2" "$3" "$4" > $V/m.$1.apply 2>&1; then
    a=$(node --test test/integration/es-278-postgres.cjs 2>&1 | grep -E '^# fail' | tr -d '\n')
    b=$(node --test test/p1-2-pricing.test.cjs 2>&1 | grep -E '^# fail' | tr -d '\n')
    c=$(cd $QA && TAG=m QA_SUT=$SUT QA_OUT=$V QA278_DB=$U timeout 300 node qa/integration/es278-propios.cjs 2>&1 | grep -E '^RESUMEN' | tr -d '\n')
    echo "$1 | es-278 del PR: $a | p1-2-pricing: $b | mi batería: $c"
  else echo "$1 | NO APLICADA: $(cat $V/m.$1.apply)"; fi
  git checkout -q -- .
}
V1=utils/pricingValidation.js
mut M1-precio-inventado $V1 "if (creating && !has('price')) return fail('price', 'price_required'); // nunca se inventa un precio" "// precio inventado"
mut M2-slug-rango $V1 "const SLUG = /^[a-z0-9-]{1,20}\$/;" "const SLUG = /^[a-z0-9-]{1,200}\$/;"
mut M3-precio-decimales $V1 "/^\d{1,8}(\.\d{1,2})?\$/" "/^\d{1,12}(\.\d{1,4})?\$/"
mut M4-sin-409 routes/pricing.js "const uniqueConflict = (error) => error && error.name === 'SequelizeUniqueConstraintError';" "const uniqueConflict = (error) => false;"
mut M5-nombre-255 $V1 "const MAX_NAME = 255;" "const MAX_NAME = 5000;"
mut M6-put-usa-cuerpo-crudo routes/pricing.js "if (checked.values[k] !== undefined) updates[k] = checked.values[k];" "if (req.body[k] !== undefined) updates[k] = req.body[k];"
mut M7-put-sin-validar routes/pricing.js "const checked = validatePlan(req.body, { creating: false });
    if (!checked.ok) return res.status(checked.status).json(checked.body);" "const checked = { ok: true, values: req.body };"
mut M8-orden-tope $V1 "const MAX_ORDER = 1000000;" "const MAX_ORDER = 1000000000;"
mut M9-moneda-longitud $V1 "const CODE = /^[A-Za-z]{3,10}\$/;" "const CODE = /^[A-Za-z]{3,50}\$/;"
git status --short | head -2; echo FIN
