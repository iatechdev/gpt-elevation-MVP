#!/bin/bash
# [QA-Claude] Mutaciones sobre PR #239 (fusión local). Cada una: aplicar, correr suites, restaurar con git checkout. Nunca stash.
export PATH="/c/Users/Usuario/tools/node22:$PATH"
SUT=/c/Users/Usuario/Documents/qa-pr-221; B=$SUT/backend; V=/c/Users/Usuario/Documents/qa13/v239
U=postgres://elevation:elevation_local@127.0.0.1:54459/postgres
cd $B
run() { # $1 nombre, $2 suites (80 | 81 | ambas)
  local r80="-" r81="-"
  if [ "$2" != "81" ]; then ES280_TEST_DATABASE_URL=$U node --test test/integration/es-280-postgres.cjs > $V/m.$1.280.log 2>&1; r80="$(grep -E '^# fail' $V/m.$1.280.log | tr -d '\n')"; fi
  if [ "$2" != "80" ]; then ES281_SKIP_HOSTILE=1 ES281_TEST_DATABASE_URL=$U node --test test/integration/es-281-postgres.cjs > $V/m.$1.281.log 2>&1; r81="$(grep -E '^# fail' $V/m.$1.281.log | tr -d '\n')"; fi
  echo "$1 | es280: $r80 | es281: $r81"
}
mut() { # $1 nombre, $2 archivo relativo a backend, $3 viejo, $4 nuevo, $5 suites
  git checkout -q -- . ;
  if node $V/mutate.cjs "$2" "$3" "$4" > $V/m.$1.apply 2>&1; then run "$1" "$5"; else echo "$1 | NO APLICADA: $(cat $V/m.$1.apply)"; fi
  git checkout -q -- .
}
case "$1" in
owner)
mut O1-diario-sin-dueno routes/diary.js "where: { id, UserId: userId, deletedAt: null }" "where: { id, deletedAt: null }" 81
mut O2-hoja-de-vida-sin-dueno utils/resumes.js "findOne({ where: { id, UserId: userId } })" "findOne({ where: { id } })" 81
mut O3-eleccion-ruta-sin-dueno utils/routes.js "Choice.findOne({ where: { UserId: userId, id } })" "Choice.findOne({ where: { id } })" 81
mut O4-plan-sin-dueno utils/careerPlan.js "Plan.findOne({ where: { UserId: userId, id: planId }, transaction })" "Plan.findOne({ where: { id: planId }, transaction })" 81
mut O5-sesion-join-sin-dueno routes/sessions.js "where: { id: req.params.id, patientId: req.user.id }," "where: { id: req.params.id }," 81
;;
guards)
mut G1-matching-confirm-sin-admin routes/matching.js "router.post('/:id/confirm', verificarAdmin," "router.post('/:id/confirm'," 81
mut G2-plan-requests-approve-sin-admin routes/planRequests.js "router.put('/admin/:id/approve', verificarAdmin," "router.put('/admin/:id/approve'," 81
mut G3-validation-approve-sin-superadmin routes/validation.js "router.post('/:id/approve', verificarSuperAdmin," "router.post('/:id/approve'," 81
mut G4-landing-put-sin-superadmin routes/landingContent.js "router.put('/', verificarSuperAdmin," "router.put('/'," 81
;;
e236)
mut E1-ruta-nueva-en-server server.js "app.use('/api/pricing',         require('./routes/pricing'));" "app.use('/api/pricing',         require('./routes/pricing'));
app.get('/api/zz/:id', (req, res) => res.status(500).json({ error: 'x' }));" 80
mut E2-ruta-nueva-en-router routes/recommendations.js "validateIdParams(router, 'id'); // ES-280" "validateIdParams(router, 'id'); // ES-280
router.get('/zz/:id', (req, res) => res.status(500).json({ error: 'x' }));" 80
mut E3-approve-error-message routes/adminPrompts.js "res.status(500).json({ error: 'No se pudo aprobar la versión. / The version could not be approved.' }); // ES-280: cuerpo fijo; nunca el texto del error interno" "res.status(500).json({ error: error.message });" 80
mut E4-apiErrors-500-con-mensaje middlewares/apiErrors.js "return res.status(500).json(FAILED);" "return res.status(500).json({ code: 'internal_error', error: String(error && error.message) });" 80
mut E5-pricing-sin-guard-id routes/pricing.js "validateIdParams(router, 'id'); // ES-280: un id no entero o fuera de rango es 404 uniforme, no un 500" "// guard quitado" 80
mut E6-apiErrors-URIError-quitado middlewares/apiErrors.js "if (error && (error.code === 'DECODE_PARAM_FAILED' || error instanceof URIError)) return res.status(400).json(BAD_REQUEST);" "" 80
;;
esac
git status --short | head -3; echo FIN-$1
