# ES-409 (dentro de ES-408) · Registro e invitación con la declaración de mayoría de edad

[UX/UI-Claude] Prototipo: [`elevation-es408.html`](elevation-es408.html) → «Registro (18+)» e «Invitación». **Para Dev:** esta maqueta **no cambia** el diseño ya aprobado (ES-409, comentarios 13026 y 13027): mismos textos ES/EN, misma colocación y mismo contrato. Si algo de aquí difiriera de 13026, manda 13026.

## Pantallas y orden
Registro (`LoginPage`, pestaña «Crear cuenta»): nombre → correo → contraseña y requisitos (sin cambios) → **casilla 18+** → casilla de aviso y términos → nota de pago → botón.
Invitación (`/accept-invitation`, todos los roles): nombre → contraseña y requisitos → **casilla 18+** → términos → botón.

## Casilla (patrón `TermsCheck`: `ac-check`, `ac-check__row`, `ac-error`)
Sin premarcar e independiente de la de términos. La ayuda va enlazada con `aria-describedby`; con error, además `aria-invalid` y mensaje `role="alert"`. Textos: ver `TEXTOS.md` (`access.adult_*`, `access.err_adult*`; el nombre final de las claves lo fija Dev).

## Estados
| Estado | Qué se ve |
|---|---|
| Vacío | ambas casillas sin marcar |
| Sin la casilla 18+ | error bajo la casilla, foco en ella, datos escritos conservados |
| Todo vacío | un error por campo; foco en el primero (nombre → correo → contraseña → edad → términos) |
| Rechazo del servidor (`adult_version_mismatch`) | «La declaración de edad cambió. Recarga la página y vuelve a marcarla.» en la casilla. Los demás códigos (`adult_required`, `adult_not_declared`, `adult_version_invalid`) usan el error de la casilla |
| Enviando | casillas, campos y botón deshabilitados; texto de hoy |
| Éxito | como hoy |
| Enlace de invitación inválido | como hoy (sin cambios); el rechazo por edad **no** consume el enlace |

## Cuentas que ya existen
No ven nada nuevo: no hay pantalla, aviso ni bloqueo (ES-409, opción A); su declaración queda vacía, sin inventarla. Condición de salida al piloto (13025/13027): desplegar antes de invitar y volver a crear cualquier cuenta de participante anterior. Sin camino alterno para menores: no se crea la cuenta.

**Propuesta adicional, no incluida en 13026 (confirmar con Infra):** etiquetas de los campos nuevos en la copia de «Mis datos» (lo pide el caso S10 del plan de QA): `export.adult_version`, `export.adult_date`, `export.adult_none`.

## Comprobado en la maqueta (Chromium)
224 escenas (1440/1024/390/320 × ES/EN × claro/oscuro × 2 pantallas × 7 estados), 0 fallos; axe WCAG 2.x A/AA en 112: 0 violaciones; sin premarcar, una casilla no marca la otra, Enter envía y enfoca la edad, Tab va de contraseña a edad y a términos, Espacio y clic en la etiqueta marcan.

**No verificado:** Safari/iOS, Firefox, lector de pantalla, móvil real; no reproduce el contrato del servidor. Es una autodeclaración, no verifica edad. Validez legal: abogado. Inglés pendiente de revisión de Alejo.
