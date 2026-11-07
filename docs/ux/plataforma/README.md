# ES-148 · Plataforma Elevation: prototipo navegable (azul tinta)

*[UX-Claude] · 6-nov-2026 · Borrador para aprobación de Mauricio y Alejo. Ábrelo con doble clic en `index.html` (carga tipografías de Google Fonts; sin conexión usa una de respaldo).*

## Estructura

| Archivo | Qué contiene |
|---|---|
| `estilos.css` | Tokens y piezas base (color, tipografía, botones, campos, mapa). |
| `pantallas.css` | Piezas de las pantallas nuevas. |
| `nucleo.js` | Textos base, relieve, rutas, menú, pantallas públicas, mapa, conversación y planes. |
| `p-*.js` | Una pantalla o familia por archivo, con sus textos ES/EN. |
| `p-admin.js`, `p-admin2.js` | Administración y junta (estructura, panel, métricas, guías de la IA, manifiesto, contenido, personas usuarias, catálogos, piloto). |
| `p-publicas.js` | Restablecer contraseña, solicitud de profesionales y precios. |
| `inicio.js` | Arranque. |

La barra de arriba del prototipo permite elegir pantalla, simular errores del servidor («Chat: sin conexión» sirve para todas), cambiar tema claro/oscuro y cambiar ES/EN.

## Cobertura frente a las rutas reales de `frontend/src/App.tsx`

| Ruta real | Pantalla del prototipo | Estado |
|---|---|---|
| `/`, `/login`, `/forgot-password` | portada, entrar, recuperar | Hecho |
| `/reset-password` | `restablecer` (`p-publicas.js`) | Hecho: formulario con requisitos en vivo, enlace no válido, contraseña actualizada, contraseña común, demasiados intentos, error de red |
| `/profesionales` | `profesionales` | Hecho: formulario completo con validación por campo, hoja de vida en PDF, error de red, demasiados intentos, error del servidor, solicitud recibida |
| `/pricing` | `precios` | Hecho: visitante y con sesión, cargando, error, vacío, plan retirado, solicitud en revisión, resultado incierto, enviando. Planes de EJEMPLO |
| `/app/onboarding` | `punto` | Hecho |
| `/app/checkin` | `checkin` | Hecho |
| `/app/skill-map`, `/app/dashboard` | `inicio` (mapa, `p-mapa.js`) | Hecho: relieve y lista por territorios, autoevaluación y revisión humana por separado, confianza, criterios, registrar/cambiar/retirar nivel, análisis con IA en 3 pasos, revocar todos, actualizar, guía sin niveles. Pendiente de decisión: el radar |
| `/app/bridge` | `puente` (`p-puente.js`) | Hecho: fuentes con consentimiento por fuente, propuestas, cruce idea por idea con confirmación, revocar una o todas, estados de error |
| `/app/my-therapist` | `terapeuta` | Hecho: perfil, compartir datos, desvincular, sesiones, emparejamiento en 3 pasos |
| `/app/session/:id` | `sesion` | Hecho: conectando, en curso, aún no comienza, error |
| `/app/chat` | `chat` | Hecho (falta enlazar la elección de diario) |
| `/app/evidence` (lista, nueva, detalle, editar, hoja de vida) | `evidencias`, `evidencia_nueva`, `evidencia_detalle`, `evidencia_editar`, `resumen_habilidades` | Hecho con el modelo real |
| `/app/context/resumes` | `resumes` | Hecho |
| `/app/diary` (lista, nueva, detalle) | `diario` | Hecho |
| `/app/next-step` (rutas, experimentos, experimento, plan) | `siguiente`, `experimentos`, `experimento`, `plan_accion` | Hecho |
| `/app/data` | `datos` | Hecho |
| `/app/space/tools` | `herramientas` (`p-brujula.js`) | Hecho: cuatro tarjetas reales, «en preparación», ninguna disponible, cargando y error |
| `/app/exercises` | `ejercicios` | Hecho: lista de 3, ejercicio con notas que no se guardan, copiar, cerrar con aviso, contenido en revisión y no disponible |
| `/app/compass` | `brujula` | Hecho: contexto vigente, historial, campos (12 / 3 por categoría / 500), vista previa exacta con vigencia, autorización, retirar, estados de error e incertidumbre |
| `/app/route-catalog`, `/app/route-catalog/roles/:roleKey` | `catalogo`, `catalogo_ficha` (`p-catalogo.js`) | Hecho: filtros, fichas, fuentes, ofertas, recursos, estados. Contenido de EJEMPLO |
| `/app/progress` | `progreso` (`p-progreso.js`) | Hecho: cifras, recomendaciones, historial emocional, calificaciones, vacío, error |
| `/app/feedback` | `opinion` | Hecho: vista de revisión con datos ficticios, omitir cada pregunta, guardado incierto, conflicto, retirar |
| `/app/dashboard` | `inicio` | Es el mapa (ver arriba): en el código real la ruta redirige al mapa |
| `/facilitation`, `/facilitation/participants/:id`, `/facilitation/participants/:id/reviews/new` | `facilitacion`, `facilitacion_persona`, `facilitacion_revision` (`p-profesional.js`) | Hecho: personas asignadas, progreso por pasos, materiales, registrar revisión (evidencias, observación, límites, vista previa exacta), guardia al salir, error de guardado, confirmación incierta sin duplicar, conflicto de versión, acceso retirado, solicitar invitación |
| `/app/professional-reviews` | `mis_revisiones` | Hecho: revisiones recibidas, objetar con vista previa, pendiente/respondida, vacío |
| `/therapist/dashboard` | `panel_pro` | Hecho: resumen, próximas sesiones, personas, avisos, validación académica (subir, estados, rechazo), guía para la IA (proponer, pendiente, rechazada); cada sección con su error |
| `/therapist/patient/:id` | `paciente_pro` | Hecho: resumen con IA, notas de seguimiento (filtrar, crear, editar), historial emocional, valoraciones, agendar sesión, sin autorización |
| `/therapist/session/:id` | `sala_pro` | Hecho: pantalla previa, conectando, error al iniciar, en sesión con notas en vivo (autoguardado y error), cierre con ánimo y nota |
| `/admin/dashboard` | `adm_panel` (`p-admin.js`) | Hecho: 7 cifras, gráfica de 30 días con alternativa en tabla, profesionales con más personas, avisos con error propio |
| `/admin/metrics` | `adm_metricas` | Hecho: tres cifras, gráfica ampliada y tabla |
| `/admin/prompts` | `adm_prompts` («Guías de la IA») | Hecho: lista, versión activa, historial, proponer (administración), publicar y crear (superadministración), leer el texto propuesto, aprobar y rechazar con diálogo, errores |
| `/admin/manifest` y `/board/manifest` | `junta_manifiesto` | Hecho: versión activa, historial, nueva versión con confirmación, reactivar con confirmación; los tres roles (administración sin acceso, superadministración y junta) |
| `/admin/content` | `adm_contenido` | Hecho: validaciones de profesionales, solicitudes (filtros, aprobar, rechazar, eliminar, hoja de vida, formulario cerrado por tope), planes (crear, editar, desactivar) y textos públicos (pendientes y otros) |
| `/admin/users` | `adm_usuarios` | Hecho: lista con filtros (tabla y tarjetas), gestionar, crear cuenta (con precarga desde una solicitud aprobada), desactivar, desbloquear, asignar profesional, enlace de restablecimiento, eliminar con nombre, emparejamientos, solicitudes de plan |
| `/admin/route-catalog`, `/:id`, `/:id/:kind/:itemKey` | `adm_rutas`, `adm_rutas_borrador`, `adm_rutas_item` | Hecho: versiones, borrador por tipo, editor generado desde la especificación de campos, datos que faltan, guardia al salir, guardado incierto, publicar con revisión, solo lectura |
| `/admin/skill-catalog`, `/:id`, `/:id/skills/:skillKey` | `adm_habilidades`, `adm_habilidades_borrador`, `adm_habilidad` | Hecho: mismo patrón con niveles 1 a 4 en ES y EN, fuente, verificación y territorios |
| `/admin/pilot-metrics` | `adm_piloto` | Hecho: cuatro métricas con sus estados, datos protegidos, sin configurar. Vista preliminar con datos sintéticos |

**Con esto todas las rutas de `App.tsx` que tienen pantalla propia están diseñadas en el prototipo (el resto son redirecciones o el comodín).**

## Decisiones que necesito de Alejo y Mauricio (de esta entrega)

1. **Radar.** El mapa real tiene vista de radar. En Cartografía el relieve ya cumple esa función, así que lo sustituí por el relieve y un resumen («puntos más fuertes» y «un punto donde mejorar»). Si se mantiene el radar, hay que diseñarlo aparte.
2. **«Terapeuta» o «profesional».** El código usa «terapeuta». El producto es no clínico: propongo «profesional de acompañamiento», pero no lo cambié sin tu decisión.
3. **Tema «Ansiedad» del emparejamiento.** Roza lo clínico; propuse «Estrés y carga» en el prototipo. Cambia la lista real de temas.
4. **Ánimo con emojis.** El código muestra emojis de 1 a 5 en las sesiones anteriores; el prototipo usa las mismas cinco palabras del check-in más el número.
5. **Enlace a la Brújula en El Puente.** Ya está: aparece en el estado vacío de El Puente («Añadir algo a mano»).

### Decisiones de la entrega 4 (ejercicios, herramientas, brújula, catálogo, progreso, opinión)

6. **Tarjetas de «Mis herramientas».** El código solo tiene título y botón. Propongo una línea descriptiva por tarjeta (son textos nuevos, revisar ES/EN).
7. **Ejercicios.** El contenido real está marcado `draft` y los ejercicios van detrás de una bandera. El diseño es el final; el aviso «Contenido en revisión» se ve solo mientras siga en borrador. Hace falta revisión humana del contenido antes de habilitarlo.
8. **Brújula.** La vigencia de la vista previa (aquí 10 min) y qué texto «no se puede compartir» los decide el servidor; el prototipo simula esa regla con las palabras «salud», «health» y «@». Mejora propuesta: la etiqueta «Categoría» sobre el selector (el código usa «Selecciona una categoría» como etiqueta).
9. **Progreso.** Se retiran los emojis (ánimo y categorías) y se sustituyen por palabras; las estrellas llevan texto «4 de 5»; la subida/bajada del ánimo lleva palabra, ya no depende de verde/rojo; se añade «no es una medición de salud». Las recomendaciones del ejemplo son inventadas.
10. **Opinión.** El permiso real depende del contrato de Mauricio. Hasta entonces se mantiene la franja «Vista de revisión · datos ficticios» y no se envía nada; el texto de retirada se reescribe sin la palabra «simulación» (propuesta).
11. **Catálogo.** Todo el contenido (fichas, fuentes, ofertas, recursos, mercados) es de ejemplo, con dominio `.invalid` y el aviso «Contenido de prueba» siempre visible. Sin porcentajes ni afirmaciones de reemplazo por IA. Los enlaces externos avisan «se abre en una pestaña nueva» (propuesta).

### Decisiones de la entrega 5 (familia profesional)

12. **Vocabulario.** «Personas» en lugar de «pacientes», «notas de seguimiento» en lugar de «notas clínicas» y «resumen con IA» en lugar de resumen clínico. Prolonga la decisión 2: el producto es no clínico. Cambia textos reales (`therapist_*`).
13. **Porcentajes.** El aviso de progreso del código dice «+N %» (`improvementPercent`). El diseño lo dice con palabras («su ánimo mejoró en los registros recientes») y no muestra porcentajes: no hay base para presentarlos como medición.
14. **Privacidad: hallazgo para Dev y QA.** Cuando una persona no autorizó compartir, el código del panel oculta sus datos con `display:none`, pero siguen en la página. El diseño no los dibuja y espera que el servidor tampoco los envíe. Hay que verificarlo (es una regla no negociable).
15. **Errores que hoy se tragan en silencio.** Sesiones próximas, avisos, validación académica y guía para la IA fallan sin avisar, y editar una nota que no se guardó tampoco dice nada. El diseño da a cada sección su propio error con reintento y conserva el texto.
16. **Sala con pantalla previa.** El código inicia la sesión (llamada `start`) al montar la sala: recargar o abrir dos veces puede iniciarla dos veces. El diseño pide un clic en «Iniciar sesión». Cambia el flujo y el servidor debe ser idempotente.
17. **Cierre de sesión.** «Finalizar» deja de ser rojo (el rojo queda para errores). El cierre sigue exigiendo ánimo y nota de 10 caracteres. La etiqueta «Cómo ves a la persona al terminar» es propuesta; el texto real no se verificó.
18. **Guía para la IA (el «prompt terapéutico» del código).** Una persona profesional propone instrucciones que orientan a la IA con las personas que acompaña y administración las aprueba. Es la pieza con más riesgo del paquete: el diseño añade el recordatorio de las reglas (sin diagnóstico, sin tratamiento, sin promesas de empleo), pero la validación real (inyección de instrucciones, límites no clínicos) debe vivir en el servidor. **Posible objeción para Mauricio y Alejo** antes de implementarla.
19. **Facilitación y «Revisiones profesionales».** Son una vista preliminar con datos sintéticos y el permiso real depende del contrato; se mantiene la franja y «Solicitar invitación» sigue siendo una simulación. En el código, «Mis revisiones» solo se llega desde la consola de facilitación; el prototipo la añade al menú de la persona (no verifiqué si existe otro acceso).
20. **Cifra «Total de sesiones».** En la ficha, el código la calcula contando registros de ánimo. El diseño la renombra «Registros de ánimo». Si se quiere contar sesiones, el servidor debe entregarlo.

### Decisiones de la entrega 6 (administración, junta y públicas)

21. **Nombre «Guías de la IA».** El código las llama «prompts». Para quien administra son las instrucciones con las que conversa la IA; el identificador técnico se conserva en pantalla.
22. **Hallazgo grave: quien aprueba una guía no ve su texto.** El servidor de versiones devuelve todo menos `content` (`backend/routes/adminPrompts.js`, `attributes`). Superadministración aprueba o rechaza a ciegas. El diseño muestra el texto de cada versión. **Requiere que el servidor lo devuelva**; sin eso, no se debe aprobar.
23. **Aprobar, publicar y reactivar piden confirmación propia.** Cambian cómo se comporta la IA para todas las personas. Hoy aprobar no pide nada y reactivar el manifiesto usa `window.confirm`. El diálogo dice el efecto y el camino de vuelta.
24. **Definir la contraseña de otra persona.** El código deja a administración escribir una contraseña nueva (mínimo 6) para otra cuenta. Posible objeción: la administración no debería conocer contraseñas ajenas y la regla de 6 es más débil que la del registro (8 con mayúscula, minúscula, número y símbolo). El diseño la sustituye por «Enviar enlace de restablecimiento». Requiere un endpoint o reutilizar el de recuperación.
25. **Crear cuenta con contraseña inicial.** Se mantiene (es lo que hace el código) pero con las mismas reglas del registro. Alternativa recomendada: invitación por enlace. Decide Mauricio.
26. **Desactivar y eliminar cuentas.** Desactivar pide confirmación con su consecuencia; eliminar exige escribir el nombre (ya lo hace el código) y avisa que no se deshace. Eliminar solicitudes de profesionales avisa lo mismo (hoy es `window.confirm`).
27. **Gráfica de actividad accesible.** El código dibuja barras sin texto y con un mínimo de 8 % de altura aun con cero sesiones (parece que hubo). El diseño pone cero como una línea, un resumen de texto y la tabla de los 30 días.
28. **Estrellas, emojis y «% de ánimo».** Se sustituyen por «4,5 de 5» y palabras. Coherente con las decisiones 13 y 17.
29. **El panel de avisos falla en silencio en el código.** El diseño le da su error con reintento (decisión 15 aplicada a administración).
30. **Catálogos.** El editor se genera desde la especificación de campos (`schema.ts` y `model.ts`): los campos del prototipo son un subconjunto representativo, la fuente de verdad es el código. Publicar se bloquea con una lista de lo que falta en lugar de fallar en el servidor. Contenido de prueba no publicable: se muestra el motivo.
31. **Piloto.** Es una vista preliminar con datos sintéticos y permiso pendiente de contrato; se mantiene la franja. Las metas propuestas no se muestran con cifras porque el texto real no se verificó.
32. **Restablecer contraseña.** Los requisitos se muestran en vivo con símbolo y palabra (no solo color). El enlace llega en la dirección y se quita de la barra al abrir (se conserva). El mensaje «Este enlace ya no sirve» no distingue entre vencido y usado: correcto, evita dar pistas.
33. **Solicitud de profesionales: inconsistencia.** El texto dice que el enlace «debe empezar por https://» pero la regla acepta también `http://`. El diseño unifica el mensaje con la regla (o la regla con el mensaje). Pendiente de decisión.
34. **Precios.** Los planes de ejemplo no son los reales. La página pública y «Mi plan» comparten catálogo. Con sesión, una solicitud en revisión bloquea otra; un resultado incierto pide comprobar antes de reintentar.
35. **Acceso por rol.** El prototipo permite ver las pantallas como administración, superadministración y junta. La junta solo ve el manifiesto. Si un rol no tiene acceso se muestra una explicación en lugar de redirigir en silencio.

### Respuestas del PO a las decisiones abiertas (7-nov-2026)

Respondió Mauricio Roldán. Quedan como decisiones tomadas; lo que cambia el diseño ya está aplicado.

36. **Decisión 22 (texto de las guías de la IA): aprobada.** El servidor debe devolver el texto de cada versión; sin eso no se puede aprobar. Principio de producto: **toda la información es administrable por superadministración**, no queda quemada en el código.
37. **Decisión 18 (validación de las guías): aprobada como historia aparte** (ES-191). Mantiene a ES-181 pequeña; ES-181 queda bloqueada para aprobar hasta que ES-191 esté en QA.
38. **Decisión 24 (contraseña de otra persona): aprobada.** Se sustituye por «Enviar enlace de restablecimiento».
39. **Decisión 25 (crear cuenta): se mantienen los dos caminos.** Registro propio (como hoy) e **invitación por enlace** (ES-192). La contraseña, en cualquier camino: mínimo 8 caracteres con mayúscula, minúscula, número y carácter especial. Quien puede enviar invitaciones se confirma (ver pregunta abierta).
40. **Decisiones 10 y 19 (opinión, facilitación, revisiones) y toda etiqueta «ejemplo» / «datos ficticios».** La etiqueta **no se escribe en el componente**: la pone el servidor según un indicador del dato (por ejemplo `esSintetico` en el registro guardado en la base). Si el dato es real, no hay etiqueta; si lo creamos para pruebas, la lleva sola. Así nadie confunde a la persona usuaria ni a quien desarrolla. En el prototipo siguen escritas a mano porque es un prototipo. Está en la definición de listo (HUS-BASE) y en ES-152, ES-173, ES-176 y ES-183.
41. **Decisiones 2, 12 y 3 (vocabulario y tema «Ansiedad»): aprobadas.** «Profesional de acompañamiento», «personas», «notas de seguimiento», «resumen con IA» y «Estrés y carga».
42. **Decisión 16 (sala con «Iniciar sesión»): aprobada**, con servidor idempotente.
43. **Decisión 1 (radar): se diseña aparte.** Hecho: la pantalla Mapa tiene tres vistas (Relieve, Lista, Radar). Un eje por capacidad, anillos de nivel 1 a 4, etiqueta de cada eje con su nivel o «Sin nivel». **Una capacidad sin nivel no tiene punto (no se dibuja como cero)**; solo se unen los puntos vecinos que tienen nivel y el relleno aparece únicamente cuando las ocho tienen nivel. Alternativa accesible: tabla bajo el gráfico. Cada eje es un botón que abre el mismo detalle de la capacidad. Pendiente de aprobación visual.
44. **Decisión 33 (enlace de profesionales): solo `https://`.** Se unifica regla y mensaje.
45. **Decisión 7 (ejercicios), 34 (planes) y datos de contexto: se administran desde la aplicación.** El contenido real es el que se crea en la aplicación; un cambio se hace ahí y se habilita con el mismo cambio (publicar). Planes y precios: se dejan como recomendación y los cambia superadministración o administración desde Contenido. **La línea de emergencia (y otros datos de contacto) también se edita desde Contenido**, con valor inicial para Colombia pendiente de verificar (ES-193). Ningún número va en el código.
46. **Asignación:** las historias se reparten entre Dev-Claude, Dev-Claude 2 y Dev-Codex en bloques de pantallas distintas, para que no editen los mismos archivos (ver HUS-BASE sección 7). El diseño lo aprueba Mauricio.

## Qué se verificó

- Vista de radar del mapa: ES y EN, claro y oscuro, 390 y 1360 px, sin desborde, axe sin hallazgos graves, consola limpia, cada eje abre el detalle. En 390 px el gráfico es pequeño: la tabla alternativa es la lectura fiable ahí (a revisar con quien apruebe).
- Entrega 6: barrido de las 16 pantallas nuevas en ES/EN, claro y oscuro, 390 y 1360 px (sin desborde, un solo h1, axe sin hallazgos graves ni críticos) y más de 90 comprobaciones de flujo con Playwright (permisos por rol, aprobar y rechazar, errores con el diálogo abierto, confirmación incierta, guardia al salir, límites de caracteres, precarga entre pantallas). Claves de texto duplicadas entre archivos: 0.

- Entrega 5: barrido de las 7 pantallas profesionales en ES/EN, claro y oscuro, 390 y 1360 px (sin desborde, un solo h1, axe sin hallazgos graves ni críticos) y flujos de punta a punta con Playwright (revisión con evidencia, vista previa, guardia al salir, error y reintento del mismo envío, confirmación incierta sin duplicar, conflicto, acceso retirado, invitación; objeción; panel con errores por sección, validación y guía; ficha con resumen IA, notas, filtro, edición con error, agendar; sala con autoguardado, error y cierre).
- Colisión de claves de texto entre archivos: se detectó y corrigió (`rv_t`, `sp_back`, `sp_save` ya existían en otros módulos).

- Carga sin errores de consola ni desborde horizontal en 390 y 1360 px, ES y EN, para las 39 pantallas de la entrega 5; la entrega 6 añade 16 (55 pantallas del prototipo en total).
- Entrega 4: flujos de punta a punta con Playwright (ejercicio con notas y diálogo, error de copiado, brújula con campos, texto no compartible, vista previa, confirmación incierta, reintento, retirar, versión activa, vencida y pendiente de revisar; catálogo con filtros y fichas; progreso; opinión con guardado incierto, consulta de estado, retirar y conflicto) y axe-core sin hallazgos graves ni críticos en claro y oscuro, ES y EN.
- Corrección de dos fallos de la primera fase: el botón «Crear cuenta» de la barra tenía el texto del color del fondo, y los botones secundarios desactivados salían como un bloque gris sin texto. Además, los enlaces de texto usaban el azul del navegador.
- axe-core (WCAG 2 A/AA), nivel grave y crítico, en claro y oscuro, ES y EN: 0 hallazgos.
- Flujos de punta a punta con Playwright: check-in, diario, mis datos, evidencias (validación, revisión, confirmación, guardado sin confirmar y reintento), habilidades de la hoja de vida, hojas de vida, punto de partida, siguiente paso hasta plan aceptado y guardia al salir con cambios.

## No verificado

- Navegadores distintos de Chromium; lectores de pantalla reales; trampa de foco en los diálogos (el prototipo la simplifica, el frontend ya tiene `trapTab`).
- Los textos EN son borrador y piden revisión humana.
- Muchos datos son de ejemplo (rutas, fuentes, secciones del archivo de datos, máximo de versiones, países y zonas): salen del servidor.
- Los estados de conflicto, sesión vencida y función apagada se describen en el código real, pero solo algunos tienen pantalla propia en el prototipo.
- Licencias de las tipografías; fotografía, ilustración y logotipo por encargar.
