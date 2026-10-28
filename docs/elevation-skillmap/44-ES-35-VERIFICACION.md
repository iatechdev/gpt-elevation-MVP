# ES-35 — Verificación del tramo preliminar

[Dev-Codex] · 28-oct-2026 · Base main 6dc61e93542776147693e87b6e95c9c4c0b47d22.
Diseño: [43-ES-35-DISENO-Y-PLAN.md](43-ES-35-DISENO-Y-PLAN.md), Jira 10273; aprobación humana explícita registrada en 10274.

## Alcance entregado

Consola React/TypeScript ES/EN con seis alias ficticios, invitación/avance/incidencias profesionales sintéticos, materiales seleccionados y versión, vista previa exacta y confirmación de revisión, historial con autor/fecha de simulación, objeción del titular sintético A y respuesta del facilitador sintético. No se modifica la revisión original al objetar/responder. Materiales retirados o IDs ajenos dentro de la simulación no abren el formulario.

No se implementaron endpoints, adaptadores JSON de producción, modelos, migraciones ni cambios del núcleo de Mauricio. Los modelos del fixture son modelos de vista de prueba: **no representan un contrato de API real**. Ninguna revisión es validación humana real ni escribe SkillAssessment.

La consola no tiene agregados, gráficos, porcentajes o filtros por idioma/mercado/combinaciones personales. Las filas sintéticas no representan datos de las seis personas reales. No aparecen conversaciones, diario, ánimo, autoevaluaciones/puntuaciones privadas ni indicadores de crisis.

## Activación y reproducción

Desde frontend:

```powershell
$env:VITE_ENABLE_FACILITATION_PREVIEW='true'
npm run dev -- --host 127.0.0.1
```

Usar una sesión local de prueba. No utilizar credenciales, tokens ni datos de personas reales. El guard preexistente ProtectedRoute solo comprueba presencia de elevation_token en localStorage: **esto no demuestra autorización ni propiedad reales**. El preview no consulta identidad ni API; solo genera alias A–F y materiales profesionales ficticios. No hay permiso de admin/terapeuta reutilizado como autorización. Toda la integración deberá reemplazar el preview por contratos canónicos y pruebas reales.

Rutas:
- /facilitation
- /facilitation/participants/synthetic-A
- /facilitation/participants/synthetic-A/reviews/new?shareId=synthetic-share-A
- /app/professional-reviews (titular ficticio A, indicado en pantalla)

No se añaden entradas en los menús de admin, terapeuta, board, dashboard o chat. La vista se prueba con URL directa. Sin flag, o con un valor distinto de la cadena exacta true, muestra no habilitada y no monta datos ni formularios. Cambiar el flag exige recompilar/reiniciar Vite.

VITE_FACILITATION_FIXTURE_SCENARIO acepta normal, empty, load-error, save-error, lost-ack, conflict o revoked. Solo gobierna datos de prueba en RAM. No hay cambio automático desde una API fallida a fixtures; no existe un transporte real.

En cualquier recorrido: seleccionar material A, examinar evidencia, escribir observación/límites, vista previa, confirmar; abrir Mis revisiones profesionales, objetar; volver a Persona A y responder. El lenguaje de autoría queda fijado al comenzar el texto; cambiar idioma de interfaz no lo traduce. Campos largos preservan saltos de línea. Cancelar no registra datos.

La invitación solo registra una solicitud sintética: no envía correo ni crea cuenta. Las incidencias no reejecutan IA/trabajos: únicamente permiten actualizar la vista simulada.

Recargar o cambiar elevation_token descarta la simulación. Solo permanece la preferencia de idioma preexistente del producto, no texto nuevo ni materiales en local/sessionStorage o IndexedDB. El estado está separado por instancia de sesión; no hay singleton compartido entre cuentas.

## Resultados locales

| Comando / verificación | Resultado |
| --- | --- |
| npm ci | exit 0; sin cambios en dependencias ni lockfile |
| npm run lint | exit 0; 0 errores / 0 advertencias |
| npm test (Node 24.14.0) | 37/37: 22 existentes + 15 nuevas |
| Node 22, --test test/facilitation-preview.test.mjs | 15/15 |
| npx tsc -b | exit 0 |
| npm run build (incluye tsc -b) | exit 0; advertencia de chunk JS >500 kB |
| npm audit --audit-level=high | exit 0; found 0 vulnerabilities |
| node --check scripts/es35-browser.cjs | exit 0 |
| git diff --check | exit 0 |
| Chromium compilado | 12 grupos PASS, 8 compilaciones, 0 escrituras API y 0 excepciones de página |

La consulta inicial de npm audit sin red falló con ENOTFOUND; se repitió con acceso de red y devolvió cero vulnerabilidades. Chromium inicial dentro del sandbox no encontró su ejecutable en el perfil aislado; se usó la instalación local existente con ejecución autorizada. Estos intentos fallidos no se cuentan como pruebas aprobadas.

La suite de Chromium se ejecuta con Playwright disponible fuera del repo; no añade dependencia:

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/Usuario/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:ES35_BASELINE_DIST='C:/Users/Usuario/.codex/visualizations/2026/10/21/01a16033-4db6-7631-9aa0-3a1a78dc5b61/es33-experimento-plan/frontend/dist'
node scripts/es35-browser.cjs
```

Ajustar PLAYWRIGHT_MODULE a una instalación disponible de Playwright con Chromium. ES35_BASELINE_DIST es opcional, aquí apuntó a un build limpio propio de main 6dc61e9; sin él se omite únicamente esa comparación adicional con main. El arnés compila directorios validados dentro de frontend/node_modules/.es35-build-*, sirve HTTP solo en 127.0.0.1 y cierra navegador/contextos/servidores en finally. Las API GET del dashboard están interceptadas con respuestas sintéticas. Toda escritura /api se aborta y hace fallar la suite.

Grupos reales:
1. Recorrido ES completo revisión -> objeción -> respuesta; revisión original inalterada; recarga elimina historia.
2. EN; cambio de idioma conserva borrador/idioma de autoría; primer Tab enfoca salto; controles >=44px, checkbox22px y textarea>=16px; anchos320/375/768/1440 sin overflow; oscuro y reduced-motion; zoom CSS200% sobre viewport768.
3. Enlace/Back bloqueados con borrador; diálogo contiene el foco, Escape cancela y restaura enlace; cambio de token limpia campos.
4. Invitación simulada; material retirado y share de otra persona no abren revisión.
5. save-error: sin falso guardado, reintento de solicitud exacta sin duplicados.
6. lost-ack: estado publicado permanece sin revisión hasta recuperar con la misma solicitud; una sola revisión.
7. conflict: confirmación bloqueada, cancelar/recargar trae versión2; revisión nueva sobre versión actual.
8. empty: cero personas y controles de revisión.
9. load-error: mensaje de error, sin datos anteriores; reintento recupera lista.
10. revoked: acceso cerrado, sin controles de materiales.
11. disabled: URL directa sin datos/formularios.
12. Sin sesión se redirige al login; dashboard con flag ON/OFF y baseline main tiene el mismo texto y widgets. Se capturaron ambas vistas y baseline. No se afirma comparación pixel-perfect.

La prueba de zoom usa CSS zoom y no sustituye un móvil físico o zoom de navegador manual. Las verificaciones de teclado cubren foco/skip/diálogo/Escape/Back, no sustituyen lector de pantalla ni una auditoría completa WCAG.

## Correcciones detectadas durante las pruebas

- El label del textarea contenía también la ayuda de longitud: aria-label explícito y error asociado por ID único.
- Los formularios registran borrador por instancia para que desmontar uno no borre el guard de otro; controles incompatibles se deshabilitan.
- La revisión perdió inicialmente el idioma de autoría al cambiar interfaz antes de confirmar: ahora se conserva el idioma al empezar texto y se verifica en navegador.
- El diálogo nativo permitía Tab hacia controles del navegador y no restauraba el foco porque React enfocaba antes de showModal. Se añadió ciclo explícito y se captura/restaura el foco del enlace al cancelar. Las dos corridas que detectaron estos fallos no se presentan como verdes; la corrida final completa sí pasó.
- Las fechas/autor proceden del fixture, nunca de campos editables; confirmación perdida conserva cuerpo/requestId/revisión exactos y no publica éxito anticipado.
- Las validaciones de texto se presentan mediante claves ES/EN y aria-invalid, sin depender del mensaje de validación nativo del navegador.

## Evidencia visual y contraste

Capturas locales ignoradas en frontend/node_modules/.es35-artifacts/: roster-es.png, review-recorded.png, objection.png, response.png, review-en.png, mobile-dark.png, zoom-200.png, dashboard-baseline.png, dashboard-disabled.png y dashboard-enabled.png. Se inspeccionaron visualmente lista ES, móvil oscuro e historial de respuesta; las imágenes no contienen personas reales. No se versionan builds, capturas ni node_modules.

Paleta local del DS: papel cálido, Playfair400 e Inter16, oliva #4A6741 para controles/texto, foco3px y grilla de4px. Test numérico de luminancia sRGB/WCAG comprueba texto>=4,5:1 y controles>=3:1 para pares de temas claro/oscuro. Tema local por prefers-color-scheme; no cambia la landing.

La advertencia de bundle JS >500 kB sigue visible; no se relaja configuración ni se oculta. El baseline ya supera500 kB y la UI agrega código/CSS incluso sin habilitar la vista. El tamaño no se presenta como optimizado ni como cumplimiento de presupuesto de rendimiento. CI y métricas finales se registran en el PR.

## Seguridad y privacidad / pendientes

Estas pruebas ejercitan un modelo de vista sintético y el navegador; NO prueban JWT, permisos de servidor, asignación, consentimiento/revocación real, acceso con IDs ajenos reales, exportación/borrado, retención de autoría o transacciones Postgres.

La integración necesita los ocho contratos del apartado8 del diseño (asignación, destinatario/material/versiones, consentimiento, lectores operativos mínimos, revisión/objeción/retención, registro declarativo CORE, invitaciones y ES-33). No se crea rol, helper de autorización, tabla de asignación, migración, permiso global o token alternativo. No se mezcla therapistId con facilitación ni se escribe pista review de SkillAssessment.

Sin backend nuevo no se ejecutaron tests locales de migraciones o PG para ES-35. El CI existente podrá verificar los módulos del backend que ya estaban en main; eso no verifica contratos inexistentes de ES-35. Pendientes integración real, revisión profesional humana, invitaciones reales, acceso del piloto, Safari/Firefox, móvil físico, lector de pantalla, staging y producción. No se despliega ni fusiona este PR y no se resuelven hilos de QA. Terminar el tramo preliminar no cierra la historia integrada.

