# PRD · Elevation + Skill Map

Versión 0.2 · 20 de octubre de 2026 · Incorpora decisiones del fundador: apoyo emocional no clínico, seis participantes en Colombia y Dinamarca, cinco ES / una EN, financiación del fundador. Pendientes: presupuesto, equipo, fecha y diseño técnico.

**Decisión técnica vigente · 22 de octubre de 2026:** Alejo adopta la decisión de Mauricio registrada en [ES-57](https://iatech-team-xqxmjki1.atlassian.net/browse/ES-57): `frontend/` React/TypeScript + `backend/` Express/Sequelize/Postgres, con Claude como LLM, en [iatechdev/gpt-elevation-MVP](https://github.com/iatechdev/gpt-elevation-MVP). Next.js queda fuera del alcance activo y se conserva como referencia. Esta decisión sustituye las propuestas abiertas de anfitrión y almacenamiento de la sección 8; MySQL/Drizzle no es la base activa.

**Hosting aprobado · 22 de octubre de 2026:** Alejo aprueba Railway conforme a la propuesta de [ES-8](https://iatech-team-xqxmjki1.atlassian.net/browse/ES-8), manteniendo Postgres en Supabase. Infraestructura, entornos separados y CI deben adaptarse a ese destino; su existencia y funcionamiento requieren verificación. La aprobación de hosting no acredita QA, aprovisionamiento ni despliegue y no autoriza el merge o el corte de producción.

**Procesamiento del incremento 1 · V-10:** Alejo elige Postgres + worker + Redis. Postgres conserva trabajos, estados y permisos; Redis transporta solo IDs, con reconciliación desde Postgres ante fallos. Permisos, publicación bajo consentimiento, configuración, límites, costos e implementación siguen pendientes de concretar y probar. Ver [registro de validación](../08-REGISTRO-VALIDACION-CTO.md).

Actualización de planificación posterior a esta versión: [Sprint 2 — HUs y distribución](../04-SPRINT-2-HUS.md) registra el equipo Mauricio/Alejandro, la capacidad declarada y la decisión de revisar la ampliación del plazo tras validar reutilización. Los pendientes de equipo/disponibilidad de las secciones originales deben leerse junto con esa actualización; presupuesto, fecha final y arquitectura aún requieren cierre.

## 1. Problema y resultado

Un profesional que quiere cambiar de industria necesita un espacio para explorar lo que vive, reconocer fortalezas y conectar lo que desea con capacidades y oportunidades. El producto ofrece apoyo emocional y autoconocimiento sin atención clínica, junto con orientación profesional. No toda sesión emocional debe terminar en una tarea laboral.

**Aprendizaje del fundador:** conservar tono socrático, pausas y silencio, feedback cercano, respetuoso y centrado en aspectos positivos, ejercicios y diario emocional. Conservar radar de competencias y recomendaciones de cargos, roles, ofertas, lecturas y cursos en industrias digitales y otras. Son observaciones aportadas por el fundador; la revisión técnica parcial no valida su eficacia ni toda su implementación actual.

**Resultado del MVP:** la persona encuentra acompañamiento emocional respetuoso y, cuando lo elige, confirma una brújula, construye un mapa con evidencias, compara rutas, realiza un experimento y revisa su decisión. Debe funcionar para profesiones no técnicas, en español e inglés, y permitir saltar la introspección profunda.

**Hipótesis de negocio:** acompañamiento emocional y orientación juntos aportan valor; un catálogo acotado puede ser pertinente; el costo es sostenible. La disposición a pagar se prueba después: el fundador financia el piloto. Ver [canvas](../01-CANVAS-NEGOCIO.md) y [validación](../03-VALIDACION-Y-FUENTES.md).

## 2. Personas y alcance

| Persona | Necesidad | Permisos propuestos |
| --- | --- | --- |
| Profesional adulto | Entender opciones y probar una transición. | Dueño de su exploración, perfil, evidencias, rutas y decisiones; controla exportación, cesión y eliminación. |
| Facilitador asignado | Ayudar a completar y revisar el proceso. | Progreso operativo y materiales profesionales compartidos explícitamente; nunca acceso general a exploración privada. |
| Administrador de cohorte | Invitar personas y operar el programa. | Invitaciones, elegibilidad y agregados autorizados; sin acceso a chats o puntuaciones personales por defecto. |
| Operador técnico | Resolver fallos. | Metadatos técnicos mínimos; acceso excepcional a contenido bajo procedimiento registrado y limitado. |

Piloto confirmado: seis personas en reconversión, cinco en español y una en inglés, en Colombia y Dinamarca, financiado por el fundador. No asumir distribución por país ni equiparar idioma con residencia. Falta confirmar profesiones, industrias, mercados de destino, situación laboral y disponibilidad. Proponer web móvil/escritorio y catálogo curado desde las necesidades de esas seis personas, ampliándolo solo cuando falte una ruta plausible. La duración de 30 días es propuesta y debe acordarse.

**P0:** identidad y consentimiento; conversación socrática ES/EN, ejercicios y diario emocional; exploración/síntesis; puente autorizado; evidencia; mapa explicado; rutas y ofertas verificadas cuando estén disponibles; lecturas/cursos vinculados a brechas; experimento; revisión; exportación/eliminación; recuperación de fallos y medición. En piloto la curación de oportunidades y recursos puede ser manual.

**P1 tras validar:** ampliación del catálogo, automatización de aprendizaje, conectores adicionales y panel de cohortes más completo.

**Fuera del MVP:** terapia, diagnóstico, selección automática de personal, ranking entre participantes, garantía de empleo, postulaciones automáticas, marketplace, catálogo universal, integración SDLC obligatoria, aplicación móvil nativa y ejecución arbitraria de código. Vacantes pueden incorporarse manualmente desde fuentes oficiales; no es obligatorio construir un crawler.

## 3. Principios que afectan el diseño

1. La persona puede explorar su identidad sin que eso se transforme en una calificación laboral.
2. Una preferencia no demuestra una habilidad; una habilidad no implica deseo de ejercerla.
3. La falta de evidencia se muestra como pendiente, sin asignar un déficit ficticio.
4. Cada recomendación profesional explica datos usados, límites y siguiente prueba.
5. Las hipótesis se corrigen y versionan; el usuario decide qué camino seguir.
6. La experiencia termina cada tramo con un resultado útil; no exige prolongar el chat.

## 4. Recorrido y pantallas

| Pantalla | Acción principal | Salida y estado vacío |
| --- | --- | --- |
| Entrada | Elegir exploración, transición o urgencia; aceptar tratamiento necesario. | Objetivo y restricciones. Sin historial: comenzar con una experiencia significativa. |
| Mi espacio | Conversar con ritmo socrático, hacer un ejercicio o guardar una entrada del diario emocional privado. | Reflexión opcional; cerrar sin pregunta ni tarea cuando corresponda. Nunca perder texto confirmado. |
| Mi brújula | Explorar valores, motivaciones y límites a partir de lo que la persona decida compartir. | Síntesis editable; «aún no confirmado» antes de aprobación. |
| Puente profesional | Elegir qué conclusiones pasar al proceso de carrera. | Vista previa campo por campo y confirmación. Si no autoriza, continuar con datos profesionales ingresados directamente. |
| Mis evidencias | Relatar casos y adjuntar muestras anonimizadas opcionales. | Tarjetas con contribución, acciones, resultado, origen y revisión. Sin muestra: autorreporte declarado. |
| Mi Skill Map | Ver capacidades, estado de evidencia y contexto. | Explicación por capacidad. Sin evidencia: propuesta de ejercicio, sin barra de déficit. |
| Mis rutas | Comparar continuidad, adyacencia y exploración. | Función, industria, ajuste explicado, barreras, fuentes, brechas y prueba sugerida. Sin catálogo pertinente: informar límite y ofrecer revisión humana. |
| Mi experimento | Elegir y realizar entrevista, muestra o ejercicio contextualizado. | Resultado, feedback y cambio de decisión. Sin entrega: guardar avance y reagendar opcionalmente. |
| Mi siguiente paso | Confirmar ruta o descartarla, consultar una oferta y elegir un recurso para una brecha. | Plan 7/30/90 y exportación profesional controlada; lecturas y cursos con propósito. |

Hay dos entradas persistentes: «Mi espacio» para acompañamiento y diario, y «Mi siguiente paso» para orientación. Flujo profesional: entrada → brújula opcional → puente consentido → evidencia → mapa → rutas → experimento → revisión → plan. Se puede volver al espacio emocional sin perder avance ni exportar conversaciones. La persona puede volver atrás; resultados afectados por cambios se marcan para revisión.

## 5. Requisitos y aceptación funcional

### RF-01 · Identidad, propiedad y sesiones (P0)

Una identidad interna estable vincula la cuenta con el recorrido, independientemente del proveedor de autenticación. Organización y rol se resuelven en servidor. Sesiones y mensajes confirmados se guardan en servidor.

**Aceptación:** A no puede leer, modificar o exportar material de B cambiando IDs; lo mismo entre organizaciones. Un enlace de acceso consumido o vencido no funciona. Recargar y volver desde otro navegador autenticado recupera el último turno confirmado. La finalización concurrente produce un solo resultado durable. La prueba debe realizarse sobre base de datos real de staging y dos identidades sintéticas.

### RF-02 · Consentimiento por propósito (P0)

Separar tratamiento necesario para operar, transferencia desde exploración a carrera, compartir con facilitador, investigación y notificaciones. Investigación y notificaciones son opcionales. Registrar propósito, versión, fecha y revocación.

**Aceptación:** rechazar investigación no bloquea el recorrido. Revocar compartir elimina acceso futuro del facilitador y evita nuevas exportaciones autorizadas por ese permiso. Se informa que una copia ya descargada no puede recuperarse automáticamente. No usar un checkbox global para todas las finalidades.

### RF-03 · Brújula personal (P0)

Explorar valores, intereses, actividades que dan o quitan energía, condiciones deseadas y restricciones declaradas. Las afirmaciones de IA son propuestas de síntesis; no diagnósticos ni rasgos psicométricos.

**Aceptación:** cada conclusión se puede editar, rechazar y confirmar. Se conserva el origen dentro del espacio privado. El usuario puede omitir cualquier tema íntimo. Ningún resultado laboral depende de revelar experiencias privadas. La ruta de urgencia conduce a acciones profesionales sin exigir esta etapa.

### RF-04 · Puente de consentimiento (P0)

Crear una versión de contexto profesional a partir exclusivamente de campos seleccionados: motivaciones, preferencias y restricciones relevantes. Prohibir transferir transcripciones completas, entradas del diario emocional o etiquetas de crisis al motor profesional. La persona puede redactar una conclusión profesional propia a partir de una entrada, revisarla y autorizar ese texto específico.

**Aceptación:** antes de confirmar se muestran los campos exactos. El motor de rutas recibe solo la versión aprobada. Una modificación privada posterior no actualiza ese contexto automáticamente. Revocar una transferencia invalida el acceso y los derivados dependientes, que deben recalcularse con los datos todavía autorizados. Trazas de prueba permiten verificar qué campos cruzaron la frontera.

### RF-05 · Evidencias de trayectoria (P0)

Capturar situación, responsabilidad personal, acciones, alternativas, resultado, aprendizaje y autonomía. Distinguir objetivo buscado, entrega realizada y efecto observado. Adjuntar muestras es opcional; no exigir material de terceros o del empleador.

**Aceptación:** «la meta era 10.000 usuarios» no se transforma en «logré 10.000 usuarios». Cada afirmación indica autorreporte, artefacto examinado o ejercicio observado. Un caso sin resultado conocido se conserva con ese límite. Los archivos y textos se tratan como datos no confiables; instrucciones incrustadas no modifican el comportamiento del sistema.

### RF-06 · Skill Map generalizable (P0)

Capacidades transversales y de dominio con claves canónicas y relaciones con funciones/industrias. Estados: sin evidencia, evidencia inicial, evidencia revisada y evidencia contradictoria. La autoevaluación y el veredicto de un revisor se conservan separados.

**Aceptación:** toda habilidad evaluada enlaza una evidencia y una rúbrica versionada. Una habilidad sin evidencia muestra nivel `null`. La autonomía propuesta usa 1 conceptual, 2 aplicada con asistencia, 3 autónoma y repetible, 4 lidera/enseña en situaciones complejas; no es certificación. Confianza cualitativa baja/media/alta explica calidad de la evidencia y no probabilidad de contratación. No comparar numéricamente capacidades ajenas como si fueran equivalentes.

### RF-07 · Tres rutas fundamentadas (P0)

Producir una ruta de continuidad, una adyacente y una exploratoria, siempre que el catálogo y las restricciones lo permitan. El usuario puede rechazar cualquiera. No forzar tres opciones inventadas si solo hay una o dos sustentables.

Cada ficha incluye función e industria, tareas habituales, capacidades transferibles con evidencia, habilidades pendientes, barreras de entrada, condiciones conocidas, fuentes y fechas, incertidumbres y experimento. Aplicar primero requisitos no negociables; si faltan datos, mostrar «por confirmar» y pedir aclaración.

**Aceptación:** una docente o contadora no recibe programación por defecto. La similaridad semántica puede recuperar candidatos, pero no autoriza por sí sola recomendar una ruta. Mostrar ajuste a preferencias, evidencia de capacidades y viabilidad como dimensiones separadas, sin porcentaje global de empleabilidad. Una profesión regulada se marca con barrera de habilitación pendiente; no afirmar elegibilidad sin fuente.

### RF-08 · Contexto de mercado y fuentes (P0)

Usar catálogo curado y fuentes con país, fecha de publicación si existe, fecha de consulta y tipo. Una oferta solo se etiqueta como vigente tras revisar la página oficial. Perfiles ocupacionales describen funciones; no prueban demanda local.

**Aceptación:** una oferta sin salario dice «no publicado». Fuente inaccesible o antigua no se presenta como confirmación actual. No estimar volumen de demanda desde unas pocas ofertas. Si no hay consulta actual, entregar ficha ocupacional y tarea de verificación. Guardar URL y extracto profesional mínimo cuando su uso esté permitido, sin copiar bases de vacantes. Separar Colombia y Dinamarca por mercado objetivo; comprobar idioma exigido, modalidad y elegibilidad publicada, sin inferir permiso de trabajo por residencia. No inventar ofertas para completar una cuota.

### RF-09 · Experimento profesional (P0)

Cada ruta ofrece al menos una prueba reversible: entrevista informativa realizada por el usuario, muestra de trabajo con datos ficticios o ejercicio de decisión. La tarea inicial cabe en 20–45 minutos; actividades externas pueden requerir coordinación y mayor plazo.

**Aceptación:** el experimento tiene pregunta a responder, esfuerzo, costo si aplica, criterio de éxito, evidencia esperada y rúbrica. Entregar un curso o pulsar «completado» no acredita competencia. El feedback distingue observación de interpretación; para pruebas conversacionales no afirmar desempeño real independiente sin artefactos o validación.

### RF-10 · Plan y seguimiento (P0)

Generar plan 7/30/90 según la ruta elegida, disponibilidad y restricciones. Cada acción tiene propósito, duración, dependencia, evidencia de finalización y fecha elegida. Incluir lecturas y cursos curados para brechas prioritarias, con enlace, idioma, nivel, tiempo y precio publicado o «por confirmar». Explicar por qué se recomienda cada recurso y qué ejercicio mostrará aprendizaje. Recordatorios requieren aceptación.

**Aceptación:** nuevas evidencias pueden cambiar la ruta; queda visible el motivo y la versión anterior. Ante sobrecarga se reduce alcance. Declarar mayor confianza o satisfacción no aumenta automáticamente el nivel de competencia. No contactar empleadores ni enviar solicitudes en nombre del usuario.

### RF-11 · Apoyo humano y cohortes (P0 mínimo / P1 expansión)

En piloto: invitación y progreso operativo de seis personas, lista de fallos recuperables y materiales compartidos. El fundador puede operar una consola mínima; no necesita un dashboard corporativo completo. Revisión de evidencia por un orientador o experto cuando sea necesaria, con dedicación por definir. Panel de cohortes, integraciones y reportes configurables quedan en P1.

**Aceptación:** el facilitador no ve chats privados, ánimo ni indicadores de crisis. Una revisión indica autor, fecha y evidencia; el usuario puede objetarla. Reportes agregados suprimen subgrupos con menos de cinco personas y combinaciones que permitan identificar a alguien. Este umbral es una regla de producto inicial, no garantía de anonimato.

### RF-12 · Exportación y eliminación (P0)

Exportar resumen profesional, evidencias elegidas, rutas y plan con vista previa. Exportar datos personales completos solo a la persona autenticada. Eliminar cuenta y datos derivados mediante trabajo auditable.

**Aceptación:** un reporte profesional no contiene mensajes privados ni campos desmarcados. Borrar una evidencia invalida evaluaciones y recomendaciones dependientes. Propuesta de operación: eliminación de datos activos en siete días, vencimiento de copias en 30 días y bloqueo de acceso desde la solicitud; confirmar capacidad de proveedores antes de prometer estos plazos. Una restauración reaplica solicitudes de borrado pendientes antes de habilitar acceso.

### RF-13 · Recuperación y presupuesto de IA (P0)

Timeouts, reintentos limitados, resultados estructurados validados, costos persistentes y mecanismo visible de reanudación. Presupuesto por persona y cohorte configurable; agotarlo no pierde trabajo ni dispara cobros no consentidos.

**Aceptación:** fallo de proveedor muestra estado recuperable y mantiene la última versión válida del mapa. Reintentar un turno o finalizar no duplica señales ni cargos propios del producto. Se registra uso facturado por el proveedor cuando sea conocido; no prometer evitar todos sus cargos duplicados. Una respuesta con habilidad desconocida se rechaza o envía a revisión, sin alterar el mapa.

### RF-14 · Límites de acompañamiento (P0)

El recorrido es de desarrollo personal y orientación profesional. En situaciones de riesgo grave se interrumpe el flujo ordinario y se muestra apoyo local verificado mediante un proceso mantenido. Un detector automático es una ayuda limitada, no un sistema clínico ni garantía de detección.

**Aceptación:** no se diagnostica, no se prescribe y no se genera una puntuación de salud mental o empleabilidad desde el malestar. La ruta profesional no recibe indicadores de riesgo. No se envían alertas a empresas ni a terceros automáticamente. Revisar escenarios de seguridad con especialistas antes del piloto y no reutilizar teléfonos sin verificar país y vigencia.

### RF-15 · Tono socrático, ejercicios y diario emocional (P0)

Conservar voz cálida, cercana y respetuosa; una pregunta principal a la vez, reflexiones breves y pausas sin presión para responder. Reconocer fortalezas desde lo que la persona cuenta, sin halagos inventados ni ocultar brechas profesionales. «Feedback humano» describe la calidad de la voz; la presencia de una persona debe identificarse explícitamente cuando exista.

El diario admite crear, editar, fechar y borrar entradas privadas, con etiqueta emocional opcional. La persona elige si el acompañamiento puede consultar una entrada como contexto; no acceder por defecto a todo el diario. Proponer ejercicios cortos de reflexión, valores o reconocimiento de logros con propósito, duración y opción de omitir. El catálogo inicial requiere revisión editorial en ambos idiomas.

**Aceptación:** no terminar todas las respuestas con preguntas; ante «quiero quedarme en silencio» responder una vez de forma breve y no generar seguimientos automáticos. Guardar una entrada no la comparte con carrera o facilitador. Borrar una entrada la retira del contexto y de derivados dependientes. Un ejercicio se puede abandonar sin penalización. No usar el ánimo declarado para subir o bajar el radar. No simular que una persona está leyendo en vivo el chat si no hay tal servicio.

### RF-16 · Español e inglés y contexto por país (P0)

Interfaz, consentimiento, conversación, ejercicios, diario, radar, explicaciones y exportaciones disponibles en ES y EN. Registrar por separado idioma preferido, país de residencia, mercado laboral objetivo y zona horaria. Conservar el texto original de evidencias; las traducciones son derivadas y se identifican.

**Aceptación:** una persona completa el recorrido en inglés sin depender de mensajes residuales en español. Los cinco recorridos ES también se revisan. Cambiar idioma no modifica evidencia o puntuación. Ofertas y cursos muestran su idioma real, aunque la interfaz use otro. Fechas y recordatorios usan la zona elegida, sin asumir que toda persona en Dinamarca habla danés. Una única persona EN permite descubrir problemas, no afirmar equivalencia estadística entre idiomas o países.

### RF-17 · Capacidades profesionales en la era de la IA (P0 curado)

Para cada ruta del piloto, describir tareas de la función, dónde se usa IA según fuentes o validación de dominio y qué capacidades humanas o de criterio siguen siendo importantes. Distinguir uso actual observado, hipótesis de cambio y dato desconocido. Incorporar alfabetización en IA solo cuando sea pertinente al rol; no convertir todas las rutas en empleos digitales.

**Aceptación:** no etiquetar una profesión como «sin futuro» ni asignar un porcentaje individual de reemplazo. Las afirmaciones sobre transformación del trabajo llevan fuente y fecha o se marcan como hipótesis. Un experimento puede comparar una tarea con y sin asistencia de IA, conservando la autoría y el grado de ayuda; el resultado no demuestra autonomía sin esa ayuda. Evaluar criterio, verificación y aplicación contextual, además de familiaridad con herramientas.

## 6. Motor de IA y evaluación

Usar un flujo acotado, con componentes de exploración, extracción de evidencia, correspondencia ocupacional y planificación. Estos componentes pueden ser módulos; no requieren desplegar agentes autónomos independientes.

| Función | IA puede proponer | Regla determinista / control |
| --- | --- | --- |
| Síntesis | Valores, preferencias y preguntas pendientes. | Confirmación del usuario y pertenencia al espacio privado. |
| Evidencia | Competencias candidatas, citas y límites. | Verificar que las citas existen y los IDs corresponden a la misma persona. |
| Evaluación | Aplicación de rúbrica y explicación. | Validación de esquema, versión y fuentes; revisión humana de discrepancias. |
| Rutas | Candidatos de catálogo y argumento de transferencia. | Restricciones, país, barreras, fuentes y autorización de datos. |
| Plan | Secuencia de tareas y experimento. | Disponibilidad, costos declarados, dependencias y aceptación de la persona. |

Registrar modelo, proveedor, versión de prompt/esquema/rúbrica/catálogo, IDs de evidencia autorizada, tokens/costo, latencia, estado y motivo de reintento. No registrar conversaciones crudas en telemetría general. La confianza declarada por un LLM no es una medida calibrada.

**Conjunto inicial de evaluación propuesto:** 30 casos sintéticos o debidamente autorizados, al menos diez no técnicos y cinco con condiciones adversas como poco tiempo, urgencia o poca evidencia. Cubrir inyección en archivos, fuente inexistente, contradicción, profesión regulada y cambio de consentimiento. Es una puerta inicial, no validación universal ni psicométrica.

## 7. Modelo de datos propuesto

| Entidad | Campos / relaciones esenciales |
| --- | --- |
| Account / Membership | ID estable, proveedor, organización opcional, rol y estado. |
| ConsentGrant | Persona, propósito, versión, grant/revoke, alcance, fecha. |
| ExplorationSession / PrivateInsight | Dueño, estado, contenido protegido, referencias privadas, confirmación, retención. |
| CareerContextVersion | Dueño, campos aprobados, permisos de origen, versión, revocación. Sin texto completo del chat. |
| Evidence | Dueño, tipo, caso, contribución, resultado, referencia a artefacto opcional, revisión y estado. |
| Skill / SkillMapping | Clave estable, tipo transversal/dominio, etiquetas, catálogo, versión, equivalencias revisadas. |
| SkillAssessment | Persona, habilidad, evidenceIds, nivel nullable, rúbrica, confianza cualitativa, autor, revisión y disputa. |
| RoleProfile / RoleRequirement | Función, industria, país, tareas, requisito esencial/opcional, fuente, versión. |
| CareerRoute | Contexto y evidencias usados, rol, razones, brechas, barreras, revisión, elección. |
| Experiment / PlanAction | Ruta, hipótesis, tarea, rúbrica, entrega, feedback, decisión, fechas. |
| SourceRecord / AIJob / AuditEvent | Procedencia, consulta, modelo/versiones, costo/estado, acceso y operaciones. |

Toda entidad derivada debe identificar dependencias y versión. Revocar acceso o borrar un origen debe poder invalidar derivados, exportaciones futuras y cachés. No conservar chats privados en embeddings del catálogo profesional. Las representaciones vectoriales de contenido personal siguen los mismos permisos y borrado que su fuente.

## 8. Integración y transición desde los proyectos

### Estado observado, sin atribuir madurez no verificada

Elevation tiene frontend React/Vite, backend Express/tRPC y esquema MySQL/Drizzle con usuarios, sesiones, mensajes, reflexiones y consentimientos. El código consultado muestra llamadas a anonimización y detección de crisis. No se verificó cifrado efectivo, aislamiento de todos los helpers ni despliegue; comentarios del esquema plantean cifrado de mensajes en producción. El README usa un encuadre de salud mental que debe armonizarse con el nuevo posicionamiento no clínico.

Perfilador tiene alcance técnico de SDLC, señales, rúbricas, radar y módulos; la operación actual usa `dashboard.mjs`. El informe local del 20 de octubre describe un recorrido parcial hasta radar persistido y pendientes de identidad individual, recuperación, explicación y aprendizaje automático en el despliegue observado. Hay avances locales sin commit y no deben confundirse con el estado publicado. Este PRD no volvió a ejecutar esas pruebas.

### Qué conservar, adaptar o posponer

| Activo | Acción propuesta |
| --- | --- |
| Conversación y reflexiones de Elevation | Conservar experiencia y componentes útiles; revisar permisos, consentimiento efectivo y persistencia antes de reutilizar. |
| Consentimientos de Elevation | Adaptar a propósitos enumerados y puente de transferencia; revisar ejecución de revocación. |
| Señales y taxonomía de Perfilador | Conservar procedencia y versionado; ampliar con habilidades transversales y catálogo localizado. |
| Radar y brechas | Adaptar para evidencia nullable, explicaciones y requisitos por función; evitar puntajes iniciales que aparenten déficit. |
| Generador de módulos | Reutilizar contratos donde aporten; orientar la salida a experimentos y evidencia de avance. |
| Auth y sesiones locales de piloto | Revisar e integrar con pruebas reales; existencia de código no equivale a aceptación. |
| Agentes de código y GitHub | Mantener como conectores especializados opcionales; no hacen parte del recorrido general obligatorio. |
| Laboratorios Monaco / colas extensas | Posponer hasta que la demanda y el volumen justifiquen ese alcance. |

### Decisión arquitectónica propuesta para estimar

**Nota de vigencia:** el texto siguiente conserva la propuesta inicial del 20-oct para trazabilidad. La elección vigente de anfitrión, almacenamiento y LLM es Express/Sequelize/Postgres y Claude, confirmada en la actualización del 22-oct al inicio de este PRD. No implementar una arquitectura de dos bases ni elegir otro stack a partir de esta propuesta histórica.

Crear una experiencia web y una identidad de producto con módulos separados por dominio. Elegir el frontend y backend anfitrión mediante una revisión breve de ambos repositorios: capacidad real, pruebas, operación y esfuerzo de migración. Este PRD no impone Next.js/NestJS porque figuren como arquitectura objetivo.

Mantener inicialmente las bases existentes detrás de adaptadores: MySQL para exploración y PostgreSQL para evidencias/carrera. Una tabla controlada relaciona la identidad interna con IDs legados; el correo no es la clave de unión. Cada sistema mantiene autenticación/autorización verificable en servidor. El motor profesional recibe solo el CareerContext aprobado, nunca acceso directo a la base privada. Evaluar costos de dos bases frente a consolidación cuando el flujo esté validado.

Registrar esta elección en ADR: anfitrión, identidad, permisos, almacenamiento, proveedores, costos, consecuencias y plan de reversión. No mantener dos logins visibles ni unir cookies existentes sin diseño de sesión común.

### Migración incremental

1. Inventariar funcionalidades reales, esquemas, usuarios, datos de QA y estado de cada rama; preservar cambios locales existentes.
2. Agregar identidad canónica, contratos versionados y permisos sin cambiar puntajes legados. No convertir automáticamente escala 1–5 a 1–4: conservar escala/rúbrica original y reevaluar solo cuando corresponda.
3. Implementar el puente con cuentas sintéticas y feature flag. No importar historiales personales para «entrenar» o enriquecer perfiles por defecto.
4. Habilitar a una cohorte voluntaria; comprobar aislamiento, borrado, recuperación, exportación y conciliación de evidencias. Separar marcas de QA de evidencia profesional.
5. Ampliar tras cumplir puertas de seguridad, utilidad y operación. Reversión: desactivar la integración y nuevos trabajos, conservar acceso/exportación autorizada y evitar escrituras dobles sin reconciliación.

## 9. Requisitos no funcionales y operación

Objetivos iniciales de aceptación, pendientes de confirmar con infraestructura y presupuesto. Su aplicación debe considerar Colombia y Dinamarca; la política de tratamiento, transferencias y contratos con proveedores requiere revisión especializada antes de captar datos sensibles. Este PRD no determina cumplimiento normativo:

- Web responsive y navegación completa por teclado; contraste legible, errores anunciados y contenido útil sin depender del color del radar. Validar referencias WCAG 2.2 AA en diseño e implementación; no declarar conformidad solo por revisar pantallas.
- Feedback de envío inmediato; meta p95 de respuesta conversacional menor a 15 segundos en la muestra de staging. A los 30 segundos mostrar estado de procesamiento o recuperación. Trabajos largos fuera de la petición interactiva.
- Cero acceso cruzado en casos de prueba, cero secretos de fixtures en prompts capturados y cero uso de datos privados no autorizados en rutas. Cifrado en tránsito y en reposo confirmado con proveedores; revisión específica del contenido sensible y acceso a claves.
- Timeouts, idempotencia, límites de costo, borrado y copias de respaldo probados. Registrar incidentes y responsable de respuesta para el piloto.
- Mantenimiento del catálogo con fuente y fecha; revisión manual semanal de ofertas incluidas en el piloto y nueva comprobación antes de mostrarlas como vigentes.
- Propuesta de retención inicial: sesiones privadas 90 días salvo eliminación anterior, perfiles profesionales mientras la cuenta esté activa con revisión de inactividad; confirmar política con país, proveedores y necesidad real. No presentar esta propuesta como requisito legal.

## 10. Analítica y objetivos del piloto

Eventos mínimos sin contenido privado: invited, account_verified, consent_granted/revoked, exploration_summary_confirmed, journal_entry_saved/deleted (solo evento, sin texto ni emoción), exercise_completed, career_bridge_confirmed, evidence_confirmed, skill_map_viewed, routes_compared, resource_selected, experiment_started/submitted/reviewed, decision_recorded, plan_confirmed, usefulness_answered, AI_job_failed/recovered, deletion_requested/completed. La analítica de uso del diario debe declararse y minimizarse; no medir emociones para monetización.

Cada evento lleva usuario seudónimo, cohorte opcional, fecha, versión y request/job ID cuando aplique. No enviar chats, citas ni textos de CV al sistema de analítica. Reportar B2C y patrocinado por separado.

Metas propuestas para seis participantes financiados por el fundador, no resultados observados ni evidencia estadística de eficacia:

| Medida | Definición y meta de aprendizaje |
| --- | --- |
| Activación | Meta 5/6 encuentran valor inicial emocional o profesional en siete días; registrar qué fue y la confirmación del participante. Medir creación de contexto/evidencia por separado, sin exigirlos para acreditar utilidad emocional. |
| Resultado profesional | Meta 4/6 completan un experimento y registran una decisión razonada en 30 días. Describir también casos que necesitaron más tiempo y por qué. |
| Acompañamiento percibido | Meta 5/6 reportan sentirse escuchados y respetados, con ejemplo específico. Pregunta opcional; no es medida de mejoría clínica. |
| Utilidad profesional | Meta 4/6 reportan una opción nueva pertinente o un siguiente paso más claro y explican la evidencia que ayudó. Registrar respuestas faltantes. |
| Idioma | Revisar los seis recorridos, cinco ES / uno EN; ningún bloqueo crítico de idioma. No publicar comparaciones de subgrupos ni inferir superioridad de un país. |
| Calidad | En 30 casos revisados: cero violaciones críticas de privacidad o evidencia inventada; al menos 24/30 cumplen pertinencia y justificación según rúbrica. Reportar desacuerdos de revisores. |
| Operación | Menos de 10% de intentos iniciados fallan técnicamente; registrar personas afectadas y recuperaciones por separado. Sin incidente crítico abierto. |
| Economía | Costo total financiado por el fundador, por participante y por resultado; tiempo humano y curación bilingüe incluidos. Este piloto no mide conversión a pago. |

No optimizar minutos de conversación como métrica de éxito. La retención a día 7 solo cuenta acciones sustantivas como nueva evidencia, revisión de ruta o experimento; visitas y mensajes de saludo se muestran aparte.

## 11. Backlog, dependencias y puertas de salida

Responsables son roles propuestos; asignar personas y estimar después de la revisión técnica.

| Épica / IDs | Entrega vertical | Responsable propuesto | Depende de | Puerta |
| --- | --- | --- | --- | --- |
| E0 / DISC-01 | Caracterizar los seis casos y catálogo pertinente; presupuesto y oferta de piloto. | Fundador + producto | Ninguna | Contextos, alcance y financiación operativa acordados. Pago comercial se valida después. |
| E1 / TRUST-01–03 | Identidad común, autorización, consentimiento y operación básica. | Backend + seguridad | Inventario y ADR | Dos usuarios/dos organizaciones aislados; sesión y borrado verificados. |
| E2 / EXP-01–04 | Acompañamiento socrático ES/EN, ejercicios, diario, brújula y puente. | Diseño + frontend + backend | E1 | Voz revisada en ambos idiomas; diario privado y transferencia controlada. |
| E3 / MAP-01–03 | Captura de casos, rúbricas y mapa explicable. | IA + dominio + backend | E1; E2 opcional para la persona | Cada evaluación trazable; profesión no técnica y sin evidencia funcionan. |
| E4 / ROUTE-01–03 | Rutas, ofertas verificadas y recursos para Colombia/Dinamarca según mercado elegido. | Dominio + IA + frontend | E3 y catálogo E0 | Revisión de pertinencia y restricciones; fuentes y lenguas visibles. |
| E5 / ACT-01–02 | Experimento, feedback, decisión y plan exportable. | Producto + full stack + facilitador | E4 | Una persona completa el ciclo de principio a fin en staging. |
| E6 / OPS-01–03 | Fallos, costos, soporte, métricas y operación de cohorte. | Backend + QA + operaciones | Transversal desde E1 | Regresiones, recuperación y uso de datos aceptables antes de invitar. |

**Secuencia de lanzamiento:** caracterización y curación de seis casos → prueba guiada con entregas manuales seguras → vertical funcional con usuarios sintéticos → piloto cerrado ES/EN → revisión individual y decisión de producto → experimento comercial separado. E0 puede cambiar E2–E5. Priorizar el aprendizaje del grupo antes de ampliar automatización.

No hay fecha comprometida: faltan equipo, disponibilidad, presupuesto y decisión de anfitrión. Las fases representan dependencias, no sprints estimados. El piloto técnico Itti existente y este piloto de reconversión deben mantener objetivos y métricas separados; Itti puede enseñar sobre evaluación técnica, pero no valida transferencia entre industrias.

## 12. Definición de terminado

Para cada historia: criterios funcionales comprobados, permisos y estados de error cubiertos, esquema y datos versionados, auditoría sin contenido privado, instrumentación y documentación operativa mínima. No basta una respuesta convincente del modelo.

Para abrir el piloto: recorrido completo en ES y EN con profesión no técnica; tono socrático revisado; ejercicios y diario privado; sesión recuperable; consentimiento y revocación efectivos; fuentes y evidencia verificables; evaluación de IA revisada; aislamiento y exportación/borrado comprobados; costos y soporte con responsable. La comprobación debe incluir navegador y servicios reales de staging, además de pruebas con dobles.

**Preguntas que deben cerrar producto y desarrollo:** ¿quién paga y por qué resultado?, ¿cuál es el primer país y familia profesional?, ¿qué parte del recorrido requiere humano?, ¿qué aplicación alojará la experiencia?, ¿qué funcionalidades están realmente publicadas?, ¿cuánto soporte puede financiar la oferta?, ¿quién mantiene catálogo y rúbricas?

Referencias e incertidumbres en [validación y fuentes](../03-VALIDACION-Y-FUENTES.md). Este documento define trabajo propuesto; no certifica seguridad, disponibilidad ni desempeño de los proyectos existentes.
