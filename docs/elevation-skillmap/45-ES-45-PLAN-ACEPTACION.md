# ES-45 — Plan técnico de aceptación E2E y piloto para aprobación

[Dev-Codex] · 28-oct-2026 · Fase 1; no es un informe de ejecución.
Rama ES-45-aceptacion-e2e desde origin/main 6dc61e93542776147693e87b6e95c9c4c0b47d22.
No hay cambios de interfaz, API, modelos, migraciones ni código de pruebas implementado todavía.

## 1. Objetivo y fuentes verificadas

ES-45 / SP2-HU21: demostrar en navegador y staging real el recorrido acceso -> consentimiento -> espacio/Brújula opcionales -> puente o contexto directo -> evidencia -> mapa -> rutas -> experimento -> revisión -> plan/exportación. Cubrir ES/EN, profesiones no técnicas, ambos puntos de entrada, recuperación desde otro navegador, aislamiento, revocación/borrado, presupuesto y fallos. Revisar seis recorridos del piloto con soporte y responsable de incidente antes de invitar. Seguimiento7/30 días solo después de observarlo.

Fuentes leídas: Jira ES-45 y ES-10; estados de dependencias en Jira; docs/elevation-skillmap/02-PRD.md, 04-SPRINT-2-HUS.md HU21/T02, 11-QA-Y-ACEPTACION.md y 12-OPERACION-Y-RELEASES.md; docs/DESPLIEGUE-RAILWAY.md; App.tsx; tests de frontend; backend/test/support.cjs y tests de integración PG; server.js health/fallback; .github/workflows/ci.yml. QA existente consultado mediante git show origin/ES-39-plan-pruebas-v2:qa/README.md (referencia NO integrada, no se modifica ni copia su historial).

Hallazgos al28-oct:
- main no contiene las pantallas completas de diario, puente/evidencia/mapa, rutas/experimento/plan y facilitación preparadas en PR separados.
- ES-14/32/33/34/35/36/44 siguen En QA. Las entregas preliminares de ES-34/35/36 no prueban integración real.
- ES-10/11 siguen En DEV; puertas ES-40/41/42/43 y especialistas ES-17/24/46 siguen Por hacer; ES-38 también Por hacer. Estado Jira no acredita por sí solo funcionalidad ni despliegue.
- Los tests de support.cjs usan Express/HTTP/JWT reales pero sustituyen persistencia, cifrado y proveedor: son HTTP con dobles, no PG ni staging.
- Hay pruebas PostgreSQL aisladas y CI de derechos de datos; una capa DB no acredita recorrido visual.
- Los scripts de navegador de la landing interceptan API: son navegador con fixtures, no E2E integrado.
- /api/health no comprueba DB/auth y puede omitir commit tras rollback. Un200HTML del fallback SPA no demuestra que exista la pantalla solicitada.
- No se verificaron en esta fase URL/commit actuales de staging, aislamiento de su DB, credenciales sintéticas, límites de gasto, proveedor real ni despliegue. No se consultó producción.

## 2. Alcance a aprobar

Tramo A recomendado ahora: paquete preparatorio local/offline con matriz de aceptación, manifiesto de dependencias y evidencias, seis guiones sintéticos ES/EN, validadores, consolidado por capas y pruebas locales del propio paquete. Debe terminar indicando aceptación integral BLOQUEADA cuando falte cualquier requisito, nunca convertir un skip/fixture/test del validador en aceptación del producto.

Tramo B después: ejecutar casos API/DB/navegador reales sobre build integrado en staging aislado, con commit/procedencia de despliegue comprobados y cuentas de QA provistas por Mauricio. No sustituir módulos ausentes con scripts o seeds para avanzar. Playwright navega como usuario; las consultas técnicas se usan como evidencia de persistencia/aislamiento, no para saltar pantallas.

Tramo C: ensayo con personas reales e invitación solo tras todas las puertas y decisión humana del PO/Mauricio/QA. Registrar observaciones reales a7/30 días cuando ocurran, sin simular resultados ni dar por transcurridas las ventanas.

Esta aprobación solicitada es solo A. No autoriza despliegues, fusiones, cambios de producción, envío de invitaciones, borrados remotos, llamadas pagadas a Claude o captura de datos reales.

## 3. Implementación propuesta del paquete (sin UI ni backend nuevos)

Carpeta propia acceptance/es45/ para no modificar qa/ del rol QA:
- cases.json: matriz versionada con caseId, criterios/hu, capa requerida, pasos, resultado esperado, dependencias y carácter destructivo.
- journeys.json: seis itinerarios ficticios, sin nombres/correos/CV/datos de las seis personas reales.
- readiness.json: requisitos verificables y referencias de evidencia; estado inicial pendiente/bloqueado, sin aprobaciones inventadas.
- lib/validate.mjs y lib/consolidate.mjs: validación de esquemas/IDs/límites/referencias, compatibilidad de capa y consolidado determinista.
- scripts/check.mjs y scripts/report.mjs: CLI offline que valida ficheros explícitos y genera resumen JSON/Markdown en salida ignorada local; ningún fetch ni conexión DB/proveedor.
- test/*.test.mjs: tests Node nativos de esos validadores; fixtures de resultados totalmente sintéticos, marcados simulation:true.
- README.md y documentación de ejecución, seguridad y límites.

No introducir librería de producción ni cambiar stack/SDK/CI/roles por este ticket. Node22+, sin endpoint nuevo, sin nueva tabla y sin migración. No crear un servicio de consentimiento, identidad o métricas alternativo. No se escribe frontend ni texto de producto; por ello este tramo no necesita una maqueta visual, pero sí aprobación del plan técnico según AGENTS.md.

La automatización de navegador B se añadirá a esta misma HU/rama después de comprobar rutas, textos/roles y contratos integrados; no inventar selectores de pantallas inexistentes ni un runner que pinte pass tras un200. Playwright será herramienta de pruebas, no dependencia de producción. Si cambia la interfaz, se presenta diseño aparte antes de tocarla.

## 4. Matriz de aceptación inicial

Cada fila es una familia de casos con variantes por idioma/actor/momento que se enumerarán explícitamente en cases.json; no es una lista de resultados aprobados.

| ID | Caso / resultado esperado | Capa mínima para aceptación |
| --- | --- | --- |
| E45-01 | Identificar staging, aislamiento/protección, commit y permisos; no confundir health con salud de DB | Evidencia Infra + staging API |
| E45-02 | Dos puertas de entrada conservan destino aprobado; login real y retorno correcto | Staging navegador ES/EN |
| E45-03 | Propósitos independientes; rechazar investigación/notificaciones/compartir no bloquea recorrido permitido | Staging navegador/API |
| E45-04 | Recuperación en segundo contexto de navegador con nueva autenticación: solo datos confirmados del mismo dueño | Staging navegador + persistencia |
| E45-05 | Diario/espacio y Brújula opcionales; abandonar/silencio sin transferencia ni seguimientos automáticos | Staging navegador; revisión humana de tono |
| E45-06 | Puente: selección, preview exacta, confirmar y recuperar; borrador no transfiere | Staging navegador/API |
| E45-07 | Contexto directo sin exploración; ParticipantContext único, ES/EN, disponibilidad/zona verificadas | Staging navegador/API |
| E45-08 | Evidencia manual propia, procedencia/versiones, confirmación y edición sin pérdida de origen | Staging navegador/API |
| E45-09 | Mapa sin evidencia nullable; self/review separados; sin déficits/competencias inventadas | Staging navegador/API; rúbrica humana |
| E45-10 | Rutas pertinentes no técnicas con restricciones, fuentes oficiales fechadas, razones/límites y rechazo/elección | Staging navegador; pertinencia humana |
| E45-11 | Sin catálogo pertinente u oferta vigente: límite explícito, sin fabricación | Staging navegador/API |
| E45-12 | Experimento20–45 min, pregunta/rúbrica/evidencia/costo conocido; costo desconocido no acredita criterio | Staging navegador/API |
| E45-13 | Entrega/reflexión/decisión y grado de ayuda; checkbox/curso no acredita capacidad | Staging navegador/API; revisión humana |
| E45-14 | Compartir material/versión con revisor asignado; revisión con autor/fecha/evidencia y objeción | Staging navegador/API; contratos Mauricio |
| E45-15 | Plan7/30/90 aceptado explícitamente con disponibilidad, fechas, dependencias y recordatorios opcionales | Staging navegador/API |
| E45-16 | Cambio de evidencia/contexto/revocación invalida derivados y explica versiones, no reescribe historia | DB real + staging navegador/API |
| E45-17 | Exportación propia/controlada exacta; ninguna descarga ajena o con permiso retirado | DB real + staging navegador/API |
| E45-18 | Aislamiento A/B por cada recurso/acción, rol y asignación; no enumeración, sesión revocada/IDs ajenos rechazados | DB real + staging API/navegador |
| E45-19 | Revocación antes/durante procesamiento/antes del commit/después de publicar; sin acceso residual | DB real coordinada + staging API/navegador |
| E45-20 | Doble envío/ACK perdido/reinicio: idempotencia, sin doble consumo ni falso guardado | DB real + staging API/navegador |
| E45-21 | Presupuesto agotado/timeout/proveedor fallido: recuperación visible, sin pérdidas ni cargos no autorizados | Staging controlado; proveedor real cuando se apruebe |
| E45-22 | Frontera privada: canarios sintéticos de chat/diario/crisis no llegan a carrera, terceros, prompts o logs | DB/API + inspección técnica acotada |
| E45-23 | Eliminación solicitada/recibo/reintentos y derivados; no declarar purga total si proveedores/backups siguen pendientes | DB real + staging navegador, borrado autorizado aparte |
| E45-24 | ES/EN completo, teclado, móvil, zoom, foco, estados vacío/error/guardando/éxito y accesibilidad revisada | Staging navegador + revisión manual |
| E45-25 | Facilitar solo personas asignadas, materiales seleccionados; sin agregados identificables ni EN separado | Staging API/navegador |
| E45-26 | Valor emocional opcional sin exigir contexto profesional; utilidad/denominadores/ausencias sin metas como resultados | Staging navegador/API + revisión humana |
| E45-27 | Soporte/incidente/responsables, fallos bloqueantes resueltos, rollback aprobado y puertas registradas antes de invitar | Referencias de QA/Infra/PO, decisión humana |
| E45-28 | Observaciones7/30 días registradas al ocurrir; sin fabricar mejora clínica, empleabilidad o eficacia | Seguimiento humano restringido, posterior al piloto |

Regla transversal: el runner de B verifica pantalla concreta, acciones, red autorizada y recuperación persistente tras recarga/nuevo navegador. Un200, una ruta SPA, una captura sin pasos o un test de HTTP no acreditan la fila de navegador. Los casos con componentes/proveedor simulados permanecen clasificados así.

Casos de seguridad detallados y hallazgos altos/críticos se registran en Jira con referencias por ID. En GitHub público, solo resumen y remisión al ticket; no credenciales, cargas privadas, cuerpo de respuesta sensible ni procedimiento de explotación publicado.

## 5. Seis guiones sintéticos propuestos

No representan profesiones ni circunstancias de las personas reales; sirven para cobertura de pruebas. Sin números de identificación, nombres, correos, ofertas, salarios o resultados profesionales reales.

| Alias de prueba | Idioma | Contexto ficticio / recorrido |
| --- | --- | --- |
| SYN-01 | ES | Docencia: entrada emocional opcional -> puente seleccionado -> ciclo profesional completo |
| SYN-02 | ES | Atención al público: entrada profesional -> contexto directo -> evidencia/mapa/ruta/experimento/plan |
| SYN-03 | ES | Logística: rechazar puente/investigación; contexto directo permitido; no se copian chats |
| SYN-04 | ES | Administración: error/ACK perdido, cierre/nueva sesión y recuperación confirmada desde otro navegador |
| SYN-05 | ES | Comercio: explorar acompañamiento sin obligar avance profesional; utilidad emocional independiente |
| SYN-06 | EN | Formación: entrada profesional, ciclo completo EN y objeción/revisión, zona elegida desde contexto canónico |

Los guiones completos ES/EN incluyen pasos, esperado y motivo de bloqueo; textos de prueba son ficticios y no contenido editorial a publicar. La prueba de solo acompañamiento verifica una opción legítima, no se marca como fallo por no completar carrera. El ciclo profesional completo queda cubierto por SYN-01/02/06 y variantes. No comparar el subgrupo EN ni presentar tasas del piloto a partir de estos guiones.

La revisión de los seis recorridos reales requerirá datos mínimos en registro restringido y permiso del titular. Nunca copiar los perfiles reales a journeys.json ni a evidencia pública.

## 6. Evidencia y consolidación sin falsos positivos

Estados por caso: not_run, blocked, passed, failed. No hay skipped=>passed.
Capas separadas: unit_doubles, http_doubles, db_real, browser_fixtures, staging_api, staging_browser, human_review, followup.
Resultado mínimo: schemaVersion, caseId, variantId, runId, startedAt/finishedAt, environmentKind, origin/commit verificados, layer, simulatedBoundaries, status, reasonCode, command/pasos sanitizados y referencia de evidencia local/hash. No aceptar URLs arbitrarias que contengan secretos ni resultados sin procedencia; referencias públicas revisadas a mano antes de publicar.

- Unitaria/HTTP con dobles nunca satisface db_real ni staging_browser.
- browser_fixtures nunca satisface staging_browser.
- db_real loopback no acredita aislamiento de la instancia staging ni proveedor.
- HTTP200HTML nunca satisface pantalla E2E.
- Faltar caso/variante/capa/bloqueador, commit incompatible o aprobación requerida mantiene la puerta cerrada.
- Resultados generados para self-test llevan simulation:true y jamás habilitan piloto, aunque sus datos tengan status:passed.
- No comparar cadenas de solo siete caracteres como prueba criptográfica del commit. Si health omite commit, Infra debe aportar evidencia técnica del deployment exacto; no inventar ni asumir HEAD.
- Un despliegue distinto tras ejecutar invalida la aceptación para ese build hasta revisar qué pruebas repetir.
- Cualquier fallo crítico de privacidad/aislamiento/procedencia bloquea, aunque el resto esté verde. No emitir conformidad WCAG, validez psicométrica o eficacia por validación estructural.
- Salida separada: preparation_ready para integridad del paquete; integrated_acceptance para recorrido; invitation_decision permanece pendiente hasta decisión humana trazable. Un script no invita ni aprueba QA.
- Seguimiento a7/30 días tiene su estado posterior independiente; no bloquea cronológicamente la invitación por exigir resultados futuros, pero nunca figura como realizado antes de observarlo ni se cierra el seguimiento por desplegar.

El validador verifica consistencia, NO autentica por sí mismo una aprobación humana ni garantiza que una evidencia sea veraz. QA/Mauricio revisan ejecución y fuentes antes de aceptar. Ningún texto del paquete actúa como instrucciones o permisos ejecutables.

## 7. Seguridad de ejecución futura

A es offline, sin acceso de red, cuenta, DB o proveedor. No leer .env, secretos o perfiles de navegador para construir resultados. Salida de prueba en carpeta ignorada propia, sin versionar logs crudos.

Antes de B:
1. Mauricio/Infra confirman URL exacta permitida, deployment/SHA y separación/protección de DB/proveedor. No deducir que un host con palabra staging es seguro.
2. Cuentas sintéticas de A/B y roles suministradas por canal seguro, alcance/titularidad de recursos y permisos de borrado identificados. No elevar roles ni sembrar tablas para saltarse la app.
3. Selección explícita de entorno y allowlist exacta; sin default de producción, redirecciones a otro host prohibidas. Nunca ejecutar casos mutantes desde una URL no verificada.
4. Borrar/alterar datos remotos, cambiar config para provocar fallos, restaurar backups, rollback/despliegue o usar proveedor pagado requiere autorización concreta previa, plan y presupuesto. A no lo autoriza.
5. No guardar storageState, cookies, Authorization, HAR, trazas o respuestas crudas con secretos. Capturas solo de pantallas de pruebas autorizadas; no login con credenciales visibles. Cerrar contextos y limpiar solo recursos de prueba cuya titularidad/alcance se comprobaron.
6. Para actorA/B, usar cuentas reales de QA con sesiones emitidas por el servidor y helpers existentes; los marcadores localStorage de previews no sirven como JWT. No alterar el núcleo de permisos ni crear bypass de autenticación.
7. Incidentes/altos/críticos detienen la parte afectada; soporte y escalado definidos por humanos. No invitar, contactar especialistas/participantes o enviar correo por iniciativa del script.

La lectura de /api/health puede hacerse cuando se confirme el host; su éxito no acredita conexión/cifrado/auth/retención. En A no se hará ni siquiera esa llamada a un staging supuesto.

## 8. Dependencias y decisiones pendientes

- ES-10/11/59: staging aislado/protegido, despliegue exacto, migraciones/config/CI/reversión, observabilidad sin contenidos y responsable de infraestructura.
- Integración por QA y merge de Mauricio de las HU del recorrido. No cherry-pick o merge de PR ajenos dentro de ES-45.
- ES-14/32/33: contexto mínimo canónico y motor persistente; costo conocido/plantilla pertinente aún por verificar. ES-34/35/36 requieren adaptadores y permisos reales; preview no sirve para aceptación.
- Mauricio: permisos y contratos de asignación, selección de material, revocación, autoría, revisión, retención/exportación/borrado; no se duplican.
- ES-17/24/46 y ES-44: revisión de tono/seguridad/rúbricas y corpus, revisores humanos y permiso/presupuesto de corrida real Claude. ES-45 referencia sus resultados; no duplica el corpus30casos ni convierte su score en aceptación E2E.
- QA ES-39/40/41/42/43 y ES-38: coordinar referencias/casos ya aprobados; no sobrescribir qa/ ni resolver sus hilos, no declarar QA aprobado desde el rol Dev.
- PO/Mauricio: quién dará soporte, resolverá incidentes, acompañará cada recorrido y aprobará invitación. Roles propuestos, nombres/disponibilidad pendientes.
- ES-36: contrato real de finalidad/cohorte/utilidad/derechos antes de medir o publicar resultados del piloto.
- PO/especialista: pertinencia real del catálogo/experimentos para las personas; fuentes/ofertas oficiales comprobadas por el ticket responsable. Un caso ficticio no inventa una oferta.

Estas decisiones no requieren publicar secretos. Se pedirán referencias/contratos y acceso técnico adecuado al habilitar B, no valores de variables en comentarios.

## 9. Pruebas del propio paquete A (después de aprobar)

Node nativo:
- Acepta manifiestos válidos sintéticos y rechaza schemas/IDs/variantes duplicados, referencias faltantes, hashes/fechas inválidos, entorno/commit incompatibles y campos extra prohibidos.
- Mantiene not_run/blocked, rechaza promoción desde fixtures/HTTP a navegador/staging y evita pase de piloto usando self-tests.
- No permite que faltantes o un crítico queden ocultos por resumen/promedio; cobertura desglosada por capa e idioma.
- Diferencia preparación lista de aceptación integral e invitación/seguimiento posteriores; prueba límites7/30 días sin alegar resultados reales.
- CLI determinista, salida saneada y errores sin secretos, sin escribir fuera de destino propio ni disparar comandos/red a partir del JSON.
- Inputs de prueba explícitos, sin consulta de credenciales/.env ni dependencia de backend vivo.

Ejecutar node --test acceptance/es45/test/*.test.mjs, node --check de scripts y git diff --check; comprobar mismos resultados en Node22 de CI. No inventar número de tests antes de escribirlos. Como no cambia frontend/backend, no afirmar que sus pruebas fueron ejecutadas localmente salvo correrlas; CI existente sí se verificará al abrir PR. Si al implementar se toca código de producto, reevaluar alcance/plan antes de hacerlo.

No crear pruebas que pretendan demostrar seguridad del producto leyendo solo fuente o declarando un resultado. A prueba el paquete; B prueba el producto.

## 10. OBJECIÓN: cierre integral, plazo y presupuesto

Objeto considerar que ES-45 puede cerrarse hoy con una suite simulada o dentro de8–12h contando staging/correcciones/piloto/seguimiento futuro.
Evidencia: main6dc61e9 no integra el recorrido; ES-10 está En DEV y exige aislamiento/protección por verificar; puertas QA/especialistas Por hacer; revisiones reales y varios contratos de permisos están pendientes.
Riesgo: invitar a personas con un recorrido incompleto o sin protección, atribuir aceptación a mocks, fabricar observaciones7/30 días.

Alternativa recomendada: aprobar A (8–12h orientativas de paquete y self-tests), dejar explícita la aceptación integral bloqueada. B requiere12–20h orientativas adicionales de ejecución/reporte una vez existan dependencias, sin incluir corrección de hallazgos o tiempos de revisión humana. C depende de disponibilidad humana y del transcurso de ventanas, no de un estimado de horas de programación.
Alternativa: detener automatización hasta disponer del build integrado y todos los contratos; elaborar solo matriz/manual ahora.
No se promete fecha de cierre ni se modifican automáticamente estimaciones Jira. Alejo decide alcance y Mauricio lo técnico; QA aprueba su puerta. El vencimiento27-oct ya pasó; no se presenta como fecha cumplida.

## 11. Entrega y aprobación solicitada

Esta fase entrega solo este documento en rama propia, comentario firmado en Jira y estado En DEV al crear rama. Sin PR de producto ni resultado de pruebas del paquete aún.
Solicito aprobar el tramo A: matriz/guiones/registro por capas/validadores y self-tests offline, sin UI/API/modelos/migraciones.
Con aprobación: implementar, ejecutar/verificar pruebas, abrir un único PR contra main y pasar En QA del tramo preparatorio con criterios integrales pendientes. No fusionar ni resolver hilos de QA.
AGENTS.md requiere plan técnico previo y: «Con la aprobación de Mauricio o de Alejo implementas todo». docs/elevation-skillmap/11-QA-Y-ACEPTACION.md también exige aprobación del plan detallado antes de ejecutarlo. No se interpreta este borrador como autorización humana.
