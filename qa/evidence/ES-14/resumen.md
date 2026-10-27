# ES-14 · PR #32 (head 74f0f79)
Entorno: Postgres 17 local (`qa14`), servidor del PR que sirve el frontend compilado (mismo origen, como producción), navegador del panel. Datos sintéticos.
- `run2.jsonl`: 61 de 61 casos de API (`qa/integration/es14-real-db.mjs`). `run1` falló solo el caso de migración por una llamada mía con la firma equivocada.
- Dev: backend `npm test` 168/168, `test:context:postgres` 9/9, frontend `lint` 0 avisos, 18/18 pruebas, `audit` 0; backend `audit --omit=dev --audit-level=high` salida 0.
- Navegador: login de usuario nuevo → `/app/onboarding`; borrador, recarga y recuperación; estados 503, red, 400, 401 y 409; tres puertas (el cuerpo de la petición no lleva la puerta; la profesional y la «pronto» confirman sin ruta; la personal va al dashboard); «Mi contexto»; EN completo; Volver y Atrás con aviso; 320 px sin desborde y objetivos de 44 px; contraste ≥ 7:1; salto al contenido y foco de 3 px; reducción de movimiento; nada del contexto en el almacenamiento del navegador; login de usuario con contexto completo → dashboard.
- Bundle: JS 526.420 bytes (main 522.249, +0,8 %); CSS 54.317 (main 30.120, +80 %; gzip 9,2 kB frente a 6,2 kB).
- Integración con ES-23: `git grep ParticipantContext` sobre el head de #29 no encuentra nada.
