# ES-148 · Cartografía v2 (dirección B desarrollada)

*[UX-Claude] · 5-nov-2026. Borrador sin aprobar. Un solo archivo HTML (`index.html`), ES y EN, claro y oscuro. Voz definida en [VOZ-ELEVATION.md](../VOZ-ELEVATION.md).*

## Pantallas (selector arriba o hash: `#portada`, `#registro`, `#entrar`, `#recuperar`, `#inicio`, `#evidencias`, `#chat`, `#planes`, `#estados`)

| Pantalla | Qué resuelve de la auditoría |
|---|---|
| Portada | Gancho y mecánica: el relieve es el nivel. Prueba con una escena de ejemplo. |
| Crear cuenta | Consentimiento y privacidad al registrarse (H-35); entra directo al mapa, sin segundo inicio de sesión (H-38). *Propuesta nueva.* |
| Entrar / Recuperar acceso | «¿Olvidaste tu contraseña?» con respuesta neutra que no revela si el correo existe (BUG-003). |
| Mapa | Capacidades como lugares; detalle en panel junto al mapa (H-45); nivel solo con evidencia; sin «Validado» (H-41); «Sin evaluar» sin déficit (H-46). |
| Evidencias | Aviso tras guardar el borrador y acción visible «Revisar y confirmar» (H-42); sin versiones a la vista (H-44). |
| Conversación | Pista con su frase de respaldo; error de límite o de conexión que conserva el texto y ofrece reintentar y copiar (BUG-001, BUG-004); el borrador sobrevive a la navegación. Simulable desde el selector «Chat». |
| Mi plan | Pantalla de revisión antes de enviar y «Cancelar solicitud» (H-43, H-37). *La cancelación y el pago necesitan decisión de producto.* |
| Estados | Límite de uso, sin conexión, mapa vacío, cargando. |

## Verificación (Chromium, escritorio 1360 y móvil 390, ES y EN)

- Sin desborde horizontal ni errores de consola en las 9 pantallas.
- axe-core (WCAG 2 A/AA), grave y crítico, en claro y oscuro: 0 hallazgos.
- Flujos de punta a punta comprobados: consentimiento obligatorio, cuenta creada, recuperación neutra, nivel registrado desde una pista, borrador → revisar → confirmar, error de chat y reintento con el texto conservado, solicitud de plan → revisión → envío → cancelar.

## No verificado

- Los textos EN son borrador mío; faltan revisión humana y prueba con personas del piloto.
- Tipografías de Google Fonts: falta confirmar licencias para el producto.
- Lectores de pantalla reales, otros navegadores y conexión lenta.
- Los planes son de ejemplo: nombres y condiciones reales salen del catálogo de staging.
- El script de verificación vive en la sesión (no está integrado a `e2e/`).
