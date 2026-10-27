# ES-23 · PR #29 · head 6699d93 (segunda revisión)

Entorno: Postgres 17 local (`db:local`, base `qa29b`), tres servidores del PR (límites altos, límites por defecto y sin `DATA_RIGHTS_ENABLED`), proveedor de IA simulado, presupuesto de IA activo. Datos sintéticos.

- `run4.jsonl`: 85 de 85 casos propios (`qa/integration/es23-pr29-real-db.mjs`).
- Regresión sobre el head ya fusionado con `main`: ES-18/19 20 de 20 (`reg-es18-19.jsonl`), ES-20 27 de 27 (`reg-es20.jsonl`), `npm test` 177 de 177, `test:data-rights:pg` 8 de 8, `npm audit --omit=dev --audit-level=high` salida 0.
- ES-21 y ES-22 se cubren con `npm test`; sus scripts de integración necesitan servidores propios y no se repitieron.

Nota de método: `reg-*` y `run4` dependen del limitador de login (10 por minuto); si un script falla con 403/429 en el login, esperar un minuto y repetir.
