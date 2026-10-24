# Operación de Railway y registro de releases

22-oct-2026. Topología y secuencia aprobadas en V-18/V-19; ejecución pendiente.

## Destino

Proyecto elevation, staging y production. Servicio app por entorno: Express/API y frontend estático. Para el incremento 1: worker y Redis separados entre entornos. Postgres en Supabase; QA nunca conecta a producción y usa secretos propios. Rama o proyecto Supabase para QA y presupuesto operativo por definir/verificar. Worker/Redis no se añaden al objetivo del corte 1 por inferencia.

Mauricio configura secretos y permisos directamente. Los agentes documentan nombres y propósitos, sin valores. Revisar los nombres contra el código efectivo: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY, PROMPT_ENCRYPTION_KEY y los que exijan las funcionalidades habilitadas. No se activan integraciones clínicas o de terceros por aparecer en el legado. El uso de pooler, TLS, credenciales del worker, migraciones y prohibición de sync alter en producción requiere diseño y validación real.

## Transición aprobada

1. Preparar Railway y QA aislado; validar staging.
2. Introducir/verificar el check de CI requerido antes de retirar checks anteriores. La configuración real de protección se comprueba; no se deduce de un comentario.
3. Antes de los merges, pausar deploys de producción de Vercel, conservando su conexión. Verificar que el mecanismo elegido funciona.
4. Corregir Altos/Críticos y obtener evidencia/aceptación QA antes del merge. Mauricio realiza merges y cambios de publicación conforme a las puertas del ticket.
5. Cambiar dominio únicamente con humo correcto, QA aprobado y URL pública de privacidad preservada. Staging usa su propia URL; comparar ruta/contenido y validar la URL pública final durante el corte.
6. Mantener 48 horas de estabilidad y revisar integraciones antes de desconectar Vercel.

Vercel conserva respaldo de privacidad; no es respaldo funcional de la aplicación. Preparar reversión de aplicación/base y tratamiento de escrituras antes del cambio: no prometer que revertir DNS revierte datos ni ejecutar down-migrations sin procedimiento probado.

## Registro de release (plantilla, sin despliegues acreditados)

| Campo | Valor requerido |
| --- | --- |
| Release / entorno / fecha | Pendiente de despliegue verificado. |
| Commit y PR | SHA exacto y enlace al PR. |
| Aprobación | Referencia de aceptación QA y ejecutor del merge/cambio. |
| Migraciones y config | Versiones y nombres de cambios; sin secretos. |
| Evidencia | Salud, humo, privacidad, permisos y recuperación; límites de pruebas. |
| Reversión | Procedimiento y responsable, incluyendo datos. |

El objetivo condicionado del corte 1 es 27-oct-2026 12:00 America/Bogota. No se afirma un release existente ni se trasladan incidentes históricos de proveedores como estado actual.
