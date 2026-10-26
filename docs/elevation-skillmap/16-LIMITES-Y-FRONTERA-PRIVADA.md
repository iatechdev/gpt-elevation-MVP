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
