# ES-106 · PR #80 · head 19bdfac · QA-Claude
Merge local con main; Postgres real; datos sintéticos.
- npm test backend: 385/385.
- es106-real-db.mjs: 9/9 + 2 informativos (p95 con 500 huérfanas 8,5 ms frente a 3,1 ms sin ellas; umbral propuesto 100 ms).
- Regresión es94-landing.cjs: 14/14 (C03 ahora pasa).
- Mutación (landingContent.js de main): test del PR falla; es106 falla L01 y L02.
Observación: las filas huérfanas siguen en la base (solo dejan de publicarse). Las claves sin prefijo landing. guardadas se siguen publicando (comportamiento previo).
No verificado: staging.
