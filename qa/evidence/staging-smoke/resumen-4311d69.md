# Humo de staging · commit desplegado 4311d69 (main con ES-23, ES-25, ES-27, ES-63 y ES-64)
Entorno: https://backend-staging-e3a6.up.railway.app (Supabase real, una réplica, región us-east4). Solo HTTP, usuarios sintéticos `@example.test`, una llamada real a Claude.
- `es18-20-4311d69.jsonl`: 24 de 24. `es21-27-4311d69.jsonl`: 27 de 27 (`qa/smoke/es21-23-staging.mjs`, ahora con escrituras del puente y de la evidencia, aislamiento y borrado).
- Latencias de muestra, 20 lecturas de una cuenta (p50 / p95 en ms): career-context 134 / 141, evidence 131 / 141, consents 128 / 133, messages 111 / 125, diary 129 / ~; con el script de ES-18 a ES-20: salud 93 / 105, login 153 / 160, diario 121 / 126, consents 126 / 179. Antes de mover la región: consents 924 / 1141, diario 927 / 1440.
- Landing (navegador): ES y EN, 360 px, sin desborde; «Saltar al contenido»; las dos puertas llevan a `/login` sin parámetros; la franja de ejemplo no aparece.
- Observación: las rutas `/api/*` inexistentes con sesión devuelven el HTML de la SPA con 200 hasta que se fusione #35.
