# Incremento 1: mapeo propuesto y pendientes

22-oct-2026 · Elaborado por Dev-Codex para revisión de Mauricio. No modifica tickets ni responsables. Las claves ES provienen del inventario consultado; releer cada ticket antes de cambiar alcance. Los IDs del PDF no se crean como duplicados.

| ID v0.3 | Tickets ES candidatos | Ajuste que debe revisarse |
| --- | --- | --- |
| TRUST-01 | ES-18, ES-20, ES-22 | Identidad, persistencia y recuperación; pruebas reales de acceso cruzado. |
| TRUST-02 | ES-19, ES-23, ES-25 | Propósitos, versión, revocación e invalidación de derivados. |
| ELEV-01 | ES-16, ES-21 y revisión ES-17/ES-24 | Voz, límites no clínicos y ES/EN; no confundir con funcionalidad del legado. |
| ELEV-02 | ES-20, ES-15 | Diario nuevo, privado, editable y contexto selectivo. |
| ELEV-03 | ES-25, ES-26 | Selección de fragmentos y síntesis privada editable: precisar dónde se implementan y cuánto alcance nuevo añaden. |
| BRIDGE-01 | ES-19, ES-25, ES-26 | Preview exacta, contrato y contexto inmutable aprobado; solo conclusiones profesionales cruzan. |
| MAP-01 | ES-27, ES-29, ES-22 | Candidatas con procedencia; extracción durable con worker/Redis necesita desglose explícito. |
| MAP-02 | ES-28, ES-29, ES-30 | Revisión de candidata y evidencia; nivel null mientras no exista evaluación con rúbrica. |
| UX-01 | ES-14, ES-15, ES-26, ES-28, ES-30, ES-38 | Navegación sin coerción, ES/EN y estados; revisar cobertura mínima, no incorporar pantallas posteriores por inferencia. |

Transversales: ES-8 inventario; ES-57 línea base; ES-9/10/11 infraestructura/CI; ES-44 y revisión ES-46 evaluación de IA; ES-45 E2E. El corte 1 tiene puerta ES-40; no confundirla con aceptación del incremento funcional.

## Alcance posterior conservado

Rutas, catálogo, ofertas, recursos, experimento y plan (ES-31/32/33/34 y lo que corresponda de facilitación/métricas ES-35/36) permanecen en el piloto integral. No se cancelan ni se cierran por posponerlos del incremento 1. Curación manual permitida; no usar copiado manual de datos privados como integración.

## Huecos para desglosar con Mauricio

- Job/worker/Redis, outbox, relay, lease, fencing, reconciliación, publicación idempotente y presupuesto: revisar solape con ES-22/25/29 antes de crear un ticket nuevo. El nombre A7 de las respuestas no acredita issue creado.
- Esquemas privado/profesional y rol del worker: ES-19/20/25 necesitan revisar esfuerzo y pruebas SQL.
- Síntesis y fragmentos: concretar límites respecto al puente y a la brújula; no presuponer que ya existen.
- Seguridad: revisión previa encontró nueve P1 en PR #2. La respuesta añade un posible décimo (registro con ADMIN_EMAILS sin verificar correo), pendiente de validación de QA; no declararlo cerrado ni atribuirlo a la revisión automática original.

## Pendientes por cerrar con datos

| Pendiente | Quién debe resolverlo | Evidencia de cierre |
| --- | --- | --- |
| Presupuesto IA, moneda y periodo | Alejo/Mauricio; responsable de propuesta por concretar | Topes explícitos por persona/cohorte; sin autorización ilimitada por defecto. |
| Modelo Claude y parámetros | Mauricio con evaluación | Configuración versionada y resultados de casos. |
| Nombres de dos revisores y especialista | Alejo/Mauricio | Aceptación de personas, disponibilidad y dedicación. |
| Base QA: rama o proyecto Supabase | Mauricio | Aislamiento probado y costo verificado. |
| Permisos SQL/pooler y publicación | Mauricio | Rol probado sin acceso privado y prueba de carrera de revocación. |
| Mapeo/desglose y estimaciones | Mauricio con Alejo | Tickets actualizados sin duplicados ni doble conteo de horas. |
| Plan detallado QA | QA; aprobación Alejo o Mauricio | Plan aprobado antes de ejecutar, evidencia por caso. |
| Fechas del incremento 1 y piloto | Alejo/Mauricio | Inventario, capacidad actual y reestimación. |

Las 40 h por persona eran capacidad bruta declarada para 10 días hábiles; no equivalen a capacidad restante hasta 27-oct. Las estimaciones nuevas del archivo de respuestas no están medidas y pueden solaparse con el backlog: no sumarlas como compromiso aprobado.
