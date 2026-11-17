[QA-Claude] PLAN DE PRUEBAS — PR #309 (ES-325 / E273-1: métricas del piloto en bandas, sin `missing`, suprimidas si todas las respuestas son iguales)

Cabeza: f1c1f73a1d144b5305b31ff9abf541ce305c0d8a. Hoy el PR está BLOCKED y la CI en curso (solo `evaluation` verde): no ejecuto hasta ver CI 4/4 y CLEAN sobre la cabeza exacta y tu «Ejecuta». Solo backend: `utils/pilotFeedback.js` (+10 −2), `routes/pilotFeedback.js` (comentario) y la prueba `es-173-postgres.cjs`. Sin pantallas ni textos: `PilotMetricsPage` solo lee fixtures sintéticas, así que no hay prueba de navegador (ni va a QA-Claude-2).

**Lo que leí en el diff y condiciona el plan**
- `ready` solo si `eligible ≥ 5 ∧ responded ≥ 5 ∧ 0 < positive < responded`; los conteos salen como `{min,max}` con `floor(n/5)*5 … +4`; `missing` desaparece.
- Es una mitigación, no una garantía: el estado `ready`/`suppressed` en sí es una señal (p. ej. con 5 respondientes todos positivos la métrica está suprimida; si una persona cambia a negativo, aparece). Y quien cruza un borde de banda mueve la banda (Dev lo declara). Mi trabajo es **medir cuánto queda visible** y que lo visible sea solo lo declarado, no demostrar que no queda nada.
- El retraso de la publicación (punto 4) NO está en el PR: lo verifico como «no incluido», no como cumplido.

**Entorno:** servidor REAL (`server.js` de la cabeza fusionada con main) + PostgreSQL desechable local con migraciones reales, personas sintéticas `@example.invalid` creadas por la API real (consentimiento y respuestas por HTTP), 0 IA, 0 costo. Nada contra staging ni producción.

| ID | Qué | Esperado |
|---|---|---|
| S1 Alcance | El diff son 3 archivos de backend; 0 cambios en `frontend/`, textos, respuestas individuales ni permiso; el frontend no necesita rebuild | sin efecto en pantallas |
| S2 Contrato | Forma exacta de la respuesta: `{ minPeople, metrics[] }`; en `ready`, `counts` con solo `eligible/responded/positive`, cada uno `{min,max}`; sin `missing`, sin ids, correos, nombres ni respuestas; `suppressed` sin `counts`; orden de métricas intacto | forma estricta |
| S3 Bandas | Con 5…32 personas reales: `min = floor(n/5)*5`, `max = min+4` para eligible, responded y positive; nunca `min > n` ni `max < n` | exacto |
| S4 Supresión | Matriz listening y utility: responded = 5 con positive = 0,1,2,3,4,5 (0 y 5 suprimidas; 1–4 publicadas); eligible 8 con responded 4 (suprimida); responded ≥ 5 con eligible < 5 imposible; «not_explored» no cuenta como respondida en utility; 4 personas = suprimida, 5 = publicada | según la regla |
| S5 **Diferencias** (el centro) | Desde una rejilla de estados base (eligible 5–12, responded 5–eligible, varios positive) aplico UNA acción de una persona (primera respuesta, cambiar respuesta sin cambiar positiva/negativa, cambiar de positiva a negativa, retirar respuesta, revocar permiso, volver a darlo, cuenta desactivada, eliminación pendiente) y comparo el JSON publicado antes/después. Clasifico cada transición: invisible / visible por borde de banda / visible por cambio de estado (suprimida↔publicada). Lo mismo contra **main** como control. Reporto el porcentaje visible por tipo de acción y la lista completa de lo que queda visible | **0 transiciones visibles en el interior de una banda**; lo visible se limita a bordes y a frontera de supresión; en main casi todo es visible (control) |
| S6 Propiedad y acceso | Sin token = 401; usuario, profesional y terapeuta = 403; administrador y superadministrador = 200; sin `Cache-Control` que permita guardar el agregado en una caché compartida (lo anoto si falta); sin identidad ni respuestas | solo administración |
| S7 Respuestas y permiso sin cambios | `GET/PUT/DELETE /api/me/pilot-feedback` y consentimientos: mismas formas y códigos que en main (pareado); retirar el permiso no borra lo respondido; retirar la respuesta la vacía | iguales a main |
| S8 Robustez | Tormenta de permisos: 12 personas concediendo y revocando mientras consulto el agregado 60 veces: invariantes `responded.max ≤ eligible.max`, `positive.max ≤ responded.max`, sin valores negativos ni NaN, 0 × 500; método y query inválidos en la ruta | sin 500 |
| S9 Rendimiento | GET del agregado con 200 personas sintéticas (p50/p95, n=30) y número de consultas (una). **Umbral propuesto (lo apruebas tú):** p95 < 500 ms en local | propuesta |
| S10 Mutaciones (6) | quitar `positive > 0`; quitar `positive < responded`; `BAND = 1` (exacto); devolver `missing`; `floor` → `round`; `MIN_PEOPLE` 5 → 3. Deben detectarlas la prueba del PR y/o mi guion | detectadas |
| S11 Regresión | backend `npm test`; PostgreSQL es-173 (14/14), es-175, es-274, es-306; frontend `npm test` sin cambios | verde |

**Fuera de alcance / no verificable:** el retraso o instantánea (punto 4, decisión pendiente); `PilotMetricsPage` real (se adapta cuando se conecte); retención del agregado (pendiente de Alejo); coaliciones que conocen a todas las demás personas y el borde exacto (límite declarado: lo cuantifico en S5, no lo elimino); Railway/staging; más de una réplica.

**Criterio de salida:** sin Crítico/Alto; S5 con 0 transiciones visibles en el interior de una banda y lo visible acotado y documentado; S2/S6/S7 exactos; un 500, un dato individual en la respuesta o `missing` presente = no se aprueba. Los hallazgos de S5 sobre bordes y fronteras de supresión los reporto como Observación (límite declarado) salvo que Dev afirme algo más fuerte.

**Pido:** «Ejecuta» y aprobar el umbral de S9. Y una decisión de producto que no es mía: ¿la frontera suprimida↔publicada (positive 0/todas) se acepta como límite conocido junto al del borde de banda?
