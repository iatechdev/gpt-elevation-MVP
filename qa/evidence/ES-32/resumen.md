# ES-32 · PR #43 (head b54d364), sobre main (merge local temporal)
Entorno: Postgres embebido local (`qa43`), servidor del PR con `ALLOW_SYNTHETIC_CATALOG=true` y `DATA_RIGHTS_ENABLED=true`, catálogos sintéticos (rutas del propio PR; habilidades de QA). Sin IA.
- Dev: `npm test` 274/274; `test:routes:local` 25/25 (ES-32 + ES-23); `npm audit --omit=dev --audit-level=high` sin altas (6 moderadas preexistentes en `uuid`; el PR no añade dependencias).
- QA: `run3.jsonl` = 95 casos (`qa/integration/es32-real-db.mjs`), 94 pasan y 1 falla: ES32-F01 (QA-32-01, ver Jira). `run1`/`run2` son corridas previas del desarrollo del script (run2: 93/95; D01 era una expectativa mía equivocada: con eliminación pendiente la sesión ya está revocada y responde 401 en vez de 403).
- Regresión ES-18/19 sobre el servidor del PR: 20/20 (`reg-es18-19.jsonl`).
- Migración `migrateRoutes.js` dos veces: sin error; índices únicos 4/3/3.
- Registro del servidor tras las corridas: sin el canario de la nota ni correos sintéticos, sin trazas.

## Re-revisión del head e7cbbd4 (cierre de QA-32-01)
Dev: `npm test` 274/274; `test:routes:local` 26/26 (ahora con pool 5 y prueba de regresión). QA: `run4-e7cbbd4.jsonl` 95/95 (ES32-F01 y F02 pasan: 12 escrituras de una persona → 1×201 y 11×409 en <450 ms, lectura de otra sesión 19 ms); sonda: 8 personas escriben a la vez 201 en ~160 ms, 8 eligen a la vez 201 en ~350 ms. Regresión ES-18/19 20/20.
Cambio de comportamiento a notar: si la base cambia entre la lectura y la confirmación, la elección se guarda marcada basisChanged (antes se revertía con 409); no autoriza experimento.
