# Cadena del worker de IA · PR #61 → #63 → #66 → #67 (ES-86, ES-87, ES-88, ES-89) — evidencia [QA-Claude]
Heads: #61 387becdc962a6c050682274d4fb27721ba4e18cc · #63 466921f8c0aed8101f51a34895f26872a83c6c8b · #66 b73306892d4c17265500af6f07ad482ad78b1309 · #67 2dac13fc0f69b3b74f72024d9a9114c6568bf587 (#60 ya en main).
Entorno: merge local de cada head con origin/main, Postgres 17 embebido, migraciones reales (`sequelize-cli db:migrate`), servidor API real, proceso worker REAL con el rol `elevation_worker`, IA simulada, datos y claves SINTÉTICOS. Claude real: NO ejecutado.
- `suites-etapas-1/2/3.txt`: backend `npm test` y suites `test:*:pg` por etapa. En la tanda 1 faltaban variables de base de datos de las suites antiguas (error mío; fallos de entorno, no del producto): se repitieron en las tandas 2 y 3 con sus variables.
- `e2e-2dac13f.jsonl`: es89-chain-e2e.mjs (44 correctas, 0 fallas): arranque del worker, cifrado `v2p:`, propietario/404, entradas inválidas, idempotencia, 6 altas simultáneas, worker real con salida del modelo hostil (se descartan fuera de catálogo, duplicada, nivel 9, cita falsa; se ignora confianza/notas), permisos mínimos del rol, revisión (no subir nivel), Skill Map sin nivel, exportación, revocación, cancelación y solicitud de borrado.
- `perf-2dac13f.jsonl`: es89-perf.mjs: 12 altas simultáneas (201, espectadora 161 ms), lecturas p95 11 ms, worker drena 12 jobs con proveedor de 6 s en 74 s sin duplicar.
- Purga de borrado (scripts/purgePersonalData.js) y re-cifrado (scripts/reencryptProfessional.js) ejecutados a mano en la base de la prueba: tras la purga desaparecen jobs y candidatas de la persona borrada y quedan los de las demás; simulacro no escribe, `--apply` convierte, repetir es idempotente, la reversa `--to=data` y la vuelta a `v2p:` funcionan (solo conteos impresos).

## Observaciones (sin Crítico ni Alto)
| ID | Sev. | Qué | Cómo reproducir |
|---|---|---|---|
| CH-QA-01 | Bajo | `npm test` falló de forma intermitente en la primera pasada (2 pruebas en #63, 1 en #67) y no se reprodujo en 12 repeticiones ni en 0 de 3 reintentos; tampoco `test:skillmap:pg` (1 de ~15). No identifiqué las pruebas por nombre (no guardé la salida). | Repetir `npm test` en la rama apilada; usar `node --test --test-reporter=spec` para capturar el nombre. |
| CH-QA-02 | Bajo | Sin token, las rutas responden 403 y no 401 (igual que el resto del API). | GET /api/skill-analysis/jobs sin cabecera. |
| CH-QA-03 | Bajo (no verificado en Windows) | La prueba de apagado ordenado con SIGTERM de #63 se omite en Windows; solo corre en CI (Linux). | `npm run test:worker-process:pg` en Windows: 13 pasan, 1 omitida. |
| CH-QA-04 | Info | Excepción `ProfessionalApplications` (#66, es-88-postgres.cjs:293-296): solicitudes públicas de profesionales, `userId` opcional, retención por ES-95; no entra al export/borrado de cuenta. Decisión de Mauricio, pendiente. | — |
| CH-QA-05 | Info | `npm audit --omit=dev`: 6 moderadas, las mismas que en main (no las introduce la cadena). | `npm audit --omit=dev`. |
