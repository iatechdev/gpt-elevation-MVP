> Material de referencia anterior a la consolidación del 22-oct-2026. Para decisiones vigentes y pendientes, consultar [el índice](00-LEEME.md). Las preguntas y estimaciones históricas no sustituyen los acuerdos posteriores ni el estado real de Jira.

# Sprint 2 — Elevation + Skill Map: HUs y distribución

Versión 1.0 · 20 de octubre de 2026 · Estado: propuesta de trabajo para revisión conjunta; no son tickets creados ni asignaciones enviadas.

## 1. Decisiones confirmadas

- Producto: **Elevation + Skill Map**, usando [PRD v0.2](02-PRD.md), incluidos RF-01 a RF-17. El piloto técnico Itti no es el objetivo de este sprint.
- Equipo: Mauricio y Alejandro. Capacidad declarada: 4 horas diarias por persona. Alejandro implementará con ayuda de Codex.
- Ventana inicial: 10 días hábiles, 40 horas por persona, 80 horas brutas en conjunto.
- Objetivo de alcance: recorrido completo disponible antes de invitar al piloto de seis personas, cinco ES y una EN. Colombia/Dinamarca no determinan automáticamente idioma ni mercado objetivo.
- Se permite curación manual de rutas, ofertas y recursos y revisión humana. Interpretación operativa: el recorrido del usuario debe funcionar integrado, sin copiar datos entre sistemas ni ejecutar scripts para avanzar; la preparación editorial y la revisión explícita pueden ser humanas.
- Decisión posterior de capacidad: **conservar todo el alcance y ampliar el plazo después de validar reutilización**. Por ello, los 10 días iniciales no son una promesa de terminar las 25 unidades siguientes.
- Responsable de las historias más complejas: **Mauricio**. Historias de menor complejidad técnica: **Alejandro**, con Codex. La revisión de Mauricio no la aprueba él mismo; Alejandro realiza revisión funcional/técnica apoyado por Codex, y las materias especializadas requieren una persona competente adicional cuando corresponda.
- No se fijó fecha de inicio. Las ventanas siguientes son relativas; la ampliación se acuerda al cerrar SP2-T01.

La habilitación del piloto no acredita en diez días las metas que el PRD observa a 30 días. El seguimiento de resultados comienza tras la invitación.

## 2. Capacidad y estimación

Estimaciones preliminares por entrega acotada, con implementación y pruebas propias; **no son compromisos ni conversión de puntos a horas**. Se apoyan en el PRD, en la lectura parcial de ambos repositorios y en el informe funcional de Perfilador. Requieren recalibración en T01.

| Responsable | HUs | Tareas técnicas | Construcción estimada | Reserva disponible en ventana inicial | Capacidad inicial para construir |
| --- | --- | --- | --- | --- | --- |
| Mauricio | 11 | 2 | 94–144 h | 8 h para revisión, integración y correcciones | 32 h |
| Alejandro | 12 | 0 | 60–92 h | 8 h para revisión, integración y correcciones | 32 h |
| Total | 23 | 2 | 154–236 h | 16 h | 64 h |

El alcance completo excede incluso las 80 horas brutas iniciales. Mauricio es el cuello de botella de carga; repartir la misma cantidad de historias no equilibra horas ni dependencias. La reserva no incluye trabajo de especialistas externos ni una migración grande no descubierta.

Como equivalencia de carga, a 3,2 horas diarias planificables: Mauricio requiere aproximadamente 30–45 jornadas y Alejandro 19–29. **Esto no es un calendario de entrega**: reutilización validada puede reducirlo; dependencias, defectos e intervención especializada pueden aumentarlo. Reestimar antes de prometer fecha.

## 3. Tabla para distribuir

Las dependencias abreviadas HUxx/Txx corresponden a los IDs SP2-HUxx/SP2-Txx. Cada persona es responsable de entregar su fila, incluyendo las pruebas indicadas. Las historias UI consumen contratos definidos por Mauricio, sin trasladar a Alejandro el diseño de permisos, transacciones o revocación.

| ID | Entrega | Responsable | Complejidad técnica | Estimación | Depende de | Trazabilidad PRD |
| --- | --- | --- | --- | --- | --- | --- |
| SP2-T01 | Inventario y ADR de aplicación anfitriona | Mauricio | Alta | 4–6 h | — | Arquitectura §8 |
| SP2-HU01 | Entrada y contexto de las seis personas | Alejandro | Baja | 4–6 h | T01 | RF-16; E0 |
| SP2-HU02 | Acceso individual y roles de servidor | Mauricio | Alta | 8–12 h | T01 | RF-01; RF-11 |
| SP2-HU03 | Consentimiento por propósito y revocación | Mauricio | Alta | 8–12 h | HU02 | RF-02; RF-11 |
| SP2-HU04 | Conversaciones y diario privados recuperables | Mauricio | Alta | 8–12 h | HU02, HU03 | RF-01; RF-15 |
| SP2-HU05 | Mi espacio y diario ES/EN | Alejandro | Media | 6–8 h | HU04, HU06 | RF-15; RF-16 |
| SP2-HU06 | Tono socrático y ejercicios bilingües | Alejandro | Baja | 4–6 h | HU19 | RF-14; RF-15; RF-16 |
| SP2-HU07 | Puente profesional autorizado y versionado | Mauricio | Alta | 8–12 h | HU03, HU04 | RF-03; RF-04 |
| SP2-HU08 | Brújula editable y vista previa del puente | Alejandro | Media | 4–6 h | HU07 | RF-03; RF-04 |
| SP2-HU09 | Evidencia profesional con procedencia | Mauricio | Alta | 6–10 h | HU02, HU03 | RF-05 |
| SP2-HU10 | Mis evidencias: captura y revisión | Alejandro | Media | 4–6 h | HU09 | RF-05 |
| SP2-HU11 | Skill Map trazable con nivel nullable | Mauricio | Alta | 8–12 h | HU09 | RF-06 |
| SP2-HU12 | Radar explicable y sin déficits ficticios | Alejandro | Media | 4–6 h | HU11 | RF-06 |
| SP2-HU13 | Catálogo curado de rutas, fuentes y recursos | Alejandro | Media | 6–10 h | HU01 | RF-07; RF-08; RF-10; RF-17 |
| SP2-HU14 | Rutas fundamentadas y restricciones | Mauricio | Alta | 6–10 h | HU07 o contexto directo; HU11; HU13 | RF-07; RF-08; RF-17 |
| SP2-HU15 | Comparar rutas, realizar experimento y ver plan | Alejandro | Media | 8–12 h | HU14, HU23 | RF-07; RF-09; RF-10 |
| SP2-HU16 | Consola mínima de facilitación | Alejandro | Media | 3–5 h | HU02, HU03; contratos HU23 | RF-11 |
| SP2-HU17 | Exportación controlada y eliminación | Mauricio | Alta | 10–14 h | HU03, HU07, HU09; dependencias registradas | RF-12 |
| SP2-HU18 | Presupuesto, fallos y reintentos de IA | Mauricio | Alta | 10–14 h | HU02; integración transversal | RF-13 |
| SP2-HU19 | Límites de acompañamiento y frontera privada | Mauricio | Alta | 6–10 h | HU03, HU04 | RF-14; RF-15 |
| SP2-HU20 | Referencias y evaluación de calidad | Alejandro | Media | 6–10 h | HU06, HU11, HU13, HU19 | Motor IA §6; métricas §10 |
| SP2-HU21 | Aceptación E2E ES/EN y piloto guiado | Alejandro | Media | 8–12 h | Todas las puertas de lanzamiento; T02 | RF-01–17; DoD §12 |
| SP2-HU22 | Utilidad y métricas mínimas del piloto | Alejandro | Baja | 3–5 h | HU02, HU03; eventos del flujo | Analítica §10; RF-11 |
| SP2-HU23 | Experimento, revisión y plan persistentes | Mauricio | Alta | 6–10 h | HU09, HU14 | RF-09; RF-10 |
| SP2-T02 | CI, staging y reversión verificables | Mauricio | Alta | 6–10 h | T01; transversal | RNF §9; DoD §12 |

Las filas reflejan **todo el alcance de la entrega 2**, no lo que cabe en los primeros diez días. La necesidad de un control P0 no equivale a que cada control sea técnicamente complejo: tono, contenido y formularios también tienen criterios obligatorios.

## 4. Historias y criterios de aceptación

### SP2-T01 — Inventario y ADR de aplicación anfitriona · Mauricio

Tarea técnica habilitadora, 4–6 h. Comparar el código/ramas actuales de Elevation y Perfilador, dependencias, identidad, esquemas, datos QA y despliegues. No fusionar cambios locales ni usuarios por correo.

- Entregar matriz «reutilizable probado / adaptar / nuevo / no verificado» y ADR de anfitrión, identidad canónica, almacenamiento, proveedores y reversión.
- Revisar ownership en rutas/helpers, consentimiento efectivo y sanitización del prompt completo; un README o protectedProcedure no acreditan aislamiento.
- Ejecutar un smoke reproducible con datos sintéticos cuando exista entorno y documentar lo que no se pudo ejecutar.
- Actualizar horas por persona y dependencias. Si no termina en 6 h, cerrar diagnóstico y estimar la continuación; no absorber una migración completa en esta tarea.
- Revisar la propuesta de dos bases detrás de adaptadores del PRD. Una consolidación o integración no demostrada requiere nueva estimación; no se impone Nest/Next.

### SP2-HU01 — Entrada y contexto de las seis personas · Alejandro

Como participante, quiero declarar mi objetivo y mis restricciones para recibir un recorrido pertinente.

- Formulario ES/EN con idioma, residencia, mercado objetivo, zona horaria, profesión, intereses y disponibilidad como campos distintos.
- Permitir entrada emocional, profesional y de urgencia, sin exigir introspección ni relato íntimo.
- Caracterizar los seis casos para curar el catálogo, sin copiar datos personales a la documentación ni asumir profesiones digitales.
- Validar campos y conservar avance autorizado. Depende del contrato de identidad y preferencias definido en T01/HU02; preparar el formulario durante su desarrollo.

### SP2-HU02 — Acceso individual y roles de servidor · Mauricio

Como participante, quiero una identidad estable y acceso exclusivo a mis datos para usar ambos dominios con una sola sesión visible.

- Reutilizar la solución de autenticación que confirme el ADR; no asumir que los magic links locales de Perfilador ya están publicados ni exigir un proveedor nuevo.
- Resolver propietario, organización opcional y permisos en servidor. Facilitar por asignación y consentimiento; administrador de cohorte no recibe contenido privado.
- Probar A/B y, donde aplique multitenancy, O1/O2: cambiar IDs no permite leer, escribir, exportar ni finalizar sesiones ajenas.
- Cubrir login, expiración, logout y revocación. Si el mecanismo usa enlaces, cubrir consumo único y vencimiento. La cuenta legada se relaciona por ID controlado, no por coincidencia de correo.

### SP2-HU03 — Consentimiento por propósito y revocación · Mauricio

Como participante, quiero elegir cada uso de mis datos y revocarlo sin perder funciones no relacionadas.

- Enumerar operación necesaria, puente profesional, compartir con facilitador, investigación y notificaciones; persistir propósito, alcance, versión, fecha y estado.
- Rechazar investigación/notificaciones no bloquea uso necesario. La autorización debe verificarse al acceder, no solo al guardar un checkbox.
- Revocar compartir retira el acceso futuro del facilitador y nuevas exportaciones dependientes. HU07/HU17 completan invalidación de derivados/cachés.
- Probar decisiones contradictorias, revocación durante acceso y permisos previamente concedidos. Definir contratos para la UI y analítica sin contenido privado.

### SP2-HU04 — Conversaciones y diario privados recuperables · Mauricio

Como participante, quiero retomar mi conversación y conservar mis entradas privadas después de una interrupción.

- Verificar propietario en todos los accesos a sesiones, mensajes y entradas. El motor profesional no recibe acceso directo al almacenamiento privado.
- Persistir turnos confirmados y estados recuperables; reintentar un requestId no duplica mensajes/resultados. Recuperar desde otro navegador autenticado.
- Crear, editar y borrar entradas fechadas; consultar una entrada como contexto requiere selección explícita. Guardar no comparte con facilitador ni carrera.
- Borrar una entrada la retira de futuras consultas/contextos y registra invalidación de dependencias; HU17 completa purga y copias.
- Fallo de proveedor conserva la última versión válida y una acción de recuperación. Integrar límites/timeout de HU18 antes de abrir el piloto.

### SP2-HU05 — Mi espacio y diario ES/EN · Alejandro

Como participante, quiero conversar, escribir o hacer una pausa en un espacio privado y sencillo.

- Navegación persistente hacia Mi espacio y Mi siguiente paso; crear/editar/borrar entradas y seleccionar su uso como contexto con las APIs autorizadas.
- Estados vacío, guardando, confirmado y fallido; no presentar texto no guardado como persistido. La interrupción conserva el último contenido confirmado.
- Silencio y abandono de ejercicio no generan presión, penalización ni tareas automáticas.
- UI responsive y por teclado en ambos idiomas; ninguna entrada aparece en rutas ni vistas de facilitador.

### SP2-HU06 — Tono socrático y ejercicios bilingües · Alejandro

Como participante, quiero un acompañamiento respetuoso que pueda omitir y cerrar sin presión.

- Preparar catálogo inicial acotado de reflexión, valores y logros, con propósito, duración, opción de omitir y versiones ES/EN revisadas.
- Una pregunta principal a la vez; no cerrar siempre con preguntas. Ante petición de silencio, respuesta breve y sin seguimiento automático.
- Fortalezas sustentadas en el relato, sin halagos inventados, diagnóstico, promesa clínica ni apariencia de humano en vivo.
- Mauricio valida la integración y el especialista asignado revisa los escenarios sensibles de HU19; Alejandro prepara contenido y fixtures, sin asumir validación clínica.

### SP2-HU07 — Puente profesional autorizado y versionado · Mauricio

Como participante, quiero autorizar campos concretos de mi exploración para carrera y poder retirar esa autorización.

- CareerContextVersion solo contiene campos profesionales seleccionados y confirmados; nunca transcript completo, diario ni indicadores de crisis.
- Registrar dueño, versión y permisos de origen; verificar en servidor que el consumidor recibe exactamente esos campos.
- Cambiar un origen privado no actualiza el contexto automáticamente. Revocar invalida derivados dependientes y exige recálculo con fuentes todavía permitidas.
- Soportar contexto profesional ingresado directamente, sin pasar por exploración. Probar ambos caminos y capturar entradas del motor para verificar la frontera.

### SP2-HU08 — Brújula editable y vista previa del puente · Alejandro

Como participante, quiero corregir la síntesis y ver exactamente qué voy a compartir.

- Editar, rechazar o confirmar cada conclusión; indicar «aún no confirmado» y su versión.
- Vista previa campo por campo del puente con selección explícita, límites y confirmación; continuar también sin transferir nada.
- Mostrar revocación y resultados afectados «para revisión» según HU07; no mostrar derivados revocados como vigentes.
- No convertir valores, preferencias o emociones en puntajes de competencia.

### SP2-HU09 — Evidencia profesional con procedencia · Mauricio

Como participante, quiero registrar mi contribución real con sus límites para sustentar capacidades sin inventar resultados.

- Guardar situación, responsabilidad, acciones, alternativas, entrega, efecto observado, aprendizaje y autonomía; separar meta de logro.
- Distinguir autorreporte, artefacto examinado y ejercicio observado; permitir resultado desconocido.
- Autorización por dueño y referencias válidas; archivos opcionales y no confiables, sin ejecutar instrucciones incrustadas.
- Definir el mecanismo seguro para adjuntos en T01; si no está disponible, explicitar su ausencia sin exigir archivos al participante.
- Versionar cambios/invalidation de evaluaciones dependientes; validar esquemas y citas antes de persistir.

### SP2-HU10 — Mis evidencias: captura y revisión · Alejandro

Como participante, quiero redactar y corregir casos profesionales sin que el sistema aumente mis logros.

- Formulario guiado y tarjetas ES/EN con tipo de evidencia y límites visibles.
- «La meta era 10.000» no se etiqueta como «logré 10.000»; la persona confirma los datos antes de evaluar.
- Campo de muestra opcional según contrato seguro; permitir casos sin adjunto y sin efecto conocido.
- Errores de entrada claros, acceso por teclado y preservación del avance confirmado; sin errores 500 para datos inválidos.

### SP2-HU11 — Skill Map trazable con nivel nullable · Mauricio

Como participante, quiero un mapa sustentado en evidencias y rúbricas, incluso si mi profesión no es técnica.

- Taxonomía acotada al catálogo del piloto con claves canónicas y capacidades transversales/de dominio; cada evaluación referencia evidenceIds y rúbrica/versiones.
- Escala nueva 1–4 con nivel null cuando falta evidencia; estados inicial, revisada y contradictoria, además de sin evidencia.
- Mantener autoevaluación y revisión separadas; confianza cualitativa con motivo. No usar porcentaje de empleabilidad ni subir nivel por ánimo/satisfacción.
- Conservar las evaluaciones técnicas legadas con su escala 1–5; ninguna conversión automática.
- Validar salida del modelo, skill keys, pertenencia y citas; señal/evaluación y mapa se confirman atómica e idempotentemente. Revisión humana ante discrepancia.

### SP2-HU12 — Radar explicable y sin déficits ficticios · Alejandro

Como participante, quiero entender qué respalda cada capacidad y qué puedo probar después.

- Mostrar evidencia, nivel o «sin evidencia», rúbrica, contexto, confianza y siguiente paso.
- Citas comprobadas por HU11; nada de barras de déficit para nivel null.
- No comparar capacidades inconmensurables como números equivalentes; las traducciones no cambian el nivel.
- Mostrar resultados obsoletos o contradictorios y acceso a objetar revisión según contrato.

### SP2-HU13 — Catálogo curado de rutas, fuentes y recursos · Alejandro

Como participante, quiero opciones pertinentes a mi contexto y recursos verificables para una brecha concreta.

- Preparar catálogo acotado a los seis contextos; curación manual autorizada, fuentes oficiales y revisión de dominio identificada.
- Cada función/ruta indica industria, tareas, país/mercado, idioma, barreras, capacidades y referencias con fecha.
- Ofertas vigentes solo después de comprobar página oficial; salario no publicado se declara así, y no se infiere demanda desde unas pocas ofertas.
- Lecturas/cursos con propósito, idioma, nivel, duración y precio publicado o por confirmar; vincular a una brecha y un ejercicio.
- Explicar tareas afectadas por IA con fuente o hipótesis marcada, sin porcentajes individuales de reemplazo. Revisión semanal y antes de mostrar vigencia; no crawler obligatorio.

### SP2-HU14 — Rutas fundamentadas y restricciones · Mauricio

Como participante, quiero comparar opciones defendibles sin que mi profesión me dirija por defecto a programación.

- Filtrar primero restricciones no negociables y fuentes autorizadas; datos faltantes quedan por confirmar.
- Proponer continuidad, adyacencia y exploración cuando haya fundamento; aceptar una o dos rutas si el catálogo no sustenta tres.
- Separar preferencias, transferencia demostrada y viabilidad; no agregar un porcentaje global de empleabilidad.
- Profesiones reguladas indican habilitación pendiente sin afirmar elegibilidad por residencia.
- Propuestas automáticas sobre catálogo curado con esquema validado y fuentes; falta de pertinencia ofrece revisión humana, sin inventar vacantes. Conservar versión y dependencias.

### SP2-HU15 — Comparar rutas, realizar experimento y ver plan · Alejandro

Como participante, quiero elegir, probar y revisar una ruta hasta tener un siguiente paso concreto.

- Fichas comparables con razones, límites, fuentes, brechas y rechazo/elección; no mostrar selección como contratación garantizada.
- Experimento con pregunta, tiempo, costo conocido, criterio y entrega; guardar avance y feedback. Un curso o checkbox no acredita capacidad.
- Registrar decisión razonada y plan 7/30/90 generado por HU23, con acciones aceptadas y recursos pertinentes.
- Explicar cambios de versión y mantener navegación completa ES/EN sin scripts operativos intermedios.

### SP2-HU16 — Consola mínima de facilitación · Alejandro

Como facilitador asignado, quiero ver progreso y fallos recuperables para apoyar sin acceder a la exploración privada.

- Vista operativa de seis personas con invitación/avance/fallos y materiales explícitamente compartidos; consumir solo contratos autorizados de HU02/HU03.
- No mostrar chats, diario, ánimo, puntuaciones privadas ni indicadores de crisis.
- Registrar revisión profesional con autor/fecha/evidencia y permitir objeción; las acciones sobre estados se autorizan en servidor.
- Suprimir subgrupos menores de cinco y combinaciones identificables; el caso EN no se expone como agregado separado.

### SP2-HU17 — Exportación controlada y eliminación · Mauricio

Como participante, quiero exportar lo elegido y eliminar mis datos y derivados de forma verificable.

- Vista previa y exportación profesional solo con campos/evidencias elegidos; exportación personal completa solo al dueño autenticado.
- Eliminar origen invalida evaluaciones/rutas/cachés dependientes. Solicitud de cuenta bloquea acceso y genera trabajo auditable.
- Probar revocación entre vista previa y descarga, enlaces/archivos de exportación y reintentos de borrado.
- Confirmar capacidad de proveedores para los plazos propuestos de 7/30 días antes de prometerlos; restauración reaplica borrados antes de habilitar acceso.
- Dar a Alejandro contratos para controles UI sencillos; Mauricio mantiene diseño y validación del borrado/permisos.

### SP2-HU18 — Presupuesto, fallos y reintentos de IA · Mauricio

Como participante y operador, quiero que los fallos y el agotamiento del presupuesto no pierdan mi trabajo ni provoquen ejecución ilimitada.

- Presupuesto persistente por persona/cohorte, reserva atómica previa, límites de tokens y configuración de precios versionada; no inventar tarifas.
- Estado/requestId/jobId, timeout y reintentos acotados; recuperación tras reinicio, sin duplicar resultados ni cargos propios.
- Registrar uso/costo del proveedor cuando sea conocido; rollback de datos no revierte automáticamente su facturación.
- Esquemas y sanitización de todos los campos del prompt, incluidos historial y contexto, con pruebas de secretos ficticios y entrada maliciosa.
- Telemetría de versiones, latencia, uso y error sin conversaciones crudas; probar concurrencia y conservar la última versión válida.

### SP2-HU19 — Límites de acompañamiento y frontera privada · Mauricio

Como participante, quiero apoyo no clínico y una respuesta de seguridad coherente con mi país sin exponer mi situación a terceros.

- Interrumpir el flujo ordinario en escenarios graves según protocolo revisado; no diagnosticar, prescribir ni atribuir eficacia clínica.
- Recursos locales mantenidos y verificados por país/fecha antes de publicar; no inferir país del idioma.
- No enviar alertas automáticas a empresa/facilitador ni transferir indicadores de riesgo al motor profesional.
- Revisar escenarios ES/EN con especialista identificado antes de abrir piloto. Mauricio implementa los controles; Alejandro coordina la validación editorial/especializada. La especialidad y su disponibilidad no se presuponen.
- Registrar límites del detector; no presentar cero casos detectados como garantía de seguridad.

### SP2-HU20 — Referencias y evaluación de calidad · Alejandro

Como responsable de producto, quiero evidencia de calidad antes de usar recomendaciones con las seis personas.

- Preparar 30 casos sintéticos/autorizados, incluidos al menos diez no técnicos y cinco adversos; esas categorías pueden solaparse.
- Cubrir ES/EN, datos escasos, contradicción, fuente inexistente, profesión regulada, inyección y revocación. Resultado esperado, citas/rangos y criterios por caso.
- Revisión humana de dominio y revisión técnica de Mauricio; rangos sintéticos no se declaran calibrados por existir fixtures.
- Ejecutar regresión del flujo y corrida controlada del proveedor: cero violaciones críticas y al menos 24/30 pertinentes/justificados según rúbrica, con desacuerdos documentados.
- Separar pruebas con mocks de calidad real del modelo. Si falla la puerta, corregir/repetir antes de invitar.

### SP2-HU21 — Aceptación E2E ES/EN y piloto guiado · Alejandro

Como fundador, quiero verificar el recorrido completo antes de invitar y acompañar a los seis participantes.

- En navegador y staging real: acceso → consentimiento → espacio/brújula opcionales → puente o contexto directo → evidencia → mapa → rutas → experimento → revisión → plan/exportación.
- Cubrir ambas entradas, idiomas, profesiones no técnicas, recuperación desde otro navegador, aislamiento, revocación/borrado, presupuesto y fallos.
- Distinguir HTTP/HTML, unitarias, integración DB y E2E visual; no declarar completo un tramo parcial ni sustituir funciones ausentes por scripts.
- Revisar los seis recorridos del piloto (cinco ES/uno EN), con soporte y responsable de incidente. Invitación real solo tras aprobar todas las puertas y disponibilidad de exportación/eliminación.
- Registrar los resultados de 7/30 días después, no como metas ya cumplidas al desplegar.

### SP2-HU22 — Utilidad y métricas mínimas del piloto · Alejandro

Como fundador, quiero medir valor emocional y profesional sin recopilar conversaciones ni convertir malestar en una métrica comercial.

- Captura opcional de utilidad/claridad y sentirse escuchado, con denominadores y respuestas faltantes.
- Eventos mínimos seudónimos del PRD con versión/requestId cuando aplique; sin texto de chat, citas, CV ni etiqueta emocional.
- Mostrar 5/6 activación, 4/6 experimento/decisión, 5/6 acompañamiento y 4/6 utilidad como metas propuestas del piloto, cada una con su ventana.
- No exigir contexto profesional para acreditar valor emocional; separar visitas/mensajes de acciones sustantivas y no comparar el subgrupo EN.
- APIs pequeñas bajo permisos ya definidos por Mauricio; cualquier cambio de acceso vuelve a su revisión.

### SP2-HU23 — Experimento, revisión y plan persistentes · Mauricio

Como participante, quiero que mi prueba y decisión actualicen un plan realizable y recuperable.

- Experimento vinculado a ruta, pregunta, rúbrica, evidencia esperada y tarea inicial de 20–45 minutos; coordinación externa puede tardar más.
- Estados de avance/entrega/revisión y feedback separando observación e interpretación. IA asistida conserva grado de ayuda; no acredita autonomía sin evidencia.
- Persistir decisión razonada y propuesta 7/30/90 con disponibilidad, dependencias, fechas elegidas y evidencia de finalización.
- Nueva evidencia o revocación invalida versiones afectadas y explica el cambio; usuario confirma tareas y recordatorios opcionales.
- Flujo automático de aplicación hasta resultado válido; la revisión humana explícita tiene estado visible. No contactar empleadores ni postular por el usuario.

### SP2-T02 — CI, staging y reversión verificables · Mauricio

Tarea técnica transversal.

- Entorno identificado, ramas/checks reproducibles, migraciones versionadas, fixtures separados de datos profesionales y secretos fuera de Git.
- Probar conexión/cifrado y permisos efectivos; revisar específicamente protección del contenido privado y acceso a claves.
- Pruebas de integración con DB real, restauración/borrado y reversión de la integración sin escrituras dobles no conciliadas.
- Operar errores y soporte con responsable. Una demo de UI no sustituye la aceptación de almacenamiento/proveedor/navegador.
- Alejandro participa en smoke y reporte; estimación adicional si el inventario descubre migración de infraestructura.

## 5. Orden de trabajo y revisión de plazo

1. **Primero T01 y caracterización HU01.** Mauricio valida reutilización; Alejandro identifica los seis contextos sin invitar a usar contenido privado.
2. **Base de confianza:** HU02/HU03/HU04, seguridad HU19, operación HU18 y T02 desde el inicio. Alejandro prepara HU05/HU06 bajo esos contratos.
3. **Frontera y evidencia:** HU07/HU08 y HU09/HU10. El contexto directo permite avanzar sin obligar a usar exploración.
4. **Mapa y catálogo:** HU11/HU12 y HU13. Probar al menos una profesión no técnica antes de ampliar.
5. **Ciclo profesional:** HU14/HU23/HU15, después HU16/HU22. Automatizar el flujo de datos; mantener curación y revisiones explícitas.
6. **Cierre:** HU17, HU20 y HU21; diseño de borrado/dependencias y corpus empiezan antes, aunque su aceptación completa es al final.

En el checkpoint de T01 se acuerdan duración ampliada, fechas y un corte demostrable de los primeros diez días, usando capacidad por persona. No prometer todo el piloto en la ventana inicial ni llenar el tiempo de Alejandro con trabajo bloqueado por APIs.

Las tareas de interfaz pueden usar fixtures basados en contratos aprobados mientras llega el backend; terminar contra mocks no cierra la historia integrada. La reserva se usa para revisión y correcciones, no para introducir alcance adicional oculto.

## 6. Definición de terminado y puertas del piloto

Por historia: criterios probados, permisos/errores, migración/contratos/versiones, evidencia verificable, instrumentación mínima sin datos privados y documentación. Revisor distinto del autor; revisión especializada donde el PRD la exige.

Antes de invitar a las seis personas, exigir:

- Una experiencia e identidad visibles; ownership y roles probados en DB real.
- Consentimientos/revocación y puente que no transfiera diario/transcripts/riesgo.
- Flujo emocional respetuoso y profesional completo en ES y EN, con recuperación.
- Evidencia verificable, mapa sin niveles ficticios y opciones pertinentes no técnicas.
- Catálogo con fuentes vigentes cuando se afirme vigencia, sin oportunidades inventadas.
- Experimento, revisión, plan, exportación y borrado funcionales.
- Presupuesto y recuperación comprobados; soporte y especialistas asignados.
- Corpus de 30 casos y recorrido visual aceptados; ningún hallazgo crítico abierto.

Una historia P0 sin cerrar mantiene el piloto cerrado. La curación manual autorizada no permite suplir identidad, revocación, recuperación o borrado con promesas o acciones ad hoc.

## 7. Reutilización observada y límites de esta planificación

Lectura documental de main el 20 de octubre: Elevation contiene código de login manual, esquema de usuarios/perfiles/consentimientos/sesiones/mensajes/reflexiones y rutas tRPC. Se inspeccionaron también helpers de DB. No se ejecutó Elevation ni se validó su despliegue o cifrado.

Ejemplo que debe revisar T01/HU02/HU04: getHistory recibe sessionId y llama a getSessionMessages(sessionId); el helper consultado filtra por sessionId, sin dueño. endSession y saveMessage también requieren revisar pertenencia. Es un hallazgo de lectura de esos caminos, no una prueba de explotación en producción. La presencia de código no permite marcar las historias como aceptadas.

Perfilador ya tiene avances locales de autenticación/sesiones, pero la prueba HTTP desplegada encontró Basic Auth/selector compartido y recuperación ausente. Reutilizar contratos/código solo tras verificar rama, compatibilidad y aislamiento; no migrar automáticamente escalas ni evidencia QA.

Fuentes de trabajo:

- [PRD](02-PRD.md), [contexto y decisiones](00-LEEME.md), [validación](03-VALIDACION-Y-FUENTES.md).
- [Informe funcional de Perfilador](https://github.com/AlejoRoldan/perfiladorV2/blob/docs/elevation-skillmap-sprint-2/perfiladorV2-scaffold/docs/FUNCTIONAL_E2E_RESULTS_2026-10-20.md).
- [Elevation README](https://github.com/AlejoRoldan/gpt-elevation-MVP/blob/main/README.md), [schema](https://github.com/AlejoRoldan/gpt-elevation-MVP/blob/main/platform/drizzle/schema.ts), [routers](https://github.com/AlejoRoldan/gpt-elevation-MVP/blob/main/platform/server/routers.ts), [helpers DB](https://github.com/AlejoRoldan/gpt-elevation-MVP/blob/main/platform/server/db.ts).

Este documento distribuye trabajo propuesto entre Mauricio y Alejandro. No crea issues/PRs, no notifica personas ni modifica datos de los pilotos. La fecha final y la validación de especialistas quedan pendientes del checkpoint técnico.
