> Material de referencia anterior a la consolidación del 22-oct-2026. Para decisiones vigentes y pendientes, consultar [el índice](00-LEEME.md). Las preguntas y estimaciones históricas no sustituyen los acuerdos posteriores ni el estado real de Jira.

# Reunión con Mauricio: decisiones y fuente de verdad

Preparado el 22 de octubre de 2026 para Alejo (producto) y Mauricio (CTO/Tech Lead). Agenda propuesta, no acta de acuerdos. Duración sugerida: 60–75 minutos; si falta evidencia, asignar responsable y fecha de respuesta en lugar de cerrar por suposición.

Las respuestas de la validación paso a paso se conservan en el [registro de validación](08-REGISTRO-VALIDACION-CTO.md). La ubicación del índice canónico ya está aprobada; su publicación y las demás reglas pendientes deben distinguirse de ese acuerdo.

## Objetivo

Salir con una definición compartida del primer incremento, sus condiciones de aceptación, las decisiones técnicas que faltan y un lugar inequívoco para consultar la versión vigente. No aprobar el piloto integral por completar una entrega parcial.

Material de referencia: [PRD local con decisiones aprobadas](02-PRD.md), paquete PDF en `references/Paquete_CTO_v0.3.pdf` (PRD propuesto, RFC-001 y ADR-001/002/003), [plan inicial de HUs](04-SPRINT-2-HUS.md), [procedimiento de Jira](06-JIRA-DESARROLLO.md), [ES-8](https://iatech-team-xqxmjki1.atlassian.net/browse/ES-8), [ES-57](https://iatech-team-xqxmjki1.atlassian.net/browse/ES-57) y [PR #2](https://github.com/iatechdev/gpt-elevation-MVP/pull/2). Volver a consultar tickets y revisiones antes de la reunión: sus estados pueden cambiar.

## Punto de partida ya aprobado por Alejo

| Tema | Decisión vigente |
| --- | --- |
| Repositorio central | `iatechdev/gpt-elevation-MVP`; integración mediante PR hacia `main`. |
| Aplicación | `frontend/` React/TypeScript y `backend/` Express/Sequelize/Postgres. |
| IA del producto | Claude. Modelo concreto, configuración y presupuesto requieren definición. |
| Hosting objetivo | Railway, manteniendo Postgres en Supabase. Su aprobación no acredita aprovisionamiento o despliegue. |
| Next.js | Fuera del alcance activo; conservar trabajo como referencia. |
| Límites de producto | Apoyo no clínico, privacidad del diario/chat y transferencia profesional explícitamente autorizada. |

V-10 aprueba la opción Postgres + worker + Redis para el incremento 1, con Postgres como fuente durable y Redis solo como transporte de IDs. Los detalles de RFC/ADRs, el plan ajustado de QA, cronograma y lanzamiento siguen pendientes según el registro. El paquete v0.3 no reemplaza automáticamente el PRD vigente.

## Preguntas prioritarias para cerrar en la reunión

### 1. Alcance y resultado de la primera entrega — Alejo y Mauricio

1. **¿Adoptamos la separación de v0.3 entre incremento 1 y piloto integral?** Concretamente: ¿la primera entrega termina en síntesis privada, puente autorizado, competencias candidatas revisables y revocación, dejando rutas/ofertas/recursos/plan para la siguiente entrega? Registrar qué se entrega y qué se pospone, sin eliminarlo del piloto integral.
2. **¿Cuál es el recorrido exacto que debemos demostrar para aceptar el incremento 1?** Propuesta para validar: seleccionar fragmentos sintéticos → editar síntesis privada → autorizar un campo → ejecutar análisis → revisar candidata → revocar → comprobar invalidación. Añadir el recorrido sin introspección y ES/EN. Precisar qué valida el entorno sintético y qué falta antes de invitar a las seis personas.
3. **¿Qué HUs ES existentes cubren cada paso y qué criterios necesitan ajuste?** Mapear los nueve IDs de v0.3 a tickets ES; evitar crear historias duplicadas. Identificar huecos, dependencias y trabajo que puede hacerse en paralelo. Los IDs TRUST/ELEV/BRIDGE/MAP/UX del PDF no son claves Jira nuevas por sí mismos.

**Salida esperada:** lista cerrada de criterios de la primera entrega, alcance posterior y correspondencia con Jira.

### 2. Base real y despliegue — Mauricio

4. **¿Qué commit será la base autorizada para nuevas HUs mientras el PR #2 está en revisión?** Indicar rama/SHA y reglas para actualizar ramas de desarrollo. No asumir que `main` ya contiene la aplicación o que un PR abierto está aprobado.
5. **¿Cómo quedará Railway en concreto?** Servicios para API, frontend y worker; proyectos/entornos de QA y producción; proyectos o ramas Supabase separados; dominios y URL pública de privacidad. Definir también quién configura secretos y permisos, sin compartir sus valores.
6. **¿Cuál es el orden de transición desde Vercel y qué condición permite revertir?** Precisar configuración de deploys automáticos, protección de `main`, check requerido de CI, desconexión de Vercel, verificación de privacidad y responsable del cambio. No desconectar nada antes de comprobar el reemplazo.

**Salida esperada:** diagrama de servicios/entornos, base de desarrollo y lista de pasos de transición con responsables.

### 3. Privacidad, identidad y revocación — Mauricio, con revisión de Alejo

7. **¿Dónde viven la identidad canónica, los permisos y `CareerContextVersion`, y cómo se comprueba su titularidad?** Confirmar el modelo Postgres real y el aislamiento entre usuarios/organizaciones. ¿Qué acceso tendrá el worker y cómo se evita técnicamente que lea diarios o transcripciones privadas?
8. **¿Qué campos pueden cruzar el puente y cómo demostramos que son exactamente los autorizados?** Definir contrato versionado, procedencia profesional, vista previa y permisos de contexto privado. La selección de fragmentos debe producir una síntesis privada; no autoriza enviar los fragmentos originales a SkillMap.
9. **¿Qué operación garantiza que una revocación concurrente impida publicar un resultado?** Precisar fuente autoritativa, transacción/lock o actualización condicional, momento efectivo de revocación y comportamiento si el worker ya terminó la llamada de IA. Pedir una prueba que fuerce la carrera justo antes del commit de publicación.
10. **¿Qué se invalida y elimina al revocar o borrar un origen?** Enumerar resultados, vistas, cachés, exportaciones futuras y vectores si existen. Definir confirmación al usuario, responsable, plazos verificables y tratamiento de restauraciones. Explicar límites de solicitudes externas y copias ya descargadas.

**Salida esperada:** contrato de frontera, estrategia de concurrencia y casos de prueba bloqueantes; ADR-002/003 revisados con estado explícito.

### 4. Trabajos de IA y calidad — Mauricio

11. **¿Cuál es el mecanismo mínimo durable de jobs y por qué?** Comparar tabla Postgres con worker frente a una cola adicional. ¿Necesitamos Redis ahora o puede posponerse? Definir recuperación tras reinicio, trabajo abandonado, concurrencia, reintentos, cancelación y publicación de un solo resultado lógico.
12. **¿Qué contrato de análisis y presupuesto usaremos con Claude?** Modelo/configuración versionados, esquema de respuesta, taxonomía, límites de entrada/salida, timeout, topes por persona/cohorte, contabilización y mensaje ante fallo. No equiparar revisar una candidata con certificar una habilidad o asignarle nivel.
13. **¿Quién prepara y revisa los 30 casos de evaluación y qué bloquea la entrega?** Confirmar representación no técnica, ES/EN, casos adversos, citas/procedencia y desacuerdos humanos. Definir responsable de rúbricas, selección de muestras y criterios de publicación; la confianza del modelo no sustituye evidencia.

**Salida esperada:** decisión ADR-001, estados y contrato del job, presupuesto definido y plan de evaluación con responsables.

### 5. Seguridad, QA y capacidad — Alejo y Mauricio

14. **¿Quién corrige cada hallazgo P1 del PR #2 y qué prueba demostrará el cierre?** La revisión consultada el 22-oct tenía nueve P1 abiertos: reactivación de cuentas; precios; manifiestos; aprobación de planes; matching; documentos de validación; prompts privilegiados; dependencias de despliegue; secreto JWT de respaldo. Revisar el estado actual y el impacto del cambio de hosting, sin dar por resueltos los problemas de autorización por cambiar de plataforma.
15. **¿Cuál es el plan actualizado de QA para Railway y quién lo aprueba?** Separar build/CI, pruebas con dobles, integración con Postgres real, revisión de permisos y E2E en navegador. Precisar cuentas sintéticas, accesos, criterios de bloqueo, evidencia requerida y quién puede emitir aprobación. Un check verde o un hilo marcado resuelto no equivale a aceptación funcional.
16. **¿Qué fecha y capacidad son defendibles para cada entrega?** Reestimar con dependencias reales, correcciones P1, infraestructura, diseño, QA y especialista. Comparar con las 40 horas brutas por persona declaradas inicialmente y confirmar si siguen disponibles. Si se mantiene una fecha como 27-oct, especificar qué entrega cubre y qué evidencia la sostiene; no asumir compromiso por aparecer en un prompt.

**Salida esperada:** responsables, estimaciones, bloqueos y fechas por entrega; ninguna fecha se interpreta como autorización para omitir puertas.

## Preguntas para establecer una sola fuente de verdad

17. **¿Acordamos que la documentación aprobada del repositorio central sea la referencia canónica?** Propuesta: un índice de decisiones y vigencia en `docs/elevation-skillmap/00-LEEME.md`, publicado en `main`, que enlace PRD, RFC, ADRs y versión de entrega. Es una ubicación propuesta, no un archivo confirmado en ese repositorio. Una propuesta en rama o PDF conserva ese estado hasta revisión/aprobación.
18. **¿Cómo diferenciamos requisito, decisión técnica y avance de ejecución?** Propuesta: PRD para qué/por qué/aceptación; ADR para decisiones técnicas; Jira para responsables, dependencias y estado; PR para código, revisión y pruebas; registro de release para commit/entorno realmente desplegado. El índice único enlaza esas evidencias y evita copiar las mismas decisiones en cinco lugares.
19. **¿Quién aprueba y publica cada tipo de cambio?** Propuesta: Alejo aprueba alcance/prioridad; Mauricio valida arquitectura y operación; QA aporta aceptación independiente; Mauricio realiza el merge. Un cambio mixto necesita validación de alcance y técnica. Definir sustituto y tiempo de respuesta cuando alguien no esté disponible.
20. **¿Qué hacemos cuando chat, Jira, PRD y ADR se contradicen?** Propuesta: registrar la discrepancia, detener solo el trabajo afectado y emitir una decisión explícita con autor/fecha/alcance; actualizar los documentos vinculados antes de implementar esa parte. No elegir automáticamente el comentario más reciente ni usar la jerarquía documental para resolver una contradicción de seguridad.
21. **¿Cómo quedarán las versiones anteriores y las decisiones aún sin incorporar?** Propuesta: marcar v0.2 como sustituida solo cuando exista versión conciliada aprobada; mantener el PDF v0.3 original como propuesta de origen; migrar una copia conciliada al repositorio central. Mientras un acuerdo de reunión no esté publicado, registrar un enlace único al acta y el PR pendiente; no afirmar que ya está integrado.

**Salida esperada:** ubicación canónica, responsables de actualización, regla de aprobación y procedimiento para resolver discrepancias.

## Matriz para rellenar durante la reunión

Completar con las respuestas reales; ninguna celda vacía significa aprobación.

| ID | Decisión a cerrar | Resultado / alternativa elegida | Responsable | Estado | Fecha límite | Enlace a evidencia / PR |
| --- | --- | --- | --- | --- | --- | --- |
| D-01 | Incremento 1 frente a piloto integral | Alcance y recorrido aceptados en las respuestas aportadas; fechas posteriores al corte 1 pendientes | Alejo + Mauricio | Alcance aceptado | Por acordar | [A-01 y PRD](08-REGISTRO-VALIDACION-CTO.md) |
| D-02 | Mapeo de HUs, base de desarrollo y orden | Base main y actualización mediante merge de origin/main aprobadas; mapeo y orden pendientes | Mauricio + Alejo | Parcial | Por acordar | [V-07 / V-08](08-REGISTRO-VALIDACION-CTO.md) |
| D-03 | Railway, entornos, privacidad y transición | Topología, aislamiento y transición con 48 h de estabilidad aprobados; configuración y verificación pendientes | Mauricio | Parcial | Por acordar | [V-18 / V-19](08-REGISTRO-VALIDACION-CTO.md) / ES-8 / ES-57 |
| D-04 | Identidad, permisos y contrato del puente | Credencial propia y permisos mínimos del worker aprobados; contrato e implementación pendientes | Mauricio | Parcial | Por acordar | [V-11](08-REGISTRO-VALIDACION-CTO.md) / ADR-002 propuesto |
| D-05 | Revocación concurrente e invalidación | Publicación transaccional bajo permiso vigente y prueba de bloqueo aprobadas; diseño completo y evidencia pendientes | Mauricio | Parcial | Por acordar | [V-11](08-REGISTRO-VALIDACION-CTO.md) / ADR-003 propuesto |
| D-06 | Jobs, worker y necesidad de Redis | Postgres + worker + Redis aprobados; detalles e implementación pendientes | Mauricio | Parcial | Por acordar | [V-10](08-REGISTRO-VALIDACION-CTO.md) / ADR-001 propuesto |
| D-07 | IA, calidad, presupuesto y especialista | Pausa al agotar límite, roles, composición de casos y criterios de aceptación aprobados; montos, modelo, nombres y disponibilidad pendientes | Mauricio + Alejo | Parcial | Por acordar | [V-12 a V-16](08-REGISTRO-VALIDACION-CTO.md) |
| D-08 | Cierre de P1 y QA ajustado | Puerta de seguridad, cuentas de QA y cinco capas de validación aprobadas; plan detallado, ejecución y cierre efectivo pendientes | Mauricio + QA | Parcial | Por acordar | [V-09 / V-20 / V-21](08-REGISTRO-VALIDACION-CTO.md) / PR #2 |
| D-09 | Capacidad y fecha por entrega | Corte 1: objetivo condicionado 27-oct-2026 12:00 Colombia; capacidad y fechas del incremento 1/piloto integral pendientes de reestimar | Alejo + Mauricio | Parcial | Corte 1: 27-oct-2026 12:00 Colombia | [V-17](08-REGISTRO-VALIDACION-CTO.md) |
| D-10 | Fuente canónica y responsables de publicación | Reglas aprobadas; Alejo con Codex prepara y Mauricio revisa; publicación pendiente | Alejo + Mauricio | Parcial | Por acordar | [V-01 a V-06](08-REGISTRO-VALIDACION-CTO.md) |

Formato de cada acuerdo: **decisión concreta + quién aprueba + fecha + alcance + qué sustituye + evidencia + responsable de publicarla**. Si queda pendiente, añadir responsable y fecha de respuesta.

## Resultado mínimo al terminar

- Un alcance de incremento 1 aceptado o rechazado explícitamente y su relación con el piloto integral.
- Mapeo a las HUs ES existentes, con dependencias y responsables; sin duplicados creados por copiar IDs del PDF.
- Plan técnico y de QA revisable, con preguntas pendientes identificadas y estimadas.
- Índice canónico acordado, un responsable de preparar el PR documental conciliado y otro de revisarlo.
- Registro de qué sigue siendo propuesta y de qué bloquea desarrollo, merge o piloto.

Esta guía no cambia Jira, no aprueba los RFC/ADRs y no envía mensajes a Mauricio. Sirve para obtener respuestas que puedan convertirse después en acuerdos trazables.
