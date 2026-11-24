# Elevation — Visión de experiencia y prototipo (ES-405, v2)

[UX/UI-Claude] · Sustituye a la propuesta de §5 del `INFORME.md` (que queda como **anexo técnico** con las mediciones). Prototipo navegable: [`prototipo/index.html`](prototipo/index.html) — ábrelo en el navegador; cambia **rol** (Persona, Profesional, Administración, Junta), **idioma** (ES/EN) y **tema** arriba, y redimensiona la ventana (escritorio ↔ móvil). Todo son datos de ejemplo.

## 1. La tesis
Una persona en reconversión profesional abre Elevation con una mezcla de cansancio, dudas y poca confianza en que alguien «no la juzgue». El producto vende dos cosas: **claridad** («sé qué hacer ahora») y **seguridad** («esto es mío y tú decides qué sale de aquí»). Hoy la pantalla comunica lo contrario: 22 destinos de navegación, ocho tarjetas del mismo peso y una promesa de privacidad que hay que ir a buscar. **La diagramación «corrida» es el síntoma; la causa es que el sitio no jerarquiza.** La propuesta: *un paso a la vez, tuyo y tú decides, en un mapa que no te juzga*.

## 2. Para quién diseñamos
| Usuario | Llega con | Su trabajo | Lo que NO debe pasar |
|---|---|---|---|
| **Persona** (piloto: 6) | Dudas, poco tiempo, miedo a ser evaluada | Saber qué hacer hoy; ver su avance sin sentirse «en déficit»; controlar qué comparte | Sentirse examinada; perder la confianza por una pantalla que parece otra app; no saber qué ve su profesional |
| **Profesional** | Varias personas, poco tiempo entre sesiones | Ver de un vistazo quién necesita qué, con **solo** lo autorizado | Ver (o creer que ve) algo no autorizado; perder contexto entre pantallas |
| **Administración** | Colas de aprobación, contenido, usuarios | Resolver pendientes; mantener contenido seguro | Que lo urgente se pierda entre métricas |
| **Junta ética** | Lectura larga y cuidadosa | Leer y verificar el manifiesto | Un muro de texto sin estructura |

## 3. Diagnóstico de experiencia (lo medido, leído como producto)
1. **Dos mapas de navegación a la vez** en persona: 5 enlaces arriba (Mapa, Conversación, Evidencias, Diario, Siguiente paso) y **17** en la barra lateral, en 5 grupos (`u01-dashboard_es-light_1440.jpg`). No hay respuesta a «¿qué hago ahora?».
2. **«Mi panel» es un tablero, no una guía:** 8 tarjetas de igual peso (mapa, siguiente paso, estado emocional, próxima sesión, conversación, progreso, plan, recomendaciones). Ninguna dice cuál importa hoy.
3. **La privacidad es la promesa central y está dispersa:** aparece como texto suelto en el chat y en «Mis datos»; no hay un lugar que diga, de una vez, quién ve qué.
4. **El chat pierde la barra lateral** (el último enlace queda inalcanzable a 1440×900, D-02) y su cabecera es de otra aplicación (Inter/daisyUI frente a Cartografía). En la pantalla inicial del chat **no se observó** un acceso visible a ayuda urgente (puede estar en el menú; no verificado).
5. **El mismo contenido cambia de forma de pantalla a pantalla:** 8 anchos de columna, tres alineaciones, h1 de 8 tamaños (D-03, D-04, D-10). Para quien usa el sitio, eso se vive como «no sé dónde estoy».
6. **Profesional y administración heredan el marco de persona** (barra de 17 enlaces → 9 enlaces de 40 px en admin) y la misma tarjeta uniforme, aunque su tarea es distinta: revisar colas, no explorar.

## 4. Principios de diseño
1. **Un paso a la vez.** Cada pantalla tiene una acción principal; lo demás es secundario y se ve como tal.
2. **Tuyo, y tú decides.** La privacidad se **muestra** (chip «Solo tú», tabla «quién ve qué»), no se promete.
3. **El mapa es el hogar.** Cartografía no es decoración: el relieve es la metáfora del avance. *Lo plano no es un déficit.* El relieve aparece en «Hoy», «Mi mapa» y los estados vacíos.
4. **Calma, no gamificación.** Sin rachas, porcentajes de «empleabilidad» ni confeti (reglas no negociables: no clínico, sin promesas). Las cifras son conteos honestos («3 de 12 capacidades con evidencia»).
5. **Un solo marco.** Bordes que coinciden de cabecera a pie; ancho de columna por **tipo de página**, no por pantalla.
6. **Accesible por defecto.** Controles ≥ 46 px, foco único, ES/EN y claro/oscuro desde el primer boceto, barra inferior en móvil.

## 5. Qué hace el prototipo (pantalla por pantalla)
| Pantalla | Decisión de diseño | Por qué |
|---|---|---|
| **Persona · Hoy** | Una tarjeta héroe con **un** siguiente paso y el relieve «Tú estás aquí → Paso de hoy»; debajo, estado de ánimo opcional con chip «Solo tú», mapa «de un vistazo», lo último y profesional | Reemplaza 8 tarjetas iguales por una jerarquía de tres niveles; responde «¿qué hago hoy?» |
| **Conversar** | Chip «Privada · solo visible para ti», aviso de IA no clínica con **«¿Necesitas ayuda urgente?»** siempre visible, sugerencias de arranque, y panel «Lo que el asistente usa» con interruptores | Transparencia y control del contexto; ayuda urgente a un clic; el compositor sale de la lógica de formulario heredado |
| **Mi mapa** | Relieve grande con 4 territorios y 12 capacidades; detalle a la derecha; **lista de capacidades** equivalente (móvil/teclado/lector) | «Territorios, no etiquetas»; plano ≠ déficit; no depende de leer texto de 7 px en móvil |
| **Siguiente paso** | Etapas «Rutas → Experimentos → Plan», ruta elegida destacada, experimentos con tiempo estimado | Reduce Brújula/Catálogo/Experimentos/Plan a un solo recorrido |
| **Mi espacio** | Tabla **«Quién ve qué»** (Tú / Mi profesional / Nadie más), diario y datos | Un lugar único para la promesa de privacidad |
| **Profesional · Mis personas** | Tabla de personas con **qué comparte cada una**, KPI cortos y bloque «No visible para ti» en la revisión | Refuerza el límite del puente en la propia interfaz |
| **Administración · Resumen** | «Qué necesita tu atención»: colas con conteo y botón, métricas después | Lo urgente primero |
| **Junta · Manifiesto** | Columna de lectura de 44 rem con índice lateral fijo | Lectura larga con orientación |

**Navegación:** persona pasa de **22 destinos a 5** (barra superior en escritorio; **barra inferior** en móvil). Profesional y administración conservan barra lateral porque tienen muchas secciones, pero dentro del mismo contenedor (sin 1480 px) y con la barra desplazable por dentro.

### Mapa propuesto de los 17 destinos de persona → 5 (a validar con las 6 personas del piloto)
| Hoy en la barra lateral | Propuesto |
|---|---|
| Mi panel, Hoy, Mi progreso | **Hoy** |
| Conversación, Mis herramientas | **Conversar** |
| Mapa, Evidencias | **Mi mapa** (la evidencia se ve por capacidad) |
| Siguiente paso, Brújula profesional, Catálogo de rutas, Ejercicios opcionales | **Siguiente paso** |
| Diario, El Puente, Hojas de vida (Mi contexto), Mi plan, Mi profesional, Revisiones profesionales, Mis datos | **Mi espacio** |

## 6. Cómo esto resuelve lo medido
D-01 y D-02 (marco, chat inalcanzable) desaparecen para persona al no haber barra lateral y para los demás roles al estar dentro del contenedor; D-03/D-04 por los cinco tipos de página del `INFORME.md` §5.2; D-05 por controles de 46 px (en el prototipo, 0 botones y enlaces < 44 px en las 11 vistas medidas; las casillas nativas del panel de contexto del chat no se midieron); D-10/D-11 por una escala tipográfica y de espaciado única. En el prototipo, a 1440 px, marca, contenido y pie comparten x=100 y x=1340 en todas las vistas, sin desbordes a 390 px (medido con Playwright, `prototipo/capturas/`).

## 7. Cómo validarlo (propuesta, **no hecho**)
- Prueba con las 6 personas del piloto (5 ES, 1 EN), 20 min: «¿qué harías ahora?», «¿quién ve tu diario?», «encuentra tu próximo experimento». Registrar éxito y tiempo.
- Card sorting de los 17 destinos con 3–4 personas antes de cambiar la navegación.
- Medidas sugeridas (a definir con Alejo): tiempo hasta la primera evidencia, % que contesta el estado de ánimo, errores de navegación. Hoy **no hay línea base**: no se midió con personas.

## 8. Decisiones que necesito de Mauricio o Alejo
1. **Aprobar la dirección** (5 destinos para persona + barra inferior en móvil) o pedir otra agrupación.
2. **Chat:** hilo a la izquierda o centrado (el prototipo lo deja dentro de la misma columna, a la izquierda).
3. **Ancho del panel:** 1240 px (el prototipo) o 1320 px.
4. ¿Se retira `/facilitation` (vista preliminar deshabilitada, D-19)?
5. Orden de migración propuesto: (1) marco y capas; (2) Hoy y navegación de persona; (3) Conversar; (4) Mi mapa y Mi espacio; (5) profesional/administración; (6) públicas y portada.

## 9. Lo que NO se hizo / límites
- **Sin investigación con usuarias reales:** los diagnósticos son medidos en el producto y razonados desde buenas prácticas; las hipótesis (§3, §5) necesitan la validación del §7.
- El prototipo **no es código de producto** (HTML/JS estático, datos inventados, relieve generado, no el del servidor). Textos ES/EN escritos para el prototipo: requieren revisión de contenido.
- Probado solo en Chromium (escritorio); no en Safari/iOS ni con lector de pantalla. Foco y teclado: tab/enter/escape implementados, no auditados con tecnología de apoyo.
- Pantallas fuera del prototipo: Evidencias, Diario (nueva entrada), Mi contexto, Hojas de vida, Experimentos con detalle, Catálogos y Prompts de administración, sala de videollamada.
- No se implementó nada en `frontend/`.
