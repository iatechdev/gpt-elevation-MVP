# ES-43 · PR #105 · head 71fefed8feb25c2ecbdfe206cb9938fb4ebbe5e2 — evidencia [QA-Claude]
Entorno: merge local con origin/main (que incluye #104), Postgres 17 con migraciones reales, API real, proveedor SIMULADO (proxy `stopmock` que fija `stop_reason`), datos sintéticos. Claude real: pendiente (T5).
- `es43-t105.mjs` (qa/integration): T1a el chat envía `max_tokens: 1500`; T1b un cierre por `max_tokens` deja el turno completo, registrado y con el texto sin alterar; T1c las propuestas de insights conservan su tope (2000); T2a/b la reserva por llamada (1967) incluye los 1500 y el cobro es el uso real (2 tokens); T2c con tope = reserva + 100 el turno cabe; T2d con tope = reserva − 100 → 429 `ai_budget_exhausted` con mensaje y sin 5xx; T2e turno fallido, sin reservas colgadas; T4 12 turnos simultáneos con proveedor de 6 s: todos 200 y completados, espectadora 52 ms. Total: 10 comprobaciones correctas.
- T3: backend `npm test` 504/504; insights 8, worker-process 13, skill-analysis 12, resume 8, bridge 7.
- El cambio es de una línea de producto (`CHAT_MAX_TOKENS = 1500` en routes/chat.js); las demás llamadas (400, 600, 2000…) no se tocan.
## Pendiente
T5: tras el despliegue, ≈10 turnos reales con prompts que piden respuestas largas y lectura de `stopReason`/`outputTokens` por requestId (≈140.000 tokens, confirmados por Mauricio). Cierra ES43-QA-01.
