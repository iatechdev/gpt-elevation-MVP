# ES-96 · PR #74 · agotamiento del pool (es96-pool.mjs) · QA-Claude
GET /api/therapist/pacientes/:id/historial, personas con autorización, N lecturas simultáneas, pool de Sequelize por defecto (5), Postgres local.
- N=3: 200 todas, 0,45 s. N=4: 200 todas, 0,11 s. N=5: 200 todas, 1,9 s.
- N=8: estados 200/503/500, máximo 68 s, 8 lecturas > 3 s, 3 errores 5xx.
- N=12: estados 200/500/503, máximo 31 s, 12 lecturas > 3 s, 9-10 errores 5xx (dos corridas).
- Control: mismo servidor y misma máquina con DB_POOL_MAX=20, N=12: todas 200, máximo 0,85 s.
Causa probable (código): utils/consent.js withConsent abre una transacción (1 conexión) y utils/therapistAccess.js withPatientData llama fn(patient) sin pasarle esa transacción; las consultas internas piden otra conexión. Con ≥ 5 lecturas simultáneas todas las conexiones quedan retenidas y las internas esperan hasta el acquire de 30 s.
