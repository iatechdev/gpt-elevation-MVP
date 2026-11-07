# ES-44 · PR #41 (head 419830b) · paquete PREPARATORIO de evaluación, merge local temporal con main
Alcance: arnés y corpus. NO acredita calidad de Claude ni habilita Corte 4 / piloto (rúbrica en borrador, sin revisión humana, sin proveedor real).
- El PR no toca código de runtime: solo backend/evaluation/es44, backend/test/es-44-evaluation.test.cjs, package.json (scripts), ci.yml (job offline) y docs. Por eso no repetí la regresión ES-18..22 sobre servidor.
- Dev/QA: `npm test` 264/264; es-44 unitarias 16/16; `--mode=validate` 30/30 casos válidos; `npm audit` exit 0.
- `--mode=mock`: 0 llamadas reales, controles `not_run`, puerta bloqueada. `--mode=integration`: 15 controles pasan y 15 quedan pendientes, 0 llamadas reales, 58 simuladas, puerta bloqueada. `--mode=provider`: sale 1 (`provider_execution_not_authorized`) sin cargar el adaptador. Ejecución truncada (`--max-cases=1`): sale 1, 29 `not_run`.
- Puerta: plantilla vacía de revisiones → bloqueada (30 pendientes); corpus alterado → `binding_mismatch`; argumento con ruta → `invalid_review_artifacts`; informes en carpeta ignorada por Git y sin secretos.
- Corpus (verificado): 30 casos, 24 ES / 6 EN, 21 no técnicos, 8 adversos.
- Los 5 controles adversos (ID ajeno, sin sesión, JWT revocado, cita rechazada, revocación bloquea confirmar) se verificaron de forma independiente en mis revisiones de ES-27/28/29 y ES-25 (scripts es27-29-28-real-db y es25-real-db), no repetidos aquí.
