# Runbook de operador: recuperar una cuenta sin correo (ES-376, ES-386, ES-393)

Mientras Elevation no tenga correo saliente en producción (ES-371 está en pausa), una persona que olvidó su contraseña **no puede recuperarla sola**. Este runbook dice cómo quien opera el servidor le emite un **enlace de restablecimiento de un solo uso** sin pasar por el correo. No cambia la aplicación: es un script (`backend/scripts/issue-link.cjs`) que se ejecuta con acceso al entorno.

> Sin secretos ni enlaces reales en este documento. Los ejemplos usan valores inventados.

## 1. Cuándo usarlo (y cuándo no)
- **Sí:** una persona (rol persona o profesional) pide recuperar su acceso y su cuenta existe y está activa.
- **No:** cuentas de administración, junta o superadmin (el script las rechaza y deja el intento auditado como denegado); cuentas inactivas o con baja pendiente; crear cuentas nuevas (las personas se registran solas en `/register`; los profesionales entran por invitación, que sin correo no se puede entregar).
- **Antes de emitir, confirma que quien pide es quien dice ser**, por un canal independiente del que usó para pedirlo (llamada, mensaje por un contacto ya conocido, en persona). Quien recibe el enlace puede entrar a la cuenta: es el riesgo propio de esta función.

## 2. Quién puede hacerlo
Solo quien tenga acceso a las variables y a la base del entorno (Railway). El script no es una ruta ni una pantalla de la aplicación.

## 3. Identificador de operador (`OPERATOR_ID`)
Es **obligatorio**: sin él no se emite nada. Queda en la auditoría (la ve el superadmin en `GET /api/superadmin/audit`, campo `actorLabel`).
- Usa el **rol o el turno de guardia**, no tu nombre: `ops-guardia-1`, `soporte-n1`, `oncall-2`, `infra-a`.
- Debe empezar por un prefijo de rol (`ops`, `guardia`, `oncall`, `soporte`, `infra`), tener hasta 32 caracteres y solo letras, números, punto, guion y guion bajo.
- **Nunca** un nombre propio (`juan.perez`), un correo, un teléfono ni un secreto. El código rechaza lo que tiene forma de clave o token (`sk-…`, `ghp_…`, `AKIA…`, `eyJ…`, «token», «secret», cadenas largas de alta entropía) y lo que no empieza por un prefijo de rol, **pero no puede saber si `ops-juan` lleva el nombre de alguien**: eso depende de ti.
- El valor es **autodeclarado**: da trazabilidad (qué turno), no identidad. La identidad de quien opera sale del acceso a Railway.

## 4. Variables que necesita el script
| Variable | Para qué | Notas |
|---|---|---|
| `ALLOW_OPERATOR_LINK=true` | Puerta explícita | No se define por defecto en ningún entorno: se pone solo para esta ejecución |
| `OPERATOR_ID` | Quién opera | Ver sección 3 |
| `APP_BASE_URL` (o `FRONTEND_URL`) | Base del enlace | Debe ser `https` (o localhost en desarrollo) |
| `DATABASE_URL` (y `DB_SSL`) | La base | Ya están en el entorno de Railway |
| `OPERATOR_LINK_TTL_MINUTES` | Vigencia del enlace | Opcional: 5–60, por defecto 15 |
| `OPERATOR_LINK_PER_ACCOUNT_HOUR` | Tope por cuenta y hora | Opcional: 1–10, por defecto 3; cuenta solo los enlaces emitidos por el operador |

## 5. Pasos
1. Elige el **entorno** (staging o production). En staging se prueba el procedimiento; **en producción no se prueba con cuentas reales** que no hayan pedido el enlace.
2. Abre una **terminal propia** (el script se niega si la salida no es una terminal, para que el enlace no acabe en un archivo, un log o un CI).
3. Ejecuta el script con las variables **solo para ese comando**, desde la raíz del repositorio:
   ```powershell
   railway run --environment staging --service backend node backend/scripts/issue-link.cjs --email persona@dominio.co
   ```
   con `ALLOW_OPERATOR_LINK=true` y `OPERATOR_ID=ops-guardia-1` definidos en tu sesión de terminal (no en el repositorio, ni en un archivo `.env` versionado). `railway ssh` dentro del contenedor también sirve si ofrece terminal interactiva.
4. El script imprime **una sola línea**: el enlace (`https://…/reset-password#token=…`). Por la salida de errores añade el aviso de vencimiento. Si algo falla, dice por qué **sin imprimir nada más** (ver sección 7).
5. **Entrega el enlace a la persona por un canal privado y directo** (mensaje directo, llamada) y pídele que lo abra y elija su contraseña de inmediato.
6. **Cierra la terminal o límpiala** (`Clear-Host`) para que el enlace no quede a la vista ni en el historial visible.

## 6. Reglas del enlace
- **Un solo uso.** Cuando la persona elige su contraseña, el enlace deja de servir; también deja de servir cualquier enlace anterior de esa cuenta (el último enlace emitido invalida al anterior).
- **Vence pronto** (15 minutos por defecto). Si venció, se emite otro.
- **Tope por hora:** hasta 3 por cuenta (configurable). Es una cuota propia del operador: las solicitudes anónimas de la ruta pública no la agotan.
- Al elegir contraseña se cierran las sesiones abiertas de esa cuenta.

## 7. Si falla
| El script dice… | Significa | Qué hacer |
|---|---|---|
| «Se niega: define ALLOW_OPERATOR_LINK=true…» | Falta la puerta explícita | Definirla para este comando |
| «Se niega: define OPERATOR_ID…» | Falta o es inválido el identificador | Usar un rol/turno válido (sección 3) |
| «Se niega: define APP_BASE_URL…» | Falta la base https | Revisar la variable del entorno |
| «la salida no es una terminal» | La salida iba a un archivo o tubería | Ejecutarlo en una terminal; `--stdout-ok` solo si sabes dónde acaba la salida |
| «la cuenta no existe» | Correo mal escrito o sin cuenta | Verificar el correo con la persona |
| «solo se permite para personas y profesionales» | Rol no permitido | No insistir: queda auditado; lo atiende quien administra por otra vía |
| «la cuenta no está activa» / «baja pendiente» | Cuenta desactivada o con eliminación solicitada | Lo resuelve administración, no este script |
| «ya se alcanzó el tope de enlaces…» | Se emitieron los permitidos esta hora | Esperar a que pase la hora; revisar por qué se piden tantos |
| «No se pudo emitir el enlace» | Error interno (p. ej. la migración de ES-386 aún no aplicada) | No se emitió nada; avisar a Infra |

## 8. Qué NO registrar
- **No pegues el enlace ni el token** en un chat, un ticket de Jira, un PR, un correo, una captura ni un log. Se lo das a la persona por un canal privado y se descarta.
- No pongas el correo de la persona en un ticket junto con el hecho de que se le emitió un enlace; usa «cuenta de una persona del piloto» y el identificador numérico si hace falta.
- No guardes el comando con el correo en notas compartidas. El historial de tu terminal puede conservar el correo (argumento `--email`): límpialo si el equipo lo exige.

## 9. Auditoría
Cada emisión deja una entrada `user.operator_link` en `AdminAuditEntries` con: quién (`actorRole = operator`, `actorLabel = tu OPERATOR_ID`), a quién (id de la cuenta), cuándo y el resultado (`ok` o `denied`). **No** guarda el token, el enlace ni el correo. El superadmin la consulta en `GET /api/superadmin/audit`.

## 10. No verificado / límites
- Los comandos de Railway (`railway run`, `railway ssh`) siguen la forma que ya usa `docs/DESPLIEGUE-RAILWAY.md` para staging; **no se probó este procedimiento contra Railway real**. La primera ejecución debe hacerse en staging con una cuenta sintética.
- `OPERATOR_ID` es autodeclarado y no puede detectar un nombre propio dentro de una etiqueta con prefijo de rol.
- Un enlace emitido consume parte de la cuota de la ruta pública para esa cuenta (comparten la tabla de enlaces): tras 3 enlaces del operador, la persona no puede pedir uno propio durante una hora.
- Este camino no crea cuentas ni entrega invitaciones: sin correo, los profesionales y la administración se dan de alta cuando exista correo saliente (ES-371).
