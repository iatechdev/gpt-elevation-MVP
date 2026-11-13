# ES-113 · PR #98 head cb5e2fbb1ecd491c5132ef0a420003c1ebad604e (QA-Claude, 1-nov-2026)
Merge local sobre main 68eaaf9e; Postgres real; Chromium; datos sintéticos; 0 tokens de IA.
- `salida-ui.txt` / `ui/resultados-ui.json`: `qa/integration/es113-ui.cjs`, 56/57. Falla F9b (EN, 320 px, texto al 200 %): el botón «To the Bridge →» se sale 11 px.
- `salida-es138-regresion.txt`: regresión de ES-138 (script adaptado a «Guardar entrada»/«Save entry»), 56/58. T8-en es el mismo desborde; T11 «pasado mañana UTC» depende de la hora del día (regla del servidor: hasta 36 h hacia delante; el PR no toca el backend).
- `backend-suite*.txt`: backend en serie 534/535 en la primera corrida (la prueba que falló no se identificó) y 535/535 en la repetición. `pg-real.txt`: Postgres real 7/7. `npm-audit.txt`: sin altas (11 moderadas, como main).
- Débiles: F3a (el endpoint de contexto profesional devolvió 404, no prueba nada; el PR no cambia el backend) y F6c (la respuesta ilegible se simuló antes de llegar al servidor).
