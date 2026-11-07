# ES-25 · PR #27 (head cefa4be)
Entorno: Postgres 17 local (`qa25`), servidor del PR con presupuesto de IA activo, proveedor simulado. Datos sintéticos.
- `run1.jsonl`: 59 de 60 casos (`qa/integration/es25-real-db.mjs`). El que falla es ES25-K01 (10 confirmaciones simultáneas, ver QA-25-01).
- QA-25-01 reproducido por separado: 3 simultáneas → 0 de 12 con 5xx; 5 → 0 de 20; 10 → 7 de 40 (SequelizeUniqueConstraintError tras 6 intentos).
- `npm test` 172/172, `test:bridge:pg` 6/6, `npm audit --omit=dev --audit-level=high` salida 0.
