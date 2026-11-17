#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"; export DATA_RIGHTS_ENABLED=true
B=/c/Users/Usuario/Documents/qa-pr-253/backend; S=/c/Users/Usuario/Documents/qa13
SC=C:/Users/Usuario/Documents/gpt-elevation-qa/qa/integration/es295-servidor.cjs
cd $B
unit() { node --test test/es-301-terms.test.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
pgt() { node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgres://elevation:elevation_local@127.0.0.1:54459/postgres'});await c.connect();await c.query('DROP DATABASE IF EXISTS q295_mut WITH (FORCE)');await c.query('CREATE DATABASE q295_mut');await c.end()})()"; ES301_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54459/q295_mut JWT_SECRET=x DATA_ENCRYPTION_KEY=$(cat $S/dek) node --test test/integration/es-301-postgres.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { (cd $S && bash run184.sh mm$RANDOM $SC x pr 2>&1 | grep -E "RESUMEN|^FALLA" | cut -c1-150 | head -3); }
run_mut() { name="$1"; file="$2"; from="$3"; to="$4"; echo "== $name"
  node $S/mutapply.cjs "$file" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- .; return; }
  echo "  unit terms: $(unit)"; echo "  PG es-301: $(pgt)"; echo "  mi guion:"; mine; git checkout -q -- . ; }
T=utils/terms.js; A=routes/auth.js
echo "== base"; echo "  unit terms: $(unit)"
run_mut "m1 required:false (registro sin aceptación pasa)" $T "required: true }" "required: false }"
run_mut "m2 no comparar la versión (acepta cualquiera con forma válida)" $T "if (body.termsVersion !== config.version) throw" "if (false) throw"
run_mut "m3 fecha tomada del cliente" $T "return { termsVersion: config.version, acceptedAt: new Date() };" "return { termsVersion: config.version, acceptedAt: new Date(body.acceptedAt || Date.now()) };"
run_mut "m4 validar la aceptación solo si el correo NO existe (orden/enumeración)" $A "accepted = terms.validate(req.body); }" "accepted = (await findUserByEmail(User, email)) ? null : terms.validate(req.body); }"
run_mut "m6 acceptedTerms truthy" $T "if (body.acceptedTerms !== true) throw" "if (!body.acceptedTerms) throw"
run_mut "m7 forma de versión sin restricción" $T "const VERSION_SHAPE = /^[A-Za-z0-9._-]{1,32}\$/;" "const VERSION_SHAPE = /./s;"
git status --short | grep -v node_modules | head -3; echo fin
