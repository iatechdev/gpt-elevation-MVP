# ES-25 y ES-27 · PR #27 (2a1ade9) y #28 (29235ca) · cierre de QA-25-03
Entorno: Postgres 17 local (`qa28t`), tres servidores del head de #28 (límites altos, sin `DATA_RIGHTS_ENABLED` y con límites por defecto), proveedor simulado.
- `combinado-29235ca.jsonl`: 14 de 14. La exportación personal ahora incluye `careerContext`, `bridgeTransfers`, `evidence` y `evidenceVersions`; tras la purga las cuentas eliminadas conservan 0 versiones del puente, 0 filas de auditoría del puente, 0 evidencias y 0 versiones de evidencia.
- `run5-29235ca.jsonl`: ES-25 60/60. `run7-29235ca-es27.jsonl` (en `qa/evidence/ES-27-29-28/`): ES-27 58/58.
- `run5-29235ca-main.jsonl` (en `qa/evidence/ES-23/pr29/`): script de ES-23 sobre este head, 85/85.
- Dev: `npm test` 205/205; `test:bridge:pg` 7/7; `test:evidence:pg` 7/7; `test:integration:pg` 5/5; `test:data-rights:pg` 10/10; `npm audit --omit=dev --audit-level=high` salida 0.
