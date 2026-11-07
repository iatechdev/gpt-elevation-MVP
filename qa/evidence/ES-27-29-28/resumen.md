# ES-27 / ES-29 / ES-28 · PR #28, #30 y #31 apilados (head 8326064)
Entorno: Postgres 17 local (`qa28c`, base nueva), servidor del head de #31, presupuesto de IA activo, proveedor simulado. Datos sintéticos.
- `run4.jsonl`: 142 de 143 casos (`qa/integration/es27-29-28-real-db.mjs`). El que falla es ES28-H01 (QA-28-01). `run1` a `run3` son corridas previas con errores de mi script (nombres de tablas, `requestId` del chat, forma del cuerpo de confirmación y base reutilizada).
- Sonda del filtro de salida: texto clínico entregado en 5 de 5 variantes sin palabras de la lista; rechazado (502) en las 4 variantes con palabras de la lista o porcentaje.
- Regresión: `reg-es18-19.jsonl` 20/20, `reg-es20.jsonl` 27/27. `npm test` 202/202, `test:evidence|skillmap|proposals:pg` 7/7, 7/7, 5/5, `npm audit` salida 0.
