# ES-23 · PR #29 (head 2867894) · evidencia QA

Entorno: Postgres 17 local (`db:local`, base desechable `qa29`), servidor del PR con `DATA_RIGHTS_ENABLED=true` (puerto 8099) y otro sin la variable (8098), proveedor de IA simulado. Datos sintéticos `@example.test`.

Reproducir: `qa/integration/es23-pr29-real-db.mjs` (variables en la cabecera del script). Salida: `run3.jsonl` (71 de 71). `run1` y `run2` son corridas previas con errores de mi script (rutas de administración, nombre del propósito de consentimiento).

Además: `npm test` 132/132, `test:data-rights:pg` 5/5 (base local desechable), `npm audit --omit=dev --audit-level=high` salida 0.

No verificado: fusión con `main` (conflicto en `backend/package.json` y `backend/test/support.cjs`), regresión de ES-18 a ES-22 sobre el resultado del merge, proveedores y plazos, exportación profesional, Railway/Supabase.
