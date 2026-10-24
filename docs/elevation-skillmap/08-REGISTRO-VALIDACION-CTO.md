# Registro de validación con Mauricio

22 de octubre de 2026. Consolidación de respuestas compartidas por Alejo; distingue aprobación, publicación y verificación. No acredita merge, despliegue ni aprobación global del paquete v0.3.

## V-01 · Ubicación de la fuente de verdad

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

El índice oficial vivirá en el repositorio central `iatechdev/gpt-elevation-MVP`, ruta `docs/elevation-skillmap/00-LEEME.md`, publicado en `main`. Enlazará las versiones aprobadas del PRD, RFC y ADRs, los tickets de Jira y las entregas desplegadas. Las propuestas se identificarán como pendientes hasta su aprobación y publicación mediante PR.

**Estado de incorporación:** contenido preparado en esta rama documental para revisión. Hasta el merge no es el índice vigente publicado en main.

**Alcance de la aprobación:** ubicación y distinción entre propuesta y documento aprobado. No resuelve por sí sola responsables, jerarquía ante contradicciones, sustitución completa de v0.2 ni aceptación de los RFC/ADRs.

## V-02 · Función de cada fuente

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

| Fuente | Responsabilidad |
| --- | --- |
| PRD | Alcance y criterios de aceptación. |
| ADR | Decisiones técnicas y sus motivos. |
| Jira | Responsables, dependencias y estado del trabajo. |
| PR | Cambios, revisión y pruebas. |
| Registro de release | Commit y entorno realmente desplegados. |

El índice oficial enlaza estas fuentes. Esta distribución evita copiar decisiones y no convierte una propuesta, un PR abierto o un ticket cerrado en evidencia de despliegue. Su publicación documental continúa pendiente.

## V-03 · Responsables de aprobación y publicación

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

- Alejo aprueba alcance y prioridades.
- Mauricio aprueba arquitectura y operación.
- QA valida y deja evidencia de aceptación.
- Mauricio realiza el merge después de la aprobación de QA.
- Los cambios que afecten producto y arquitectura requieren aprobación de Alejo y Mauricio.

La aprobación de esta distribución no aprueba por sí misma ningún PR, plan de pruebas o despliegue específico. Sustitutos y tiempos de respuesta siguen pendientes; V-06 asigna la preparación del PR documental.

## V-04 · Resolución de contradicciones

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

Cuando chat, Jira, PRD o ADR se contradigan:

1. Registrar la discrepancia y detener solo el trabajo afectado.
2. Alejo decide sobre alcance; Mauricio sobre arquitectura; ambos si afecta las dos áreas.
3. Documentar la decisión con fecha, responsable y qué acuerdo sustituye.
4. Actualizar las fuentes vinculadas antes de continuar esa parte.

Ningún comentario sustituye automáticamente una decisión aprobada. Este procedimiento no permite omitir las puertas de seguridad o QA.

## V-05 · Versiones anteriores y PRD conciliado

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

Conservar el PDF v0.3 original como propuesta de referencia y preparar una versión conciliada con las decisiones aprobadas. Marcar el PRD v0.2 como sustituido cuando la versión conciliada esté aprobada y publicada mediante PR en el repositorio central. Mientras tanto, enlazar los acuerdos nuevos en el registro de decisiones e indicar cuáles siguen pendientes de publicación.

Esta aprobación define el procedimiento de versionado; no aprueba globalmente el contenido técnico del PDF ni acredita que el PRD conciliado ya esté preparado o publicado.

## V-06 · Preparación y revisión del PR documental

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

Alejo con Codex prepara el PR con el índice oficial, el PRD conciliado y el registro de decisiones. Mauricio revisa la coherencia técnica. Se mantienen las aprobaciones de V-03: Alejo para alcance, Mauricio para arquitectura y merge, y QA para aceptación.

Esta asignación no acredita preparación, publicación o aprobación del PR concreto. La publicación en el repositorio central sigue pendiente.

## V-07 · Rama base de desarrollo

**Estado:** Alejo indicó `main` como base autorizada en la validación paso a paso del 22-oct-2026.

Repositorio: `iatechdev/gpt-elevation-MVP`. La consulta remota `git ls-remote --heads origin main` del 22-oct-2026 devolvió `98bf53a14c1e388239119b75ea9cf78fe1220633`. Este SHA es una observación del agente, no una instrucción adicional del CTO de congelar esa versión.

Las nuevas ramas parten de `main`. Esto no incorpora automáticamente el contenido de PRs aún abiertos ni aprueba su merge. Si una HU depende de código que todavía no está en `main`, registrar esa dependencia antes de implementarla. El método para actualizar ramas existentes tras nuevos merges se define en V-08.

## V-08 · Actualización de ramas de HU

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

Actualizar las ramas de las HUs mediante merge de `origin/main` cuando entren cambios aprobados, conservando el historial y sin reescribir ramas compartidas. Preservar los cambios locales existentes. Esta aprobación define el procedimiento, no ejecuta un merge concreto ni autoriza fusionar PRs a main.

## V-09 · Puerta de seguridad antes del merge

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

Los hallazgos de seguridad Altos o Críticos deben corregirse y validarse por QA antes de fusionar a `main`, además de antes de desplegar a producción. Esta confirmación resuelve la diferencia con la propuesta del documento de respuestas de permitir el merge antes y cerrar los hallazgos al activar producción; esa flexibilización no se adopta.

El acuerdo define una condición de aceptación, no acredita el cierre de los hallazgos del PR #2 ni aprueba su merge. Se exige evidencia de QA conforme a V-03.

## V-10 · Jobs con Postgres, worker y Redis

**Estado:** Alejo eligió explícitamente la opción B en la validación paso a paso del 22-oct-2026.

El incremento 1 utiliza Postgres + worker + Redis. Postgres conserva los trabajos durables, estados y permisos. Redis transporta únicamente IDs de jobs; no almacena contexto privado, consentimientos ni resultados. Ante fallos del transporte se reconcilian los trabajos desde Postgres.

La decisión selecciona la arquitectura; no acredita creación de servicios, garantías de entrega o pruebas de recuperación. V-11 define los permisos mínimos y publicación condicionada; quedan por concretar y probar el mecanismo SQL, outbox/relay, leases e idempotencia, configuración de Redis, límites, costos y tickets de implementación. Los valores numéricos propuestos en las respuestas no se aprueban por esta elección.

## V-11 · Credencial y permisos mínimos del worker

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

El worker tendrá credencial propia. Su lectura se limita al contexto profesional autorizado; no puede acceder a chats, diario o borradores privados. Puede gestionar sus jobs y publicar mediante una operación controlada que compruebe consentimiento vigente dentro de la transacción.

QA debe demostrar la denegación de acceso a datos privados y el bloqueo de publicación tras una revocación. La aprobación define la frontera y las pruebas requeridas; no acredita roles creados, permisos SQL probados ni cierre global de ADR-002/003. Concretar el mecanismo de publicación y acceso mínimo al permiso sin conceder acceso al contenido privado.

## V-12 · Presupuesto de IA

**Estado:** pendiente. Alejo respondió «Presupuesto de IA por definir» el 22-oct-2026.

No se fijaron topes por participante o cohorte, moneda ni periodo. No interpretar la ausencia de montos como presupuesto ilimitado o autorización de gasto. Responsable de proponer/aprobar cifras y fecha de cierre todavía por acordar. Separar consumo de chat/síntesis/análisis del costo de infraestructura y revisión humana.

## V-13 · Comportamiento al agotar el límite de IA

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

Al agotarse un límite de IA configurado, la plataforma conserva el avance y el último mapa válido, pausa nuevas llamadas y muestra un mensaje claro. No amplía el presupuesto automáticamente.

La aprobación establece el comportamiento esperado; no fija los montos pendientes de V-12 ni acredita implementación o pruebas. La contabilización concurrente y las reservas de consumo deben diseñarse para hacer efectivo el límite.

## V-14 · Responsables de evaluación de IA

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

- Alejo con Codex prepara los 30 casos sintéticos.
- Alejo con el especialista define rúbricas y criterios; el especialista aporta casos adversos.
- Dos revisores humanos distintos del autor del caso evalúan pertinencia; Mauricio resuelve desacuerdos.
- QA comprueba esquema, procedencia e inyección, sin sustituir la revisión humana.

La distribución no acredita casos preparados o evaluados ni asignaciones aceptadas por personas aún no identificadas. Nombres de revisores y especialista, disponibilidad, dedicación y fechas siguen pendientes.

## V-15 · Composición del conjunto de evaluación

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

El conjunto de 30 casos incluye al menos 10 perfiles no técnicos, al menos 5 casos adversos y al menos 6 casos en inglés; los restantes se preparan en español. Los casos adversos cubren situaciones como poca evidencia, contradicciones, urgencia e intentos de inyección. Las categorías pueden coincidir en un mismo caso.

Esta decisión aprueba la composición, no acredita casos redactados, revisión bilingüe completada ni resultados de evaluación. No demuestra equivalencia estadística entre idiomas ni valida el piloto por sí misma.

## V-16 · Criterios de aceptación de la evaluación

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

- Al menos 24 de los 30 casos deben resultar pertinentes y justificados según la rúbrica.
- Cero violaciones críticas de privacidad, evidencia inventada o inyecciones exitosas en los casos evaluados.
- Todo resultado publicado debe cumplir esquema, taxonomía y procedencia.
- Revisión humana registrada, incluidos casos en inglés y desacuerdos.

Un fallo crítico bloquea la entrega aunque se alcance el umbral de 24/30. Esta aprobación establece la puerta de calidad; no acredita pruebas ejecutadas ni resultados obtenidos y no demuestra ausencia universal de fallos.

## V-17 · Fecha objetivo y alcance del corte 1

**Estado:** confirmado por Alejo en la validación paso a paso del 22-oct-2026.

Objetivo condicionado: **27 de octubre de 2026 a las 12:00, America/Bogota (UTC-05:00)**, exclusivamente para el corte 1: línea base, correcciones P1 validadas, staging en Railway y su puerta de QA.

Las fechas del incremento 1 funcional y del piloto integral se definirán tras el inventario y la reestimación. No se omiten controles para cumplir la fecha. Esta confirmación no acredita capacidad suficiente, cierre de hallazgos, aprobación QA ni preparación del entorno.

## V-18 · Estructura de Railway y aislamiento de entornos

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

Un proyecto `elevation` con entornos `staging` y `production`:

- Un servicio `app` por entorno para Express y el frontend estático.
- Worker y Redis para el incremento 1, separados entre entornos.
- Bases de QA y producción aisladas, con secretos distintos. Staging nunca accede a producción.

La aprobación define la topología objetivo; no acredita servicios creados o aislamiento probado. La elección de rama o proyecto Supabase para QA, los permisos efectivos, límites de gasto y configuración de dominios siguen por concretar. Worker y Redis no son requisitos añadidos al corte 1 por esta decisión.

## V-19 · Transición de Vercel a Railway

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

Validar primero Railway en staging. Antes de los merges, pausar los despliegues de producción de Vercel sin desconectarlo. Cambiar el dominio solo con QA aprobado, pruebas de humo correctas y la URL pública de privacidad preservada. Desconectar Vercel después de 48 horas de estabilidad, verificando que ninguna integración dependa de él.

Ante un fallo de transición, Vercel es respaldo de la página de privacidad, no respaldo funcional de toda la aplicación. La aprobación define secuencia y condiciones; no ejecuta cambios de DNS, pausas, merges o desconexiones. Verificar el mecanismo real de pausa y preparar la reversión de aplicación/base antes del cambio.

## V-20 · Cuentas sintéticas y credenciales de QA

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

Utilizar cuentas sintéticas exclusivas de QA, con credenciales entregadas por un canal seguro y sin publicarlas en Git. El script de siembra se restringe a QA y debe rechazar la ejecución contra producción.

Esta decisión sustituye la propuesta del documento de respuestas de publicar contraseñas fijas de staging en el repositorio. No acredita cuentas creadas, acceso entregado ni controles de entorno probados. Los datos sintéticos de prueba pueden versionarse; las credenciales que permitan entrar a un entorno accesible no.

## V-21 · Capas de QA para Railway

**Estado:** aprobado por Alejo en la validación paso a paso del 22-oct-2026.

1. Build y CI: tipos, pruebas, build y construcción de Docker.
2. Pruebas unitarias: lógica con IA simulada.
3. Integración con Postgres real: propiedad, consentimiento y revocación concurrente.
4. Permisos: matriz ruta × rol y pruebas negativas de los hallazgos.
5. E2E en staging: recorrido ES/EN, teclado, responsive y recuperación de errores.

Cada prueba deja evidencia reproducible. El plan detallado de casos se presenta para aprobación antes de ejecutarlo. Aprobar estas capas no aprueba un plan aún no presentado ni acredita pruebas ejecutadas o QA superado.

## Cierre de esta ronda

Con V-21 termina la ronda de validaciones paso a paso. V-12 sigue expresamente pendiente: no se definió el presupuesto de IA. No repetir las aprobaciones ya registradas.

Quedan trabajo y datos concretos para preparar la entrega documental: conciliar el PRD con las respuestas de alcance ya aportadas, mapear las HUs sin duplicados, precisar modelo y límites de IA, identificar revisores/especialista y disponibilidad, cerrar configuración de QA y accesos sin secretos, y preparar el plan detallado de pruebas. Las fechas posteriores al corte 1 requieren inventario y reestimación. Estos pendientes no se dan por aprobados ni completados por terminar la ronda.

El índice y el PRD conciliado se proponen en esta rama; el merge y su publicación en main siguen pendientes.


## A-01 · Alcance recibido en las respuestas de la reunión

El archivo de respuestas compartido por Alejo acepta expresamente la separación entre incremento 1 y piloto integral y el recorrido de aceptación de las primeras dos preguntas. Se incorporan en la sección 0 del PRD. La respuesta «No lo son» a la tercera pregunta confirma que los IDs del PDF no son nuevas claves Jira, pero no aporta un mapeo completo; el mapeo de este paquete es propuesta para revisión.

## Pendientes de la consolidación

V-12 sigue pendiente. Las propuestas de la respuesta técnica (parámetros de reintentos, límites, permisos SQL, triggers, precios, 7/30 días de borrado) no se convierten en acuerdos por copiarse aquí. Las referencias a incidentes o capacidades de proveedores son históricas y deben verificarse al ejecutar. No se publican los archivos originales de respuestas personales ni las tarifas del backlog; se conserva su síntesis de decisiones.
