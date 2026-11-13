# Ejecución — ES-20 / PR #18 · commit b408d61

[QA-Claude] · 26-oct-2026 · Servidor del commit contra PostgreSQL 17.10 real (base local de ES-80, base UTF8) y proveedor de IA simulado (`qa/integration/mock-anthropic.cjs`); sin llamadas reales a Claude. Datos sintéticos.

- Repo: backend 122 de 122; `npm audit --omit=dev --audit-level=high` exit 0.
- `qa/integration/es20-real-db.mjs`: 27 de 27 (run2). La primera ejecución (run1) tuvo 2 fallos del propio script (el reintento interno del SDK consumía el fallo simulado; y una expectativa equivocada del límite de la lista); se corrigieron y se repitió completa.
- Cubre: tablas e índice único creados por sync(); turno atómico (sin mensaje huérfano si falla el proveedor); idempotencia por requestId (repetición, reuso con otro mensaje → 409, 12 envíos simultáneos → 1 llamada y 1 par de mensajes); turno vencido reintentable; historial de los 20 más recientes; diario cifrado v2 con acentos y emoji, edición y borrado con invalidación sin contenido; contexto solo por selección explícita (ajenas, borradas y mezcladas → 404 sin llamar al proveedor; más de 3 → 400); aislamiento A/B; ningún rol profesional ve el diario ajeno (solo chat.js y diary.js lo leen); 36 entradas inválidas sin 500; cifrado (ida y vuelta, IV distinto, alterado/truncado/otra clave fallan, formato heredado legible); logs sin contenido privado; carga de 6 personas durante 2 min (257 578 peticiones, 0 errores 5xx, p95 4 ms, sin turnos duplicados; el proveedor es simulado).
- Exploratorio ES20-X01: reintento de un turno marcado vencido mientras el original seguía en curso → 409 y sin mensajes duplicados.
- Tamaños: lista de diario de 200 entradas acotada a 50/100; GET /api/messages con 500 mensajes = 23 KB en 10 ms, sin paginación.
