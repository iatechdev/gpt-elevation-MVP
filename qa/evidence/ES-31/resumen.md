# ES-31 · PR #33 (head 5b04598)
Entorno: Postgres 17 local (`qa33`), dos servidores del PR (con y sin `ALLOW_SYNTHETIC_CATALOG`), semilla sintética del propio PR cargada por la API. Sin IA.
- `run4.jsonl`: 104 casos (`qa/integration/es31-real-db.mjs`): 101 pasan y 3 fallan (QA-31-01: variantes de «sin porcentajes / sin futuro / reemplazo» aceptadas y publicadas). `run1` a `run3` son corridas previas con errores de mi script (forma de la lectura; borrador publicado por una prueba anterior).
- Sonda de cobertura (guardado, 8 campos de texto × 4 frases): `70 %`, `no tiene futuro` y `será reemplazado` se aceptan en todos los campos salvo `70 %` en la nota de exposición a la IA; `40 percent replacement` se rechaza siempre.
- Dev: `npm test` 170/170, `test:routecatalog:pg` 6/6, `npm audit --omit=dev --audit-level=high` salida 0. Regresión ES-18/19: 20/20 sobre el servidor del PR.
