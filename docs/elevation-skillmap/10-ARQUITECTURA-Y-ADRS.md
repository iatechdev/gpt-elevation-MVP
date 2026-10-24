# Arquitectura: acuerdos y diseño para revisión

22-oct-2026. Este resumen concilia los ADRs propuestos del PDF con las validaciones posteriores. No certifica código o configuración existente. No cambia los ADRs originales conservados en references/.

| Documento | Acuerdo incorporado | Pendiente técnico |
| --- | --- | --- |
| RFC-001 integración | Elevation principal; SkillMap módulo; incremento acotado y puente autorizado | Contratos definitivos, trazabilidad por ticket y estimaciones. |
| ADR-001 procesamiento | Postgres + worker + Redis; Postgres durable; Redis solo IDs | Outbox/relay, leases, fencing, reintentos, límites y recuperación probada. |
| ADR-002 frontera | Credencial propia del worker; sin lectura privada; solo contexto profesional autorizado | Esquemas/roles, contrato y procedimiento controlado; validar en pooler real. |
| ADR-003 consistencia | Publicación bajo consentimiento vigente en transacción; QA prueba denegación tras revocación | SQL, orden de locks, idempotencia, purga y pruebas concurrentes. |

## Flujo propuesto compatible con los acuerdos

Selección de fragmentos del dueño → ReflectionDraft privado → edición/revisión → preview profesional → consentimiento por propósito y contexto versionado → job durable → transporte de ID en Redis → worker limitado → validación de salida → publicación condicionada → candidata revisable.

La ruta directa de entrada profesional permite omitir introspección. El dominio profesional no recibe transcripciones, diario, ánimo, crisis o identificadores privados. La procedencia profesional usa IDs propios de campos; el vínculo con el origen privado queda en el dominio privado.

Los endpoints /v1 del PDF son contratos preliminares, no rutas verificadas. Los estados propuestos son PENDING, RUNNING, REVIEW_REQUIRED, COMPLETED, FAILED, CANCELLED e INVALIDATED; su matriz de transiciones debe definirse y probarse. Aceptar una candidata no certifica competencia.

## Puntos concretos para la revisión del CTO

1. La propuesta inicial de grants del worker no basta para gestionar leases y verificar/bloquear consentimiento. Diseñar una operación controlada con permisos mínimos (por ejemplo procedimiento de publicación), sin conceder acceso al contenido privado. Auditar también acceso al propio job.
2. Revocación y publicación deben coordinarse sobre la misma fuente autoritativa. Una comprobación o un trigger que solo lee ACTIVE sin la coordinación apropiada no demuestra ausencia de carreras. Probar ambos órdenes con dos conexiones reales y pausas antes del commit.
3. La publicación necesita impedir resultados de un intento antiguo cuyo lease venció: especificar token de intento/fencing además del estado del job y la versión de consentimiento. El relay puede entregar más de una vez; las restricciones/idempotencia, no la cola, evitan duplicados lógicos.
4. El hash canónico puede detectar cambios entre preview y contexto, pero no prueba autorización por sí mismo: validar titular, campos, versión y finalidad en servidor.
5. Invalidar de forma durable antes de purgar. Mantener vínculos de derivación sin exponer IDs privados al worker. La evidencia profesional ingresada directamente conserva su origen independiente.
6. Los eventos sin texto aún pueden incluir identificadores personales: definir acceso, retención y eliminación de auditoría/telemetría; no afirmar que nunca hay nada que purgar.
7. El presupuesto necesita control de consumo concurrente y tratamiento de cargos tardíos/reintentos. V-13 obliga a pausar nuevas llamadas sin dañar resultados; no aprueba topes numéricos.

Estos puntos son revisión de diseño de Dev-Codex, no decisiones técnicas nuevas adoptadas por inferencia. No se copian como implementación SQL los ejemplos incompletos de las respuestas.
