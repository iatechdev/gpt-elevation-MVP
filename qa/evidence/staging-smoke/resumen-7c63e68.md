# Humo de staging · commit desplegado 7c63e68 (main con ES-18 a ES-23, ES-80 y ES-78)
Entorno: https://backend-staging-e3a6.up.railway.app (Supabase real). Solo HTTP, usuarios sintéticos `@example.test`, una llamada real a Claude de muestra.
- `es18-20-7c63e68.jsonl`: 24 de 24 (`qa/smoke/es18-20-staging.mjs`). Latencias de muestra (ms): salud p50 153 / p95 201; login 394 / 499; GET /api/messages 460 / 571; GET /api/consents 924 / 1141; GET /api/diary 927 / 1440.
- `es21-23-7c63e68.jsonl`: 18 de 18 (`qa/smoke/es21-23-staging.mjs`): commit esperado, respuesta de crisis inmediata sin 5xx, `country`/`lang` mal formados sin 400, chat real 200 con presupuesto cargado, derechos de datos apagados (503), rutas de ES-25/27/29/31/14 aún no desplegadas.
- Observación: con sesión, una ruta `/api/*` inexistente devuelve el HTML de la SPA con 200 en lugar de 404 JSON.
- Usuarios sintéticos creados en staging: `qa-A/B/C-*`, `smoke-qa-*` y `qa-smoke21-*` (todos `@example.test`); los borra Infra.
