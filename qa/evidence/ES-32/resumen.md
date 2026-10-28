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

## Re-revisión del head 32a537c (main 60b7c13; migración con contrato de sequelize-cli; excepción de CHECK en db:drift)
Backend `npm test` 282/282, `npm audit` 0; `db:drift` sin deriva (columnas 367, índices 84, restricciones sync=68 y migraciones=74: 6 CHECK solo en migraciones, informativos); es-32 y es-23 en Postgres 27/27. Mi es32-real-db contra una base creada con `db:migrate` (CHECK activos en las tres tablas) y el servidor del PR: 95/95; ES-18/19 20/20. Hallazgos: QA-43-01 (Medio): la excepción es genérica; añadiendo en una migración de prueba un CHECK ajeno a ES-32 en `Users` (revertido), `db:drift` lo informa y sigue en «SIN DERIVA». QA-43-02 (Medio): en una base tipo staging (tablas creadas por `sync()` y línea base registrada), la migración usa `CREATE TABLE IF NOT EXISTS` y no añade los CHECK (0 frente a 6 en una base nueva): staging y bases nuevas quedan con restricciones distintas. QA-43-03 (Bajo): el nombre `20261028-es32-routes.cjs` ordena antes que `20261028010000-...` por el guion; sin efecto hoy, pero el patrón AAAAMMDDHHMMSS de la documentación no se cumple.
