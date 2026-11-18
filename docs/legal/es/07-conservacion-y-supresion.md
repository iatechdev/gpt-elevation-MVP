# Política de conservación y supresión de datos

> **BORRADOR SIN REVISIÓN LEGAL** · versión de trabajo `2026-11-v1` · ES-335 · 18-nov-2026.
> Alineada con la purga implementada (contrato 18, ES-274, ES-293; `backend/utils/personalData.js`, `backend/utils/deletionProcessor.js`, `backend/scripts/purgePersonalData.js`). **Los plazos no están decididos**: el sistema no promete un cierre en siete o treinta días y `deadlinesVerified` sigue en `false`. Marcadores: `[POR COMPLETAR PC-nn]` y `[VERIFICAR VF-nn]`; lista en `../POR-COMPLETAR.md`.

## 1. Principio
Conservamos tus datos solo mientras sean necesarios para prestarte el servicio y cumplir obligaciones legales. Puedes pedir su eliminación en cualquier momento.

## 2. Mientras tu cuenta está activa
| Datos | Conservación |
| --- | --- |
| Cuenta, contexto, conversaciones, diario, ánimo, valoraciones, evidencias, mapa de habilidades, hojas de vida, permisos | Mientras la cuenta esté activa [POR COMPLETAR PC-06: plazo máximo de cuentas inactivas, si lo hay]. |
| Sesiones (token de acceso) | Caducan a las **8 horas**. |
| Enlaces de restablecer contraseña | Un solo uso; caducan a los **30 minutos** por defecto. |
| Enlaces de descarga de archivos | Firmados, de corta duración (15 minutos por defecto). |
| Vista previa y archivo de exportación personal | [VERIFICAR VF-16: confirmar con Mauricio cuánto tiempo vive una exportación generada antes de caducar]. |
| Registro de uso de IA (sin contenido) | [POR COMPLETAR PC-15]. |
| Tokens de sesión revocados y bloqueos de seguridad | [POR COMPLETAR PC-15: retención operativa por acordar]. |
| Registros del servidor (logs) | No contienen enlaces, tokens ni destinatarios de correo. Retención del proveedor: [POR COMPLETAR PC-15]. |

## 3. Cuando pides eliminar tu cuenta
1. **Se bloquean al registrarse tu solicitud** las sesiones y la cesión de datos; la cuenta queda inactiva.
2. Se registra tu solicitud y recibes un **recibo**.
3. **La purga de tus datos NO es automática ni inmediata:** hoy es un comando de mantenimiento que ejecuta **manualmente el equipo** (con las integraciones detenidas) después de recibir la solicitud. Plazo para ejecutarla: [POR COMPLETAR PC-13: plazo de ejecución; no se promete inmediatez ni un número de días].
4. **Al ejecutarse la purga se eliminan tus datos de contenido**: conversaciones y turnos, diario, ánimo, valoraciones, recomendaciones, evidencias y sus versiones, contexto y versiones del puente profesional, contexto declarado, hojas de vida y habilidades derivadas, solicitudes de plan, cuestionario de emparejamiento, consumo de IA y permisos con su historial, y las exportaciones generadas.
5. Tu **usuario queda como una «lápida»**: se sustituyen nombre y correo, se sustituye la contraseña, se limpian motivación y asignaciones y se borra la versión y fecha de aceptación de los términos [REVISAR LEGAL RL-05: ver pregunta E301-2 en `../PREGUNTAS-ABOGADO.md`]. Se conserva el identificador interno y una marca de que la cuenta fue eliminada, para impedir su reactivación y mantener la integridad de otros registros.
6. De tu **solicitud como profesional** (si la hiciste) solo conservamos su estado y fechas; eliminamos nombre, correo, licencia, mensaje, perfil y hoja de vida.

**Pasa a la revisión previa y no se purga automáticamente** si la cuenta tiene registros del lado profesional o de administración (notas, sesiones o perfiles que la cuenta escribió como profesional, asignaciones a otros usuarios…).

## 4. Lo que se conserva tras eliminar una persona
Lo que **escribió un profesional sobre ti** como registro propio de su trabajo:
- las notas que el profesional escribió sobre ti;
- las notas en vivo de sus sesiones;
- la fila de agenda de la sesión con la nota del profesional (se limpian en ella los datos tuyos: ánimo posterior, motivo de cancelación, enlaces de reunión y de grabación, identificador de calendario).

**Importante:** el texto libre de esas notas puede contener datos que te identifiquen y no se puede depurar automáticamente; **no afirmamos que lo conservado esté anonimizado ni desvinculado de ti.** Plazo y base de esta conservación: [POR COMPLETAR PC-14: decisión de Mauricio sobre la retención de los registros del servicio humano; QA-23-02].

## 5. Copias de seguridad, proveedores y logs
- El borrado en copias de seguridad, cachés, logs y datos en los proveedores (alojamiento, base de datos, almacenamiento, modelo de lenguaje, correo) **depende de cada proveedor y su plazo no está verificado**. [POR COMPLETAR PC-13: plazo efectivo de supresión total y procedimiento al restaurar una copia].
- Si se restaura una copia anterior a tu solicitud, se vuelve a aplicar la purga antes de abrir el acceso. [VERIFICAR VF-17: el registro de solicitudes de borrado independiente del respaldo no está aprovisionado todavía; confirmar con Infra antes del lanzamiento.]

## 6. Cómo ejercer tus derechos
Desde la aplicación (descargar tus datos, retirar permisos, pedir la eliminación) o escribiendo a [POR COMPLETAR PC-04]. [VERIFICAR VF-18: las rutas de exportación y eliminación están detrás de un interruptor (`DATA_RIGHTS_ENABLED`) y se mantienen deshabilitadas hasta aprobar las dependencias operativas; confirmar su estado al lanzamiento.]
Plazo de respuesta: [POR COMPLETAR PC-12].

## 7. Datos agregados
Los resultados agregados del piloto (que no identifican a nadie y solo se muestran con 5 o más personas) pueden conservarse. [REVISAR LEGAL RL-06: confirmar si se consideran datos anonimizados fuera del alcance de la supresión.]
