# Humo desplegado — ES-18, ES-19 y ES-20 en staging · commit 6b17291 (main)

[QA-Claude] · 26-oct-2026 · Staging de Railway con Supabase (Postgres real). Solo HTTP, datos sintéticos, una llamada real a Claude.

Script: `qa/smoke/es18-20-staging.mjs`. Resultado: 24 de 24.

- Despliegue: `/api/health` 200 con `commit: 6b17291`; cabeceras de seguridad presentes.
- ES-18: el login emite `jti` e `iatMs`; logout revoca solo ese token; logout-all corta todo y un login inmediato vale; token sin jti, `alg: none` o firma alterada → 401; usuario común → 403 en rutas de terapeuta y de admin.
- A/B: B no ve el ánimo ni el diario de A (404 al leer, editar y borrar); la entrada con acentos y emoji vuelve intacta (UTF-8 en Supabase).
- ES-19: B no ve el consentimiento de A; 20 primeras decisiones simultáneas → 200 y un solo evento; 20 contradictorias → sin 5xx y estado final = último evento; `necessary` → 409.
- ES-20: chat con Claude real 200 (3002 ms); repetir el requestId → respuesta repetida en 402 ms, sin duplicados; turno `completed` y un solo par de mensajes; otro usuario no ve turno ni mensajes; contexto con entrada ajena → 404 en 350 ms (sin llamar a Claude); entradas inválidas → 400/404.
- Barrido sin sesión: 69 mutaciones → todas 401/403.
- Latencias de muestra (p50/p95, ms): health 160/168, GET /api/diary 592/1023, GET /api/consents 597/625, GET /api/messages 349/398, login 305/311. Dentro del umbral propuesto (≤ 1500 ms p95).
- Usuarios sintéticos creados: qa-A, qa-B, qa-C (@example.test, sufijo 1793016138266). No hay ruta de borrado para el usuario: los elimina Infra en la base.
