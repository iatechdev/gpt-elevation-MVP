# Política de cookies y almacenamiento del navegador

> **BORRADOR SIN REVISIÓN LEGAL** · versión de trabajo `2026-11-v2` · ES-335 · 18-nov-2026.
> Contrastado con el código del frontend (ver `../VERIFICACION-CONTRA-CODIGO.md`). Marcadores: `[POR COMPLETAR PC-nn]` y `[VERIFICAR VF-nn]`; lista en `../POR-COMPLETAR.md`.

## Resumen
- **Elevation no instala cookies propias** (el código no escribe ni lee `document.cookie`). [VERIFICAR VF-09: comprobar en el navegador de un entorno desplegado, con la pestaña de almacenamiento, que ninguna cookie aparece; incluida la que podría poner el proveedor de alojamiento.]
- Guardamos unos pocos datos **en el almacenamiento del navegador** (localStorage y sessionStorage), solo los necesarios para que la aplicación funcione y para recordar tus preferencias. No usamos analítica, publicidad ni seguimiento de terceros. [VERIFICAR VF-10: no se encontró ninguna herramienta de analítica ni de publicidad en el código; confirmar en el entorno desplegado.]
- Como todo es estrictamente necesario o es una preferencia que tú eliges, **no pedimos un banner de cookies** en esta versión. [REVISAR LEGAL RL-03: confirmar si el marco aplicable exige aviso o consentimiento para el almacenamiento local de preferencias.]

## Qué guardamos en tu navegador

| Clave | Dónde | Para qué | Cuánto dura |
| --- | --- | --- | --- |
| `elevation_token` | localStorage | Mantener tu sesión iniciada. | Hasta cerrar sesión, o hasta que el servidor la invalide (caduca a las 8 horas). |
| `elevation_role`, `elevation_name` | localStorage | Mostrar tu nombre y rol en la interfaz. **No deciden tu acceso**: el servidor verifica tu rol en cada petición. | Hasta cerrar sesión. |
| `elv_lang` | localStorage | Recordar tu idioma (ES/EN). | Hasta que lo borres. |
| `elv_theme` | localStorage | Recordar tu tema visual (claro, oscuro o del sistema). | Hasta que lo borres. |
| `elevation_chat_enter_sends` | localStorage | Recordar si la tecla Enter envía el mensaje. | Hasta que lo borres. |
| `elevation_checkin_date` | localStorage | Recordar si ya hiciste tu registro de ánimo del día. | Hasta cerrar sesión. |
| `elevation_pending_chat` | sessionStorage | Conservar un mensaje del chat sin confirmar si recargas la pestaña. | Hasta cerrar la pestaña o la sesión. |
| `elevation_space_paused` | sessionStorage | Recordar que pausaste la conversación. | Hasta cerrar la pestaña. |
| `elevation_return_to` | sessionStorage | Volver a la pantalla que querías abrir después de iniciar sesión (solo una ruta interna de la aplicación). | 30 minutos como máximo; se borra al llegar o al cerrar sesión. |

Nada de esto contiene el texto de tu diario, de tus conversaciones ya enviadas ni tus datos de contexto. Los formularios públicos (por ejemplo, la solicitud de profesionales) no guardan nada en el navegador.

## Recursos de terceros
- Las tipografías de la aplicación se sirven desde nuestro propio sitio.
- Una página estática antigua (`/privacy`) carga tipografías desde un servicio de terceros (Google Fonts), lo que envía tu dirección IP a ese tercero. [VERIFICAR VF-11: decidir con Mauricio si esa página se retira o se sirve con tipografías propias; además su contenido es del producto anterior y contradice este aviso — ver `../PREGUNTAS-ABOGADO.md`.]

## Cómo borrarlo
Cerrar sesión borra tu sesión y lo asociado a ella. Puedes borrar el resto desde la configuración de tu navegador (datos del sitio).
