#!/bin/bash
# [QA-Claude] ES-282 (PR #244): mutaciones de guardas y de es-31. Detectores: es-281 (sin batería hostil), es-282-static y, para es-31, su propia prueba.
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-221; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v244
U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B
for v in $(grep -rhoE "[A-Z0-9_]*TEST_DATABASE_URL" test/integration/*.cjs test/support/*.cjs | sort -u); do export $v=$U; done
M=/c/Users/Usuario/Documents/qa13/v239/mutate.cjs
mut() { # nombre archivo viejo nuevo
  git checkout -q -- . ; rm -f $B/routes/zz_qa.js
  if node $M "$2" "$3" "$4" > $V/m.$1.apply 2>&1; then
    a=$(ES281_SKIP_HOSTILE=1 node --test test/integration/es-281-postgres.cjs 2>&1 | grep -E '^# fail|not ok [0-9]+ - ' | head -4 | tr '\n' ' ')
    b=$(node --test test/es-282-static.test.cjs 2>&1 | grep -E '^# fail' | tr -d '\n')
    c=$(npm test 2>&1 | grep -E '^# fail' | tr -d '\n')
    echo "$1 | es-281: $a | es-282-static: $b | npm test: $c"
  else echo "$1 | NO APLICADA: $(cat $V/m.$1.apply)"; fi
  git checkout -q -- .
}
mut G1-matching-confirm-sin-admin routes/matching.js "router.post('/:id/confirm', verificarAdmin," "router.post('/:id/confirm',"
mut G2-plan-requests-approve-sin-admin routes/planRequests.js "router.put('/admin/:id/approve', verificarAdmin," "router.put('/admin/:id/approve',"
mut G3-validation-approve-sin-superadmin routes/validation.js "router.post('/:id/approve', verificarSuperAdmin," "router.post('/:id/approve',"
mut G4-landing-put-sin-superadmin routes/landingContent.js "router.put('/', verificarSuperAdmin," "router.put('/',"
mut G5-terapeuta-admite-admin middlewares/auth.js "if (req.user.role !== 'therapist') {
      return res.status(403).json({ error: 'Acceso denegado. Solo terapeutas.' });" "if (!['therapist', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado. Solo terapeutas.' });"
mut G6-borrado-sin-token routes/dataRights.js "router.post('/account/deletion-requests', verificarTokenParaBorrado, handle" "router.post('/account/deletion-requests', handle"
mut G7-admin-admite-profesional middlewares/auth.js "if (!['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });" "if (!['admin', 'superadmin', 'therapist'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado. Solo administradores.' });"
mut G8-montaje-superadmin-sin-guarda server.js "app.use('/api/superadmin', verificarSuperAdmin, adminPromptsRouter);" "app.use('/api/superadmin', adminPromptsRouter);"
mut G9-ruta-nueva-sin-guarda-en-router routes/recommendations.js "validateIdParams(router, 'id'); // ES-280" "validateIdParams(router, 'id'); // ES-280
router.get('/zz/:id', (req, res) => res.json({ ok: 1 }));"
mut G10-ruta-nueva-en-server server.js "app.use('/api/plans',           require('./routes/plans'));" "app.use('/api/plans',           require('./routes/plans'));
app.get('/api/zz-qa', (req, res) => res.json({ ok: 1 }));"
mut G11-editor-manifiesto-admite-persona middlewares/auth.js "const MANIFEST_EDITOR_ROLES = ['admin', 'superadmin'];" "const MANIFEST_EDITOR_ROLES = ['admin', 'superadmin', 'user'];"
mut G12-junta-admite-persona middlewares/auth.js "if (!['board', 'superadmin'].includes(req.user.role)) {" "if (!['board', 'superadmin', 'user'].includes(req.user.role)) {"
git status --short | head -2; echo FIN
