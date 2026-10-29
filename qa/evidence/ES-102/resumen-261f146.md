# ES-102 · PR #75 · resumen con IA del terapeuta sin notas y con presupuesto (ES93-A2 y M5) · head 261f146 (apilado sobre #72)

[QA-Claude] · 29-oct-2026. Merge local = main 2f237a4 + #72 (fdc4d02) + #75; Postgres 17 real, seis servidores (presupuesto amplio, bajo vía proxy que informa consumo, sin presupuesto, proveedor caído, lento con tiempo límite de 3 s y respuesta vacía), IA simulada con registro del prompt.

| Bloque | Resultado |
|---|---|
| backend `npm test` / audit | 354/354 / exit 0 |
| Mutación | saltarse `callClaude` → 3 de 5 pruebas del PR fallan; reponer las notas en el prompt → 1 de 5 falla |
| Mis casos (`es102-real-db.mjs`, `run3-261f146.jsonl`) | 19 ok / 1 fallo (F03) / 3 informativos |
| Regresión | ES-101 17/17; ES-93: S09 y S10 corregidos (resto igual); ES-18/19 20/20 |
| CI del PR | job `data-rights-postgres` en ROJO; reproducido localmente: la prueba de ES-101 con Postgres real espera 200 en el resumen y recibe 503 (4 de 6) |

Verificado: con canarios en notas, instrucción maliciosa, chat y diario, el prompt al proveedor solo lleva «Total check-ins», promedio de ánimo y de valoraciones; no hay notas, nombre ni correo; las notas siguen guardadas; promedio correcto en 9 casos (sin registros N/A, 1 y 2 registros, solo entrada, solo salida, nulos, mezclados, 1 y 5) y con 30 registros; con presupuesto bajo se aceptan hasta el tope y luego 429 `ai_budget_exhausted` no reintentable, cada llamada real queda en `AiUsages` como `therapist_summary` sin contenido y un 429 no llama al proveedor; sin presupuesto 503; proveedor caído 502 reintentable sin detalles; lento (6 s) con tiempo límite de 3 s → 502 en ≈ 3 s; otro terapeuta 404, participante y administrador 403, persona con eliminación aceptada 404 sin gastar IA; cierre de sesión con presupuesto → recomendación sin la nota ni datos de la persona y registrada como `session_recommend`; con presupuesto agotado, sin configurar, proveedor caído, lento o vacío el cierre siempre se completa y la recomendación queda en null; 20 simultáneos sin 5xx y con el reparto 200/429 igual a las filas de uso; los registros del servidor sin datos.

Hallazgos:
- ES102-F03 (Bajo): respuesta vacía del proveedor → 200 con `summary: ""` en lugar de un error controlado (el chat sí rechaza la respuesta vacía).
- ES102-O1 (Bajo, fuera de #75): el mismo defecto del promedio de ánimo que Dev corrigió está en `matching.js` (líneas 49-50) y `recommendations.js` (32-33): suman entrada y salida y dividen entre los registros; el modelo recibe un promedio de hasta el doble de la escala.
- ES102-O2 (observación conocida): la pantalla del terapeuta mostrará «0 notas»; id no numérico → 500 (ES93-B1).
No verificado: contenido clínico del resumen (ES-17/ES-24), muestra con el modelo real (sin gasto autorizado) y staging.
