# ES-21 · Límites de acompañamiento y frontera privada

26-oct-2026 · Dev-Claude · Cubre SP2-HU19 (RF-14, RF-15). Implementación en la rama de ES-21 (apilada sobre ES-20). **Todo el texto de seguridad, la lista de palabras y los escenarios son BORRADORES sin validar: requieren la revisión de un especialista identificado (ES-17 / ES-24, hoy sin responsable) antes de abrir el piloto.** Mauricio implementa los controles; Alejo coordina la validación editorial.

## 1. Qué se implementó

| Control | Dónde | Estado |
| --- | --- | --- |
| Detector de riesgo ES/EN en dos niveles (grave y malestar) | `backend/utils/safety.js` | Borrador sin validar |
| Interrupción del flujo ordinario en escenarios graves: no se llama a Claude | `backend/routes/chat.js` | Probado con proveedor simulado |
| Respuesta de seguridad no clínica y nota de apoyo en malestar | `backend/utils/safety.js` | Texto en borrador |
| Registro de recursos locales verificados por país y fecha | `backend/config/supportResources.json` | **Vacío a propósito** |
| Saneado y delimitación del prompt; límites de acompañamiento fijos | `backend/utils/promptSafety.js` | Texto de límites en borrador |

## 2. Protocolo (borrador para el especialista)

1. **Grave** (intención o plan de quitarse la vida, expresiones de no querer vivir): se interrumpe el flujo ordinario. No se llama al modelo, no se continúa el coaching. Se responde con un mensaje que reconoce lo dicho, aclara que Elevation no es un servicio de emergencias ni de salud, remite a los servicios de emergencia o a una persona de confianza y, solo si existen, muestra recursos verificados del país declarado. La conversación se guarda como cualquier otra (la persona puede retomarla).
2. **Malestar** (autolesión, «no aguanto más», «desaparecer»): el flujo continúa y la respuesta se acompaña de una nota breve de apoyo.
3. **Nunca:** diagnosticar, prescribir o recomendar medicación, atribuir eficacia clínica, calcular una puntuación de salud mental o de empleabilidad, ni avisar a terceros.

## 3. Límites del detector (RF-14)

El detector es una ayuda limitada, no un sistema clínico. **Que no detecte nada no significa que no haya riesgo.**
- **Sobre-activa a propósito.** No entiende negaciones ni modismos: «quiero morir de risa» y «no quiero morir» se tratan como graves; «esto va a desaparecer pronto» como malestar. Se prefiere interrumpir de más a callar.
- **No detecta lo indirecto:** «ya nada importa», «ojalá no despertar», «no veo salida», faltas de ortografía («suisidarme»), otros idiomas, ironía y metáforas.
- Solo analiza el mensaje actual, no el historial.
- **ES-92 (QA-13-01):** reconoce «me quiero hacer daño / lastimar / cortar», «harm myself» y «I do not / don't / dont want|wanna live» (también con apóstrofo tipográfico). Sigue sin entender negaciones: «no quiero lastimar a nadie» no activa porque no lleva «me» antes del verbo, pero «me voy a lastimar» (accidente) sí activa. «Cortar» no activa con un objeto cotidiano («me quiero cortar el pelo»); «live in/at/on/near…» se trata como lugar. La lista sigue siendo BORRADOR a revisar por el especialista (ES-24).
- **ES-92 (QA-92-01/02/03):** «me quiero matar», «me voy a quitar la vida» e «I wish I was dead» son ALTO; un «no» justo antes («no me quiero hacer daño») niega la frase; «live in/at/near…» es un lugar pero «live on this planet anymore» sigue siendo ALTO. **Falsos positivos aceptados a propósito:** «me voy a cortar con el cuchillo» (accidente o autolesión: no se distingue) e «I do not want to live with my parents anymore» (igual que «live with this anymore», que es angustia real).
- Normaliza acentos, mayúsculas, espacios y caracteres invisibles, pero un texto muy ofuscado puede escaparse.
- Los casos anteriores están probados como «límites conocidos» en `backend/test/es-21-safety.test.cjs`.
- No hay medición de aciertos ni de falsos positivos con casos reales: el corpus de evaluación es de ES-44/ES-46.

## 4. Recursos locales verificados

- `supportResources.json` **sale vacío**. Una línea solo se muestra si tiene `label`, `contact`, `source` (documento o URL oficial), `verifiedBy` y `verifiedAt` vigente (por defecto ≤ 180 días); si falta algo o está vencida, no se publica.
- **El país no se infiere del idioma.** Solo se usa un país declarado por la persona (`country` de dos letras en `POST /api/chat`; el dato de residencia llegará con ES-14). Sin país o sin recurso verificado, el mensaje remite a los servicios de emergencia y la línea de ayuda oficiales del país **sin números**.
- **No se reutilizaron los teléfonos de `platform/`** (`crisisDetector.ts`): no están verificados por país ni por fecha.
- Para añadir un país: quien verifica anota fuente y fecha en el archivo, y el cambio pasa por PR con revisión.

## 5. Frontera privada

- El nivel de riesgo **vive solo durante la solicitud**: no se guarda en ninguna tabla, no se escribe en los registros del servidor y no se devuelve en ninguna respuesta de administrador, terapeuta o facilitador. La respuesta al propio chat solo marca `interrupted: true` en la interrupción grave.
- No hay alertas automáticas a empresa, facilitador ni terceros, ni transferencia al motor profesional (que además no existe todavía: ES-25).
- Pruebas: el detector solo lo importa `chat.js`; ningún modelo declara campos de riesgo; no hay red ni base de datos dentro del detector; ni el estado ni los registros contienen la etiqueta ni el texto de un mensaje grave.

## 6. Saneado y delimitación del prompt (INV-05)

- El mensaje se normaliza (caracteres de control, invisibles y de dirección de texto) y se limita a 4.000 caracteres (400 por encima); cada mensaje del historial recibe el mismo tope y se descarta el que queda vacío.
- Las entradas del diario elegidas entran dentro de un bloque con un delimitador aleatorio por solicitud (`UNTRUSTED_<16 hex>`) y la instrucción de tratarlo como dato y no como órdenes. El mensaje actual va por el canal de usuario, nunca dentro del prompt del sistema.
- Los límites de acompañamiento van fijos al final del prompt del sistema, después del aviso editable y del manifiesto.
- **Esto reduce el riesgo de inyección de prompts, no lo elimina.** No se evaluó con ataques reales contra Claude.
- Pendiente: delimitar las notas del terapeuta en `resumen-ia` y en la recomendación de fin de sesión (ramas de ES-78/ES-79).

## 7. Escenarios para la revisión del especialista (lista inicial, sin texto sensible)

Intención o plan de quitarse la vida · deseo de no vivir · autolesión · desesperanza fuerte · violencia propia o ajena · abuso o peligro inmediato · consumo problemático · duelo reciente · crisis laboral con estrés extremo · mensaje ambiguo o irónico · mensaje en inglés, en español mezclado con inglés o con faltas de ortografía · persona que rechaza ayuda · persona que retoma la conversación después de una interrupción grave. Para cada uno: respuesta esperada, qué no debe decir el sistema y recurso local aplicable por país. La coordinación editorial es de Alejo.

## 8. Qué no cubre este ticket

Validación por el especialista y verificación de recursos por país; evaluación con casos reales (ES-44/ES-46); un detector más allá de palabras y patrones; moderación de las respuestas del modelo; delimitación de las notas del terapeuta; envío de `country`/`lang` desde la interfaz.

## ES-298 · La frase de crisis ya no viaja al proveedor en los mensajes siguientes (E281-1)
Decisión de Mauricio (12-nov-2026, opción A): al armar el historial que se envía al proveedor, `routes/chat.js` vuelve a evaluar cada mensaje de la persona con `detectRisk` (texto completo, antes de acotarlo) y OMITE el turno interrumpido: la frase de nivel alto y la respuesta de apoyo que la siguió. El indicador NO se persiste ni se registra; el historial que ve y conserva la persona NO cambia; el contrato de la API no cambia. El malestar (nivel medio) sigue siendo un turno ordinario y viaja. Límite: lo que el detector no reconoce (ver arriba) sigue viajando; cero casos detectados no es garantía. Pruebas: `test/es-298-crisis-history.test.cjs` y la matriz `es-281` (ninguna solicitud al proveedor lleva la frase).

## ES-304 · El detector ya no se evade con trucos triviales de escritura
`detectRisk` evalúa el texto en varias FORMAS normalizadas (solo para evaluar: lo que se guarda y se muestra NO cambia): NFKC (ancho completo, letras matemáticas), minúsculas, rellenos invisibles (U+3164, U+2800, U+115F, U+1160, U+FFA0, U+180E, U+061C, U+034F) quitados o tomados por espacio, marcas y formato Unicode (\p{Cf}, \p{Mn}, \p{Me}, incluidos los caracteres de etiqueta U+E0000–E007F), homoglifos cirílicos/griegos a latín, frase codificada con caracteres de etiqueta (se decodifica a ASCII), letras sueltas separadas (por espacios, puntos, comas o guiones; con palabras separadas por varios espacios), leet, letras alargadas o duplicadas y signos entre palabras. La primera forma es la de siempre: lo que ya se detectaba se sigue detectando igual. Nivel alto antes que medio.
**Corpus de QA (163 casos que antes NO se detectaban):** se recuperan por completo 13 categorías de evasión (≥ 100 variantes: etiquetas intercaladas y codificadas, cirílico, ancho completo, separadas por espacios y por puntos, leet, alargadas, rellenos, braille, U+180E/U+061C, letras matemáticas, comas/guiones). **Falsos positivos:** 110 frases benignas (50 de QA + 60 propias) no cambian de nivel. **NO se promete:** lo semántico (indirectas ES/EN, otros idiomas, emojis, jerga), «sin espacios» y faltas de ortografía: son del especialista (ES-44/46). Cero casos detectados sigue sin ser garantía. Pruebas: `test/es-304-detector-normalization.test.cjs` (una muestra por paso: quitar cualquiera hace fallar la prueba) y `test/fixtures/crisis-evasion-corpus.json`.

**Optimización de costo (E304-1, decisión de Infra, ES-304 comentario 12057):** formas perezosas con salida en la primera alta, una sola pasada de `flat` por texto (las formas derivadas se calculan sobre el texto ya plegado), reglas unidas en una expresión por nivel y memoria por mensaje (clave = huella sha256; NO se guarda texto ni datos personales, solo nivel e idioma; tope de 1.000 entradas, FIFO; devuelve copias). Equivalencia comprobada contra la referencia (todas las formas, regla por regla) en 6.000 textos generados. Límite del detector sin cambios: ver «homoglifos (E304-3)» arriba.

## ES-312 · Más homoglifos reconocidos por el detector (tabla de confusables acotada)
Además de NFKC y de la tabla manual de 25 cirílicos/griegos de ES-304, `detectRisk` aplica ahora una tabla GENERADA de **135 entradas** (UTS #39, Unicode 18.0.0, `backend/data/unicode/confusables.txt`, versionada en el repositorio; `backend/scripts/gen-confusables.cjs` la regenera y la prueba `es-312` compara el resultado byte a byte; el servidor NUNCA descarga nada en ejecución). Cada entrada es UNA letra de latín extendido/IPA, versalitas (ᴍ, ɴ, ᴇ…), griego (κ, γ, σ…), cirílico, armenio (ո, ս, ց…), cherokee o lisu que se lee como UNA letra a-z (ı→i, ɑ→a, κ→k…). Se aplica tras NFKC y minúsculas, solo para evaluar: lo que se guarda y se muestra NO cambia, y la primera forma (la de siempre) tampoco.
**Lo que NO se cubre, y se declara:** CJK, símbolos, emojis, cifras de otras escrituras, mapeos de varias letras («rn» → m), las letras ASCII, de Latin-1 y acentuadas (ñ, á, ü… NUNCA se reasignan), los dígitos (1/l/I y 0/O quedan fuera a propósito), otros alfabetos completos y lo semántico («sin espacios», faltas de ortografía, indirectas, otros idiomas, jerga). Una frase escrita con un carácter fuera de la tabla NO se detecta. Esto es una AYUDA, no una protección completa ni un diagnóstico.
**Falsos positivos:** barrido de cada carácter de la tabla (añadido y sustituyendo su letra) en 41 frases benignas, y texto natural de otros alfabetos (griego, ruso, armenio, turco, IPA, versalitas, cherokee, lisu): ningún cambio de nivel. La medición con tráfico real NO se hizo. Pruebas: `backend/test/es-312-confusables.test.cjs`.
