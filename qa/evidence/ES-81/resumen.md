# ES-81 / PR #23 @ 97f202a — ejecución del plan (QA-Claude)
Entorno: Postgres 17 local (ES-80, UTF8), datos sintéticos, sin llamadas a Claude.
- C1: `npm run test:db` x3 -> 13/13, 5-7 s.
- C2: 5 mutaciones (FOR UPDATE y reintento del presupuesto; SHARE, UPDATE y reintento del consentimiento) -> todas detectadas.
- C3: se niega con NODE_ENV=production, host remoto, sin TEST_DATABASE_URL, solo DATABASE_URL, 127.0.0.1.evil.test.
- C4: tras matar una ejecución queda 1 base es_harness_* y la siguiente no la borra (QA-81-01, Bajo).
- C5/C6: sin secretos; sin cambios en routes/models/utils/middleware; audit 0.
- C7: 158/158; con main + #24: 162/162.
- QA-81-02 (Medio): #23 incluye copia vieja de archivos de ES-80 (sin UTF8, puerto Docker abierto, sin aviso npm ci).
Reproducir: `TEST_DATABASE_URL=postgres://<usuario-local>:<clave-local>@127.0.0.1:<puerto>/elevation_dev npm run test:db` en backend/ del PR.
