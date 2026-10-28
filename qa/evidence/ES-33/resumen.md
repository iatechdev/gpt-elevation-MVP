# ES-33 · PR #44 (head c847dd6), merge local temporal con main
Entorno: Postgres local real (base nueva por corrida), módulos del PR en el proceso de prueba con el pool POR DEFECTO de producción (5). Solo los puertos ES-14 y ES-32 se sustituyen por dobles, y únicamente después de comprobar que en runtime responden 503 `*_contract_pending`. Sin IA.
- Dev: `npm test` 266/266; `test:career-plan:local` 30/30 (su arnés usa pool 15).
- QA: `run3.jsonl` = 80 casos (`qa/integration/es33-real-db.mjs`), 79 pasan; falla ES33-F01 (QA-33-01). `run3-pool15.jsonl` = 80/80 (mismo script con pool 15: las 6 creaciones simultáneas responden 201 en ~190 ms). `run1`/`run2` son corridas previas del desarrollo del script (errores míos de orden: crear evidencia después de abrir el experimento cambia su base, comportamiento documentado en el contrato).
- Observación de diseño (QA-33-02, Medio): evidencia nueva confirmada cambia la base (`needs_review`, 409 al continuar) y el rebase reinicia el experimento a `ready`; la entrega previa solo queda en el historial. Está documentado en el contrato (§Huella), la decisión es del PO.

## Re-revisión del head c0ba7f1 (cierre de QA-33-01)
Dev: `npm test` 271/271 (una primera pasada mostró 1 fallo en 272 que no se reprodujo en 5 repeticiones; no capturé el nombre), `test:career-plan:local` 31/31. QA: `run4-c0ba7f1.jsonl` 80/80; `run5-c0ba7f1.jsonl` 82/82 con casos nuevos F02 (6 cadenas completas simultáneas: 800 ms, 0 errores) y F03 (12 cambios de una persona: 1×201, 11×409, <120 ms); `run6-c0ba7f1-pool2.jsonl` 82/82 con pool 2. Creación simultánea de 6 personas con pool 5: 201 en ~200 ms (antes 6×503 a 30 s).
No cubierto por mí: recordatorios con consentimiento concedido en concurrencia (ruta que anida la transacción de consentimiento).
