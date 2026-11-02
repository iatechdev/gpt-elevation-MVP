# ES-127: estados administrativos ES/EN

Corrección de textos, sin cambios de disposición, flujo, permisos ni API; exenta de la puerta de diseño.

## Reproducción local segura

Desde `frontend/`, ejecutar `node test/support/es127-preview.mjs`. Abrir:

`http://127.0.0.1:43124/__es127/start?role=superadmin&lang=en&mode=actions`

Este servidor intercepta todas las peticiones `/api/`. La identidad, el usuario, la solicitud y el documento son sintéticos. Las escrituras esperan seis segundos y devuelven una respuesta simulada: no hay backend real, persistencia, borrado ni aprobación real. Nunca introducir credenciales reales en esta vista.

## Comprobaciones realizadas en navegador

| Pantalla y acción | Resultado observado en inglés |
| --- | --- |
| `/admin/users`, usuario inactivo | `Inactive` |
| Menú del usuario → desbloquear | Botón deshabilitado `Unlocking...` |
| Eliminar definitivamente; confirmar con `Synthetic QA user` | Botón deshabilitado `Deleting...` |
| Solicitud de plan → aprobar | Botón deshabilitado `Processing...` |
| Solicitud de plan → rechazar; introducir nota sintética y confirmar | Botones deshabilitados `Processing...` |
| `/admin/content`, validación → aprobar y confirmar | Botón deshabilitado `Processing...` |

Para repetir cada caso, reiniciar desde la URL de preparación. Con `lang=es`, los textos esperados son `Inactivo`, `Desbloqueando...`, `Eliminando...` y `Procesando...`. Esta tabla registra las observaciones de inglés; no constituye una verificación integrada del backend ni de todos los estados posibles.

## Validación automática local

- `npm run lint`: salida 0, sin errores ni advertencias.
- `npm test` tras rebase sobre main: 280 pruebas aprobadas; 0 fallidas y 0 omitidas.
- `npm run build`: salida 0, incluye comprobación de tipos. Permanece el aviso de tamaño del bundle y el aviso `PLUGIN_TIMINGS` de Vite.
- `node --check test/support/es127-preview.mjs`: salida 0.
- La prueba SSR existente comprueba estados iniciales de cuatro pantallas ES/EN; los estados de acciones de esta corrección se comprobaron en navegador contra respuestas simuladas, según la tabla.

QA debe repetir contra el nuevo head y el entorno integrado. No se comprobaron base de datos, operaciones reales ni producción.
