# Aviso de privacidad y política de tratamiento de datos

> **BORRADOR SIN REVISIÓN LEGAL** · versión de trabajo `2026-11-v1` · ES-335 · 18-nov-2026.
> Redactado a partir de lo que el sistema hace hoy (verificado contra el código; ver `../VERIFICACION-CONTRA-CODIGO.md`). No es asesoría legal y no debe publicarse a personas reales sin revisión del abogado y sin completar los marcadores.
> Marcadores: `[POR COMPLETAR PC-nn]` = dato que solo la empresa puede dar; `[VERIFICAR VF-nn]` = hecho que no se pudo comprobar. Lista completa en `../POR-COMPLETAR.md`.

**Última actualización:** [POR COMPLETAR PC-05: fecha de vigencia]

## 1. Quién es responsable de tus datos

[POR COMPLETAR PC-01: razón social] ([POR COMPLETAR PC-02: NIT o identificación tributaria]) es la responsable del tratamiento de tus datos personales.

- Domicilio: [POR COMPLETAR PC-03: domicilio].
- Contacto para asuntos de datos (consultas, reclamos, ejercicio de derechos): [POR COMPLETAR PC-04: correo de contacto de datos].
- Persona o área encargada de la protección de datos: [POR COMPLETAR PC-10: si aplica].

## 2. Qué es Elevation y qué no es

Elevation te acompaña a conocerte, ordenar tus habilidades y probar pequeños pasos de avance en tu trayectoria profesional. Es un acompañamiento emocional **no clínico** y de autoconocimiento.

**No es terapia, no hace diagnósticos, no receta nada y no promete resultados ni empleo.** Los detalles están en el *Aviso de producto no clínico* (documento 03).

## 3. Qué datos tratamos

| Categoría | Qué incluye | Cómo se guarda |
| --- | --- | --- |
| Cuenta | Nombre, correo electrónico, contraseña, rol dentro de la plataforma (persona, profesional, administración…), plan elegido, fechas de creación y de acceso, intentos fallidos de ingreso y bloqueos temporales. | La contraseña se guarda con un algoritmo de resumen (hash) y nunca en texto legible. |
| Aceptación de este aviso y de los términos | La versión que aceptaste y la fecha de aceptación (las pone el servidor). | Tabla de usuarios. |
| Tu contexto profesional | Lo que tú declaras al empezar: país de residencia, mercado objetivo, zona horaria, idioma preferido, profesión, intereses, disponibilidad semanal, meta y restricciones de carrera, sector, años de experiencia, experiencia, educación, habilidades e idiomas. | Cifrado a nivel de aplicación. |
| Tus conversaciones | Los mensajes que escribes al asistente y sus respuestas. | Cifrado a nivel de aplicación. |
| Tu diario | Las entradas que escribes. | Cifrado a nivel de aplicación. |
| Tu ánimo y valoraciones | Registros de ánimo (entrada y salida de una sesión) y valoraciones de sesión. | Base de datos. |
| Tus evidencias y tu mapa de habilidades | Situaciones, resultados y habilidades que registras o confirmas, con sus versiones. | Cifrado a nivel de aplicación. |
| Tus hojas de vida | Los archivos PDF que subes y el análisis que tú autorices. | Archivo en almacenamiento privado; contenido cifrado. |
| Tus permisos | Cada permiso que das o retiras (propósito, alcance, versión y fecha), con su historial. | Base de datos. |
| Uso de la IA | Tipo de llamada, modelo, periodo, tokens, costo, latencia y código de error; **sin** el texto de tus mensajes ni de las respuestas. | Base de datos. |
| Opinión sobre el piloto | Tus respuestas a las preguntas de «Tu opinión», solo si diste ese permiso (documento 06). | Base de datos. |
| Invitaciones | Si te invitaron: tu correo, el rol y el idioma de la invitación, y un resumen irreversible del enlace (no el enlace). | Base de datos. |
| Solicitud de profesional | Si pides ser profesional: nombre, correo, licencia, mensaje, perfil y hoja de vida. Si eliminas tu cuenta, solo se conservan su estado y fechas. | Base de datos y almacenamiento privado. |
| Datos técnicos mínimos | Lo necesario para mantener la sesión (ver documento 04) y para la seguridad: límites de intentos, tokens de sesión revocados. | Navegador y base de datos. |

**Te pedimos no escribir datos de salud ni datos de otras personas** (por ejemplo, nombres o datos de contacto de terceros) en tus textos.

[VERIFICAR VF-04: confirmar con Mauricio si el nombre y el correo de la cuenta se guardan cifrados o en claro; hoy se asume en claro, porque administración los ve para operar la cuenta.]

## 4. Para qué usamos tus datos

- Prestarte el servicio: conversar contigo, guardar tu diario, construir tu mapa de habilidades y proponerte pequeños experimentos.
- Mantener tu cuenta y la plataforma seguras (control de acceso, límites de intentos, revocación de sesiones).
- Atender tus solicitudes sobre tus datos (consultar, descargar, corregir, retirar permisos, eliminar).
- Mejorar el piloto con resultados **agregados**, solo si diste el permiso de «Tu opinión» (ver documento 06). Los grupos de menos de 5 personas no se muestran.

**No usamos tus datos para publicidad ni los vendemos.** [VERIFICAR VF-05: confirmar con Alejo que no existe ni se prevé ningún otro uso comercial.]

El permiso de **investigación** (`research`) existe como opción separada y opcional en el sistema, pero hoy ninguna función lo utiliza. [VERIFICAR VF-06: confirmar con Alejo si habrá un uso de investigación y, de haberlo, redactarlo antes del lanzamiento.]

## 5. Qué es privado

- **Tus conversaciones y tu diario son solo tuyos.** El equipo profesional, la administración y la superadministración no los ven.
- **Lo que podría indicar una crisis no se comparte con nadie.** El nivel de riesgo detectado vive solo durante esa solicitud: no se guarda, no se registra y no pasa a ningún profesional, administrador ni tercero. No hay alertas automáticas a nadie.
- **Un profesional solo ve lo que tú autorizas**, y solo lo que autorizas (documento 05). Puedes retirar cada permiso cuando quieras.
- La administración ve datos de la cuenta necesarios para operar la plataforma (nombre, correo, rol, estado, plan, bloqueos) y **resultados agregados**; nunca tu diario ni tus conversaciones.

## 6. Con quién se comparten tus datos

Solo en estos casos y siempre con tu permiso expreso, por separado:

1. **Tu profesional (terapeuta o facilitador) asignado**, si autorizas compartir con él tu correo, tu ánimo y tus valoraciones (no verá tus chats, tu diario ni tu mapa de carrera). El permiso está ligado a **esa persona**: si cambia tu profesional, el nuevo no hereda la autorización.
2. **El puente profesional**: lo que tú eliges cruzar desde tu exploración privada hacia tu trabajo de carrera, texto por texto.
3. **Un revisor** que tú designas para ver material que marcas, con posibilidad de objetar su revisión.
4. **La IA**, para leer tu chat, tu diario o tu hoja de vida con el fin de proponerte ideas, solo si das ese permiso por fuente (ver sección 7).

No hay transferencia a empresas empleadoras ni a terceros comerciales.

## 7. Inteligencia artificial y proveedores

Las respuestas del asistente las genera un modelo de lenguaje de **Anthropic** (modelo Claude), al que el servidor envía lo estrictamente necesario:

- **Chat:** hasta tus últimos 20 mensajes de la conversación y las entradas de diario que tú elijas para esa conversación. No enviamos tu nombre ni tu correo.
- **Si un mensaje tuyo muestra un indicio grave de crisis,** ese turno no se envía al modelo: te respondemos con un mensaje de seguridad fijo (tampoco se reenvía en mensajes posteriores).
- **Recomendaciones de bienestar:** un resumen de tus últimos 7 registros de ánimo (cuántos hay, promedio y tendencia), sin texto tuyo.
- **Análisis de habilidades:** las evidencias que confirmaste (entre otros datos: título, situación, responsabilidad, acciones, objetivo, resultado, aprendizaje y la autonomía que declaraste) y la rúbrica del catálogo, cuando pides el análisis de tu mapa. No se envían tu diario, tu ánimo ni tus conversaciones.
- **Propuesta de capacidades desde tu contexto profesional** (función de servidor, hoy sin pantalla propia): los campos del contexto profesional que aprobaste en El Puente (motivaciones, valores, intereses, energía, condiciones deseadas y restricciones). [VERIFICAR VF-19: confirmar con Mauricio si esta función se activará para personas usuarias y cuándo; si no, retirar esta viñeta.]
- **Lectura de tus fuentes (solo si lo autorizas, fuente por fuente):** hasta 20 mensajes de tu chat, hasta 10 entradas de tu diario o el texto de tu hoja de vida sin datos de contacto, para proponerte ideas.
- **Emparejamiento con un profesional:** las respuestas cortas que elegiste, sin tu ánimo.
- **Si compartes con tu profesional:** al cerrar una sesión, una etiqueta de tu ánimo; y, cuando tu profesional pide un resumen, solo cifras agregadas (cuántos registros, promedio de ánimo y promedio de valoraciones), sin tu nombre ni tus textos.
- Antes de enviar, enmascaramos claves, tokens y cadenas de conexión que hayas pegado. Las respuestas del modelo pueden contener errores; revísalas antes de usarlas para decidir algo importante.

Además de Anthropic, usamos proveedores que tratan datos por nuestra cuenta (encargados):

| Función | Proveedor | País / transferencia |
| --- | --- | --- |
| Modelo de lenguaje | Anthropic | [POR COMPLETAR PC-11: país y base de la transferencia] |
| Alojamiento de la aplicación | [POR COMPLETAR PC-11: proveedor vigente al lanzamiento] | [POR COMPLETAR PC-11] |
| Base de datos y almacenamiento de archivos privados | [POR COMPLETAR PC-11: proveedor vigente al lanzamiento] | [POR COMPLETAR PC-11] |
| Correo transaccional (restablecer contraseña, invitaciones) | [POR COMPLETAR PC-11: proveedor aún no definido] | [POR COMPLETAR PC-11] |

[VERIFICAR VF-01: el código y los documentos de despliegue mencionan alojamiento en Railway, Supabase (almacenamiento de archivos y base de datos) y un despliegue previsto en Vercel + Supabase. Infra debe confirmar cuál es el entorno real de producción.]
[VERIFICAR VF-02: confirmar contractualmente que el proveedor de IA no usa los datos enviados para entrenar sus modelos y cuánto tiempo los conserva.]
[VERIFICAR VF-03: confirmar el país de cada proveedor y si hay transferencia internacional de datos.]

## 8. Cuánto tiempo los guardamos

Resumen (detalle en el documento 07): conservamos tus datos mientras tu cuenta esté activa. Si pides eliminar tu cuenta, **purgamos tus datos de contenido** (conversaciones, diario, evidencias, hojas de vida, ánimo, valoraciones, permisos, solicitudes de plan…), dejamos tu usuario como registro sin nombre ni correo, y **conservamos lo que escribió un profesional sobre ti** (notas clínicas o de sesión) porque es su registro profesional [PC-14]. Los plazos exactos están por definir: [POR COMPLETAR PC-06].

## 9. Tus derechos y cómo ejercerlos

Puedes, en cualquier momento:

- **Conocer y descargar** tus datos (exportación personal en la aplicación).
- **Corregir** tus datos de cuenta y de contexto.
- **Retirar** cada permiso de compartir o de lectura por IA. Una copia que ya descargaste no puede recuperarse automáticamente.
- **Pedir la eliminación** de tu cuenta y de tus datos.
- **Presentar consultas o reclamos** al contacto de la sección 1.

Plazo de respuesta: [POR COMPLETAR PC-12: plazos legales y propios]. Marco legal aplicable: [POR COMPLETAR PC-08: por definir con el abogado; se asume la normativa colombiana de protección de datos, p. ej. Ley 1581 de 2012, pero está por confirmar].

## 10. Seguridad

- Contraseñas con hash; sesiones que **caducan a las 8 horas** y pueden cerrarse en todos los dispositivos; enlaces de restablecimiento de un solo uso que caducan (30 minutos por defecto).
- Contenido sensible cifrado a nivel de aplicación; archivos en almacenamiento privado con enlaces firmados de corta duración.
- Límites de intentos de ingreso y bloqueo temporal; cada acceso de un profesional o administrador verifica el rol y la pertenencia de los datos **en el servidor**.
- Ningún sistema es infalible: avísanos de cualquier incidente que notes (contacto de la sección 1).

## 11. Personas menores de edad

El servicio está pensado para personas adultas en reconversión profesional. Edad mínima para crear una cuenta: [POR COMPLETAR PC-07: edad mínima; revisión legal].

## 12. Cambios a este aviso

Si cambiamos este aviso de fondo, te lo diremos y te pediremos aceptar la nueva versión. Registramos la versión que aceptaste y la fecha.
