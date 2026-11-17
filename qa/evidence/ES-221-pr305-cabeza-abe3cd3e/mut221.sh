#!/bin/bash
export PATH="/c/Users/Usuario/tools/node22:$PATH"
B=/c/Users/Usuario/Documents/qa-pr-253/backend; S=/c/Users/Usuario/Documents/qa13
cd $B
export NODE_PATH=$B/node_modules
unit() { node --test test/es-221-limite.test.cjs test/p1-1-registration.test.cjs test/es-128-password-policy.test.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
pgt() { node -e "const {Client}=require('pg');(async()=>{const c=new Client({connectionString:'postgres://elevation:elevation_local@127.0.0.1:54459/postgres'});await c.connect();await c.query('DROP DATABASE IF EXISTS q221_mut WITH (FORCE)');await c.query('CREATE DATABASE q221_mut');await c.end()})()"; ES221_TEST_DATABASE_URL=postgres://elevation:elevation_local@127.0.0.1:54459/q221_mut JWT_SECRET=x DATA_ENCRYPTION_KEY=$(cat $S/dek) node --test test/integration/es-221-postgres.cjs 2>&1 | grep -E "^# (pass|fail)" | tr '\n' ' '; }
mine() { (cd $S && bash run221.sh mm$RANDOM pr "$1" "$2" "${3:-30}" none 2>&1 | grep -E "RESUMEN|^FALLA" | cut -c1-170 | head -3); }
run_mut() { name="$1"; file="$2"; from="$3"; to="$4"; cases="$5"; senv="$6"; exp="$7"; echo "== $name"
  node $S/mutapply.cjs "$file" "$from" "$to" || { echo "NO APLICA"; git checkout -q -- .; return; }
  echo "  unit: $(unit)"; echo "  PG es-221: $(pgt)"; echo "  mi guion ($cases):"; TIMING_N=10 mine "$cases" "$senv" "$exp"; git checkout -q -- . ; }
A=routes/auth.js; L=utils/loginRateLimit.js
echo "== base"; echo "  unit: $(unit)"
run_mut "m1 sin registerLimiter" $A "router.post('/register', registerLimiter, validateBody" "router.post('/register', validateBody" "limit" ""
run_mut "m2 limitador después de validateBody" $A "registerLimiter, validateBody({ name: nonempty, email: nonempty, password: nonempty }), async" "validateBody({ name: nonempty, email: nonempty, password: nonempty }), registerLimiter, async" "limit" ""
run_mut "m4 403 de inactiva de vuelta" $A "if (existing) return res.status(400).json({ error: 'El correo ya está registrado.' });" "if (existing) return res.status(existing.active === false ? 403 : 400).json({ error: 'El correo ya está registrado.' });" "func" "REGISTER_RATE_LIMIT_MAX=100000"
run_mut "m5 env respetado en producción" $L "if (env.NODE_ENV === 'production' || env.RAILWAY_ENVIRONMENT_ID) return REGISTER_DEFAULT_MAX;" "if (false) return REGISTER_DEFAULT_MAX;" "limit" "NODE_ENV=production REGISTER_RATE_LIMIT_MAX=100000"
run_mut "m6 aceptación solo si el correo NO existe (orden)" $A "accepted = terms.validate(req.body); }" "accepted = (await findUserByEmail(User, email)) ? null : terms.validate(req.body); }" "func" "REGISTER_RATE_LIMIT_MAX=100000"
run_mut "m7 max sin validar (acepta negativos)" $L "return Number.isInteger(value) && value > 0 ? value : REGISTER_DEFAULT_MAX;" "return value || REGISTER_DEFAULT_MAX;" "limit" ""
# m3: hash después de la consulta (dos parches)
echo "== m3 hash después de la consulta"
node $S/mutapply.cjs $A "const hashedPassword = await bcrypt.hash(password, 10);

    // Verificar" "let hashedPassword;

    // Verificar" && node $S/mutapply.cjs $A "await User.create({ name, email: normalizeEmail(email), password: hashedPassword," "hashedPassword = await bcrypt.hash(password, 10); await User.create({ name, email: normalizeEmail(email), password: hashedPassword," && { echo "  unit: $(unit)"; echo "  PG es-221: $(pgt)"; echo "  mi guion (timing):"; TIMING_N=10 mine timing "REGISTER_RATE_LIMIT_MAX=100000"; } || echo "NO APLICA m3"
git checkout -q -- .
git status --short | grep -v node_modules | head -3; echo fin
