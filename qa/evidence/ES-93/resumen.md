# ES-93 · Funcionalidad completa del terapeuta · ejecución del plan aprobado

[QA-Claude] · 28-oct-2026. Código: main 13a0f9f + PR #64 (merge local 10165b1). Postgres 17 real, IA simulada, sin red a terceros (Daily y Google Calendar no verificados), datos sintéticos. Decisiones 2a–2d: «a definir» (aprobado por Mauricio en el chat).

Scripts: `es93-therapist-api.mjs` (primera pasada: 46 ok / 15 fallos / 13 informativos; varios fallos eran diseño mío, ver abajo), `es93-followup.mjs` (8 ok / 6 fallos / 7 informativos), `es93-ui.cjs` (5 ok / 4 fallos / 4 informativos). Salidas: `api-run1.jsonl`, `followup-run2.jsonl`, `ui-run1.jsonl`, capturas en `capturas/`.

Errores de diseño míos corregidos en el seguimiento: S08b/S08c (la primera vez desactivé y degradé por SQL y no por la API de administración, que sí corta las sesiones: con la API pasan), URLs de la junta (`/api/junta/pending`, no `/api/junta/validations/pending`), matching (el modelo simulado debía devolver JSON válido).

Resultados por área y hallazgos: ver el informe publicado en Jira ES-93.
