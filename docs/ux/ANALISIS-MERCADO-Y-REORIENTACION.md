# ES-148 · Análisis de mercado y reorientación del diseño

*[UX-Claude] · 4-nov-2026 · Borrador para decisión de Mauricio y Alejo. Estado: **sin aprobar**.*

Mauricio devolvió el diseño «Cuaderno» porque se nota hecho por una IA, tanto en los colores como en la distribución de las pantallas con sesión iniciada. Este documento revisa a dos competidores, los dos archivos que envió Alejo y mi propio prototipo, y propone cómo seguir.

## 1. Competidores (vistos el 4-nov-2026 en el navegador, solo la portada y un recorrido corto)

| | Selia (selia.co) | RumboCV (rumbocv.org) |
|---|---|---|
| Qué vende | Terapia online con especialistas, coaching, psiquiatría y tests. Mercado de especialistas con «matching». | Taller de CV y entrevistas. Dos recorridos: «Estoy empezando» y «Quiero reposicionarme». |
| Apariencia | Lila y ciruela oscuro, titulares con serif suave, fotografía real de personas, bandas oscuras de cierre. | Violeta y negro, sans geométrica, tarjetas redondeadas, chips, botón flotante «Career Coach». |
| Lo que hace bien | Fotografía humana. Cifras de confianza (+400k sesiones, 4,92/5). Matching y tests como puerta de entrada. Línea de emergencia en el pie de página. | Dos puertas claras según el momento profesional. Lista concreta de temas por recorrido. Voz regional (voseo). |
| Lo que flaquea | Es genérico dentro de «bienestar». Su menú es muy cargado. A ~800 px de ancho los títulos de las tarjetas de servicios se solapan con el texto. Hay erratas visibles («emocinoal»). Usa tests de ansiedad y depresión, que Elevation no puede ofrecer (no clínico). | Es la plantilla SaaS violeta de siempre. Incluye un chatbot flotante y «Ikigai», un lugar común. No muestra cómo funciona ni de dónde sale lo que dice. |
| Voz | Tuteo neutral, promesas amplias («sanar», «la vida que mereces»). | Voseo argentino. |

**Lectura.** El mercado de acompañamiento y carrera está lleno de lila, violeta y pastel. El diseño de Alejo y el mío caen en esa misma zona. Ninguno de los dos competidores se apoya en lo que Elevation tiene y ellos no: **cada afirmación se puede rastrear hasta las palabras de la persona**. Selia vende acceso a profesionales y RumboCV vende herramientas de CV.

## 2. Los archivos de Alejo

**`portada-concepto V1`** (violeta, coral y lima)
- *Sirve:* el gancho «Tu experiencia tiene más pistas que tu cargo», las dos señales de confianza («cada sugerencia enlaza con lo que la originó») y las guías con autoría y fuentes visibles.
- *No sirve:* es la plantilla SaaS (héroe en bloque de color, tres tarjetas con «01 / 02 / 03», banda verde con checks, buscador que el producto no tiene). Usa Arial por defecto, o sea que la tipografía no es una decisión. El collage de la portada no vino adjunto, así que no se puede juzgar. «La confianza también se diseña» suena a frase de IA.

**`resonancia-interactiva V3`** (pastel, formas orgánicas)
- *Sirve, y es lo mejor que hay en la mesa:* la interacción. La persona escribe una escena, la plataforma subraya sus propias palabras como respaldo, propone una «posible pista» y la persona la acepta o la descarta. Los textos «Una sugerencia, no una evaluación» y «Tú decides qué guardar» cumplen las reglas no clínicas.
- *No sirve:* las manchas pastel, el lila con rosa y la fuente del sistema son el estilo de «bienestar» genérico que ya usan los competidores. Alguna frase suena a español de España («¿Puede ser que se te dé bien…?»); para Colombia sería otra («¿Será que se te facilita…?»). Es una sola pantalla de entrada. Los usuarios con sesión no aparecen.

## 3. Mi prototipo «Cuaderno»

Mauricio tiene razón y no lo defiendo.
- Elegí la receta más repetida del diseño con IA: papel crema, titulares serif, un acento ocre y textura de grano.
- Cambié la piel pero conservé la estructura del producto actual: lista, pestañas, paneles laterales y tarjetas. Por eso las pantallas con sesión se ven como cualquier panel.
- Escribí los textos yo solo, sin edición ni voz de marca definida.
- Dibujé las caras y las ilustraciones con código. Es un rasgo reconocible de IA y no vale como identidad.

**Qué se conserva:** los hallazgos H-01 a H-47, las decisiones de comportamiento (confirmación previa, borradores con «Revisar y confirmar», sin versiones visibles) y los textos de seguridad y no clínicos. Lo que se descarta es la piel y la distribución.

## 4. Propuesta: el diseño parte del objeto propio del producto

La unidad del producto es **una frase de la persona y lo que se apoya en ella**. Eso no lo tiene nadie del mercado. El diseño debe construirse alrededor de ese objeto y no alrededor de una paleta.

Tres direcciones que difieren en concepto, no en color. Son hipótesis para investigar, no decisiones:

1. **Subrayado (edición sobre tus palabras).** Todo se organiza en torno al texto de la persona, con marcas de editor: subrayado, corchetes, notas al margen y un hilo desde la frase hasta la capacidad. La estética sale de la corrección de texto y no del bienestar.
2. **Cartografía (mapa y brújula).** El producto ya tiene «Compass» y «Territories». Líneas de nivel, escala, leyenda y coordenadas; el mapa de capacidades como un plano real. Se aleja del pastel y del lila.
3. **Taller (oficio).** La carrera como oficio: fichas, muestras, etiquetas de taller y cultura gráfica local trabajada con criterio (rotulación y empaques de Bogotá, sin caer en el souvenir).

Cualquiera de las tres cierra con las mismas reglas: voz colombiana (tuteo, sin voseo ni giros de España), sin promesas de empleabilidad y sin lenguaje clínico.

## 5. Proceso para llegar a un trabajo profesional

1. **Estudio de referentes ampliado:** diez a quince plataformas (acompañamiento, carrera, producto editorial, cartografía), con capturas, una matriz de qué hace cada una y una lista de lo que no usaremos.
2. **Tres prototipos codificados, una pantalla clave cada uno** (portada, inicio con sesión y chat), con tipografía con licencia, sin la pila genérica del sistema. Mauricio y Alejo eligen o mezclan.
3. **Manual de voz y curaduría de textos** con un rol de redactor-editor: español de Colombia, titulares y microtextos revisados, ES y EN pensados por separado. Lista de control contra los vicios de texto de IA.
4. **Crítica dura antes de mostrar:** una revisión con criterio de dirección de arte por ronda.
5. **Piezas que no debería inventar una IA:** fotografía, ilustración y logotipo. Propongo que las encargue MindSpark a personas reales. Mientras tanto, el prototipo usa marcadores claramente marcados.

**Límite que declaro:** ningún proceso garantiza «gusto». Lo que sí se puede es decidir con referentes reales, dejar rastro de cada decisión y tener una puerta humana de aprobación.

## 6. No verificado

- Solo vi la portada de cada competidor y un par de desplazamientos. No hay análisis de sus pantallas internas, precios ni flujo de registro.
- No abrí la portada de Alejo en el navegador: la V1 depende de una imagen que no vino adjunta. Evalué sus textos y su código.
