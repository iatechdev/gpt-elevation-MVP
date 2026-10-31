# ES-59 fase 1 · PR #50 (head 8565df9), merge local temporal con main
Entorno: Postgres local desechable (puerto 54459), bases nuevas por caso, sin red externa, sin IA.
- Dev: `npm test` 248/248; `test:data-rights:pg` 11/11; `npm audit --omit=dev --audit-level=high` exit 0.
- `db:drift`: columnas 330/330, índices 72/72, restricciones 59/59, sin deriva también tras deshacer y reaplicar. Con un campo añadido a Consent.js (solo en mi copia, revertido) falla: «solo en sync: Consents.qaDrift», exit 1.
- `db:drift` se niega con una URL no local y con NODE_ENV=production.
- `db:migrate` sobre base vacía: 3 migraciones, 37 tablas; segunda ejecución sin efecto. `scripts/migrateDataRights.js` sobre base vacía crea DeletionRequests y ExportRequests.
- Camino documentado para staging (registrar línea base y ES-23 en SequelizeMeta y luego migrar): quita export_requests_owner_expiry, datos intactos, repetir no hace nada.
- Servidor sobre la base migrada: health 200; regresión ES-18/19 20/20; log sin credenciales.
- Hallazgos: QA-59-01 (Medio): `undo:all` negado por la línea base ya revirtió las migraciones posteriores (recrea el índice duplicado y borra sus filas de SequelizeMeta), también con NODE_ENV=production; sin pérdida de datos. QA-59-02 (Bajo): `db:migrate` directo sobre una base creada por sync() + ES-23 manual falla con «relation "deletion_requests_status" already exists» (solo el camino documentado funciona). QA-59-03 (Bajo): el comentario de `.sequelizerc` dice que el CLI no recoge el `.cjs` de ES-23, pero sí lo ejecuta (lo lista como migrated y su `up` vuelve sin hacer nada).

## Re-revisión del head 7e7811a (diff de 4 archivos respecto a 8565df9)
`guard-down.cjs` se aplica al down de la migración de limpieza (la primera que deshace `undo:all`; el down de ES-23 y el de la línea base ya eran inertes o protegidos). Probado: `undo:all` sin permiso, con NODE_ENV=production y `undo` de una migración se niegan desde la primera migración y dejan SequelizeMeta=3, índices=2 y 37 tablas intactos; con permiso en desarrollo deshace las 3 y reaplica a 37 tablas. `db:drift` sin deriva, `npm test` 248/248, ES-23 11/11. QA-59-01 cerrado; QA-59-02 (aviso en docs) y QA-59-03 (comentario) leídos en el diff.
