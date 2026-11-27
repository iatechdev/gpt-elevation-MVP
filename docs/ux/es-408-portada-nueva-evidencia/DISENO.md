# ES-408 · Diseño: portada pública y «Nueva evidencia»

[UX/UI-Claude] · **Solo diseño.** No se tocó `frontend/` ni `backend/`. Nada se implementa sin aprobación de Mauricio o Alejo (puerta de diseño). Base: `main` en `fd14aaf` (staging responde ese commit en `/api/health`, 27-nov).

**Archivos:** [`elevation-es408.html`](elevation-es408.html) (un solo archivo, doble clic) · fuente: `index.html`, `app.js`, `styles.css`, `textos.js` · [`TEXTOS.md`](TEXTOS.md) (clave → ES/EN con estado) · `check.cjs` (comprobación) · `build.cjs`.

En la barra negra del prototipo: pantalla (Registro 18+, Invitación, Portada, Nueva evidencia, Hoja de vida como **propuesta no construida**), tema, **catálogo de rutas** (con ejemplo rotulado / aún no disponible) y los estados de cada pantalla. El idioma ES/EN está en la cabecera. Registro e invitación: [`REGISTRO-18.md`](REGISTRO-18.md).

## 0. Versión 2 (27-nov): decisiones recibidas
Transmitidas por Infra-Claude y registradas en ES-408 (comentario 13023) y ES-409:
- **Promesa:** «Reconoce tu camino». **EN propuesto: «Recognise your path»** (grafía británica, como el resto del catálogo). Alternativas: «See your own path», «Know your path». **Pendiente de OK.**
- **Público:** personas que quieren y necesitan buscar trabajo. EN propuesto: «For people who want and need to look for work.»
- **Edad:** el piloto es **solo para mayores de 18**. La portada dice «El piloto es solo para mayores de 18 años» y no menciona 16 ni rangos (comprobado por prueba).
- **Rutas:** salen en el piloto; la variante con rutas es la principal. La variante «sin rutas» se retira; queda el estado «catálogo aún no disponible».
- **Sin promesa de conseguir trabajo:** se añade la marca «No promete empleo» junto a la promesa, porque el público se define por buscar trabajo.

## 1. Fuente y su peso
- Un documento interno de feedback pre-piloto con **2 evaluadores** (muestra muy pequeña; sirve de señal, no de prueba). Casi no trata la portada: el análisis de portada es propio.
- Se toma: el bloqueo por página en blanco en «Nueva evidencia» (ejemplos y guía) y la necesidad de una ruta clara.
- **No se adopta:** barra de «% de detalle» o de completitud; renombrar «profesional» a «Mentor/Coach»; afirmaciones de cumplimiento GDPR/AI Act (sin revisión legal verificada); notas técnicas Next.js/Radix (no aplican a la base actual); metas numéricas del documento (no hay línea base).

## 2. Inventario: qué funciona hoy (código de `main`)
Estado por evidencia de código y, donde se indica, por capturas de staging de ES-405 (commit `bbd520a`, 23-nov; desde entonces solo cambió el marco, ES-406). **No ejecuté flujos con IA ni escribí datos en staging para este ticket.**

| Función | Estado | Condición o límite | Evidencia |
|---|---|---|---|
| Conversación con asistente de IA | Existe | Depende de la clave de IA del servidor; no envié mensajes | `backend/server.js:121` (`routes/chat`), captura `u02` |
| Diario privado | Existe (crear, listar, editar, borrar) | Dueño = `req.user.id` | `backend/routes/diary.js:7,69-149` |
| Brújula profesional | Existe | La persona elige qué texto autoriza; el modo conversacional depende de `VITE_ENABLE_COMPASS_CHAT` | `frontend/src/compass/copy.ts:2`, `pages/ChatPage.tsx:74` |
| Mis evidencias | Existe (borrador, confirmada, versiones, borrar) | Ver §4 | `backend/utils/evidence.js:88-130`, `routes/evidence.js` |
| Hoja de vida y habilidades declaradas | Existe | PDF ≤ 5 MB, analizado con IA; nada pasa a evidencia sin confirmar | `backend/routes/resumes.js:17,35,42`, `routes/resumeSkills.js:23` |
| Mapa de capacidades | Existe | El nivel no certifica; sin evidencia no es déficit | `backend/server.js:125`, `skill-map/copy.ts:30,42` |
| Mis datos (copia / eliminación) | Existe, **con bandera** | Si `DATA_RIGHTS_ENABLED` ≠ `true` responde 503. En staging la pantalla carga; **no ejecuté** exportación ni borrado | `backend/routes/dataRights.js:27`, captura `u19` |
| Revisión profesional | Existe | La persona autoriza con un código; el código vence a los 7 días y sirve una vez | `routes/professionalReviews.js:6-7`, `utils/reviewInvites.js:16` |
| Rutas, experimentos, plan | **Vista preliminar con bandera** | `VITE_ENABLE_CAREER_PREVIEW`; en staging el catálogo está rotulado «[SINTÉTICO]»; publicar contenido sintético exige `ALLOW_SYNTHETIC_CATALOG` (producción no la define, según `utils/demoSeed.js`); sin recordatorios | `career/CareerShell.tsx:19`, `utils/routeCatalog.js:363,377`, `career/copy.ts:100`, captura `u13` |
| Ejercicios opcionales | Pantalla existe, **sin contenido** | Staging: «Aún no hay ejercicios publicados» | `routes/exercises.js`, captura `u16` |
| El Puente | **No se afirma** en la portada | Hay ruta y API, pero el diario muestra «El Puente estará disponible cuando su flujo de autorización esté integrado» | `bridge/`, captura `u03` |

Las capturas citadas están en `docs/ux/auditoria-diagramacion/capturas/` (ES-405, cuentas sintéticas vacías).

## 3. Portada

### 3.1 Problemas de la portada actual
- Explica una parte (evidencia y capacidades); no dice para quién es, qué problema resuelve, el recorrido completo ni qué se obtiene.
- Marca «En preparación» rutas, experimento y «Tus datos» (`components/landing/PortadaSections.tsx:28-54`), aunque «Mis datos» carga en staging y rutas/experimentos están activos con catálogo sintético.
- El título de la pestaña dice «Tu santuario digital» (`frontend/index.html:7`).

### 3.2 Estructura propuesta y qué cambia
| # | Bloque nuevo | Qué reemplaza hoy |
|---|---|---|
| 1 | Qué es y para quién (promesa + público + dos acciones; relieve ilustrativo) | Héroe con relieve y leyenda de símbolos |
| 2 | El problema (3 frases) | — (no existía) |
| 3 | Recorrido paso a paso con «Obtienes» en cada paso | «De una experiencia a una capacidad» (3 pasos) |
| 4 | Ejemplo fijo (se conserva, más corto) | Demostración `TryScene` |
| 5 | Lo que NO es + aviso de riesgo | Repartido entre «Privacidad y límites» y preguntas |
| 6 | Privacidad en lenguaje simple + «borrador sin revisión legal» | `landing.trust.*` |
| 7 | Disponible hoy (una lista, 3 estados) + piloto cerrado | «Qué puedes hacer», «SkillMap», «En preparación» |
| 8 | Preguntas (7) | 10 preguntas (q3, q4, q7, q8 salen: ver `TEXTOS.md`) |
| 9 | Entrada (crear cuenta, iniciar sesión, solicitud profesional) | «Próximo paso» + bloque profesional |

Estado de la acción «Crear cuenta»: se conserva la variante de **piloto cerrado** aprobada en ES-360. Nota ya registrada allí: el registro del servidor es público.

### 3.3 Rutas (variante principal) y estado «catálogo aún no disponible»
- **Lo verificado:** las rutas comparan lo que pide cada una con la evidencia de la persona (`backend/utils/routeEngine.js:24-62`: cada capacidad queda «con respaldo» o «sin evidencia»); siguen siendo **vista preliminar** (bandera `VITE_ENABLE_CAREER_PREVIEW`) y sin recordatorios.
- **No se inventan rutas ni fuentes:** la portada dibuja «Ruta de ejemplo A/B» y «Capacidad de ejemplo», con el rótulo «no son rutas reales»; la fuente es un hueco explicado.
- **Aún no disponible:** el paso 5 explica que el catálogo no está disponible y que se pueden registrar evidencias; en «Disponible hoy», las rutas pasan a *En preparación*. La app ya tiene el texto «El catálogo de rutas aún no está disponible» (`career/copy.ts:93`).
- **Discrepancia registrada (decide Mauricio/Alejo; se implementa lo decidido):** el catálogo de staging es sintético y publicar contenido sintético exige una bandera que producción no define. **Mi recomendación es publicar la portada con el estado «aún no disponible» hasta que exista un catálogo real con fuentes y fechas** (responsable: Alejo, según el comentario 13023). Mostrar rutas sintéticas a participantes como reales no es aceptable.

### 3.4 «Cómo mejorar tu hoja de vida» — no existe
Busqué en `main` (`frontend/src`, `backend`, `shared`): no hay función que recomiende mejoras. Las rutas de hoja de vida son listar, descargar, borrar, **analizar** (propone datos de «Mi contexto») y **pasar habilidades a evidencias** (`routes/resumes.js:52,65,77,103`, `routes/resumeSkills.js:20,23`). La portada **no la anuncia**. La pantalla «Hoja de vida (propuesta)» está rotulada «función nueva, no construida»: empareja lo que la hoja declara con las evidencias, sin puntajes, porcentajes ni promesa. Construirla requiere ticket, alcance, estimación y, si usa IA, gasto y pruebas.

### 3.5 Pendiente
- OK a la traducción de la promesa y del público.
- **Menores (16-17):** objeción abierta de Infra para abogado y Alejo; la portada queda en 18+.
- La frase del público («quieren y necesitan buscar trabajo») conviene validarla con el piloto, que es de **reconversión**; puede leerse como una oferta de empleo.

## 4. «Nueva evidencia»

### 4.1 Reglas verificadas en el servidor (`backend/utils/evidence.js`)
| Campo | Borrador | Confirmar | Límite |
|---|---|---|---|
| Título | obligatorio | obligatorio | 120 |
| Situación | al menos **un campo además del título** | **obligatorio** | 1000 |
| Mi responsabilidad | ídem | **obligatorio** | 1000 |
| Acciones | ídem | **obligatorio** (1–8) | 1000 c/u |
| Lo que entregué | ídem | **obligatorio** | 1000 |
| Efecto observado | ídem | **obligatorio** («No lo conozco» es válido) | 1000 |
| Meta, aprendizaje | opcional | opcional | 500 / 1000 |
| Alternativas | opcional | opcional (≤ 5) | 500 c/u |
| Autonomía | opcional | opcional | lista cerrada |
| Muestras | opcional | opcional (≤ 5, solo HTTPS) | URL 500, nota/extracto 300/1000 |

Líneas: mínimo de borrador `:126`; obligatorios al confirmar `:128` (422 `incomplete_evidence`); el servidor además enmascara secretos (`:51`) y cifra cada versión (`:242`). **El diseño no cambia ninguna regla.**

### 4.2 Qué cambia respecto a hoy
| Hoy (`pages/EvidencePages.tsx`, `evidence/FormFields.tsx`) | Propuesta |
|---|---|
| Doce grupos al mismo nivel, opcionales intercalados entre obligatorios | «Lo esencial» (los 6 de confirmación) a la vista; el resto en **«Añadir más contexto (opcional)»**, plegado |
| Sin ejemplos | **Dos ejemplos ficticios** plegados, cada uno rotulado «Ejemplo ficticio · no es de nadie» (operativo y de coordinación). No se insertan en el formulario |
| Etiqueta «Campo · Necesario para confirmar» y pista «Máximo n caracteres. Procedencia: Autorreporte» | Una **pregunta guía** por campo, estado obligatorio/opcional aparte y contador «n de máx» |
| — | **Plantilla ligera opcional** en Situación y Entrega: solo se inserta si el campo está vacío; el texto sigue libre. Si quedan líneas sin completar, bloquea *confirmar* (regla de **cliente**, nueva) y lo explica; no bloquea el borrador |
| Aviso de campos incompletos al enviar | Además, lista en texto «Para confirmar falta: …» junto a los botones. **Sin porcentajes ni barra de completitud** |
| Procedencia visible en cada pista | Se quita de la pista (el servidor sigue marcando autorreporte); se mantiene en la vista de detalle. **Confirmar con Alejo** |
| Muestra: tipo enlace o extracto | El prototipo solo dibuja el enlace; el extracto se **conserva** en producto (no se propone quitarlo) |

Se conservan: revisión previa con casilla, aviso «Una meta no es un resultado logrado», borrador/confirmada, aviso al salir con cambios y reintento sin duplicar.

### 4.3 Estados, teclado y responsive
- **Vacío**, **errores** (resumen con enlaces que llevan el foco al campo, mensaje junto a cada campo, `aria-invalid` y `aria-describedby`), **guardando** (botones deshabilitados, `role=status`), **falla** (el texto se conserva; reintentar), **borrador guardado**, **revisar** (confirmar deshabilitado hasta marcar la casilla) y **éxito** (foco al mensaje).
- Teclado: todo es alcanzable con Tab; ejemplos y «más contexto» son `details/summary`; radios y casilla nativos.
- 1440/1024: barra lateral actual **sin cambios** dentro del contenedor único de ES-406 (`--cg-wrap` 1240) y formulario de 46 rem. ≤ 900 px: una columna; a ≤ 600 px botones a ancho completo. La barra de acciones va **al final del formulario** (se descartó fija porque tapaba campos).

### 4.4 Componentes y tokens
Reutiliza tokens de Cartografía (`--cg-ground/panel/ink/muted/line/mark/contour/err/good`, `--cg-touch`), `--cg-wrap` de ES-406 y las familias Barlow; las piezas se corresponden con `TextField`, `TextAreaField`, `ScaleField`, `Banner`, `Card`, `Button`, `Chip`. **Nuevos:** superficies suaves (`--soft-mark`, `--soft-err`, `--soft-good`, `--soft-warm`), `--field` (fondo de campo), contador de caracteres, bloque «Obtienes», lista de estados «Disponible hoy» y bloque plegable de ejemplos.

## 5. Afirmación → evidencia en el código
| Afirmación de la portada | Evidencia | Alcance de lo verificado |
|---|---|---|
| Hay un asistente de IA, señalado como IA, no clínico | `routes/chat.js` (`server.js:121`); límites en `landing.trust.1` | Código y pantalla; sin conversar en esta tarea |
| Diario privado; no se muestra a profesionales ni administración | `routes/diary.js:7,44` | Rutas de la aplicación. No cubre acceso de operación a la base (el contenido va cifrado, `:79`) |
| Tu profesional no lee tu chat ni tu diario | `routes/diary.js:7`; textos vigentes `landing.faq.a2` y `access.privacy_note` | El diario verificado en código; **el chat no lo verifiqué ruta por ruta** → QA debe confirmarlo antes de publicar |
| La IA analiza chat/diario/hoja de vida solo si los eliges y autorizas | `routes/insights.js:2` (fuentes elegidas), `utils/insightProposal.js:21,120-123` (permiso por fuente `insights_chat/diary/resume`; sin permiso, 403); `landing.faq.a2/a4` | Revisado el contrato de insights; la conversación misma sí envía tus mensajes a la IA |
| Hoja de vida PDF ≤ 5 MB; la IA propone, tú confirmas | `routes/resumes.js:35-46`, `routes/resumeSkills.js:23`, `evidence/copy.ts` (`rs_intro`) | Código; no subí archivos |
| Borrador / confirmada; solo las confirmadas evalúan | `utils/evidence.js:126-128,359`; `evidence/copy.ts` (`intro`) | Código |
| Evidencias solo visibles para la cuenta dueña (y la persona revisora autorizada) | comentario y rutas de `routes/evidence.js:6-7`; `routes/professionalReviews.js:6-7` | Código; las pruebas de aislamiento son de QA (no las corrí) |
| Mapa: lo plano no es déficit; el nivel no certifica | `skill-map/copy.ts:30,42` | Texto vigente del producto |
| Brújula: eliges qué texto autorizas | `compass/copy.ts:2` | Texto y pantalla |
| Las rutas comparan lo que piden con tu evidencia | `utils/routeEngine.js:24-62` | Código; no ejecutado con un catálogo real |
| Piloto solo 18+ | decisión de Mauricio, ES-409 (13027) | **La casilla aún no está en `main`**: no publicar la frase antes de que ES-409 esté desplegado. El aviso y los términos aún no dicen la edad |
| Rutas: vista preliminar, sin recordatorios, catálogo de ejemplo en pruebas | `career/CareerShell.tsx:19`, `career/copy.ts:100`, `utils/routeCatalog.js:377` | Código y captura de staging |
| Ejercicios: sin publicar | captura `u16` | Estado de staging al 23-nov |
| Mis datos: copia y eliminación «cuando esté habilitada» | `routes/dataRights.js:27` | No ejecutado |
| Sin pago en línea; ES y EN; piloto cerrado | textos vigentes `landing.faq.a9/a10`, `landing.next.pilot.*` (ES-360) | No reverificado más allá de que son los textos aprobados |

**Lo que la portada deliberadamente NO dice:** cumplimiento GDPR/AI Act, cifras de usuarios, testimonios, promesas de empleo o resultados, porcentajes, nada sobre detección de crisis.

## 6. Comprobaciones del prototipo
`node check.cjs` (Playwright, **Chromium**): **160 escenas** (portada en los 2 estados de catálogo, propuesta de hoja de vida y 7 estados de evidencia; 1440/1024/390/320 × ES/EN × claro/oscuro), 0 fallos: desbordes, controles < 44 px (salvo radios y casillas nativos con etiqueta grande y enlaces en línea), textos < 13 px, porcentajes, claves sin texto, errores de JS, promesa y 18+ presentes, sin «16», «70» ni rangos en la portada, y los flujos de evidencia por teclado; **axe WCAG 2.x A/AA en 40 escenas: 0 violaciones**. Registro e invitación se comprobaron aparte (ver `REGISTRO-18.md`: 224 escenas, axe en 112, 0 fallos). Las primeras capturas mostraron defectos que las pruebas no veían (barra fija tapando campos, rótulo duplicado, columnas vacías) y se corrigieron.

## 7. No verificado
- Sin pruebas con personas; las hipótesis (ejemplos, esencial/opcional, plantilla) necesitan validarse en el piloto.
- Solo Chromium de escritorio emulando anchos: **no** Safari/iOS, Firefox, teléfono real, lector de pantalla, zoom 200 % ni teclado virtual.
- El prototipo es HTML/JS estático: no valida contra el servidor ni reproduce sus códigos de error (409, 401, 403) ni el aviso al salir.
- Textos EN nuevos sin revisión de una persona nativa; textos legales sin revisión legal.
- No ejecuté flujos de IA, exportación ni borrado en staging.
- El chat frente al profesional no se verificó ruta por ruta (ver §5).

## 8. Decisiones que se piden
1. OK a «Recognise your path» y al público en inglés.
2. Confirmar qué estado de rutas se publica mientras el catálogo sea sintético (recomiendo «aún no disponible»).
3. Si se quiere la función de hoja de vida, ticket aparte.
4. Quitar la «procedencia» de las pistas del formulario y aprobar la regla de cliente de la guía incompleta.
5. Aprobar el diseño de portada y «Nueva evidencia» (sin esto no se implementan). El de la casilla 18+ ya está aprobado en ES-409.
