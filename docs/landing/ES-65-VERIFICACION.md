# ES-65 — Cierre, pie y borrador de privacidad

28-oct-2026 · [Dev-Codex] · Rama `ES-65-cierre-pie`.
Base inicial `6f01a92`; integración de main hasta `13a0f9f` (incluye ES-74, ES-70 y ES-90).

## Aprobaciones y alcance

- Diseño fase 2: ES-60/10279 y ES-65/10287. Plan, wireframe, textos, estados y objeción: ES-65/10339.
- Fuente visual: Figma, 84 frames revisados en ES-68/10304; en esta HU se volvió a observar S15 escritorio ES, móvil ES y escritorio EN (49–51). La recarga del frame 52 no permitió una nueva captura estable; su revisión previa consta en 10304.
- Fuente textual: `origin/docs/landing-diseno-fase2:docs/landing/TEXTOS-LANDING-FASE2-ES-EN.md`. Se omite «El siguiente paso es tuyo / The next step is yours» del diseño porque no está en la fuente de textos.
- S15 usa daisyUI con prefijo elv-, tokens ES-61, Inter/mono, filetes y ocre decorativo. CTA real `/login?mode=register`; el flujo de ES-74 ya existe en la base integrada. No se toca identidad ni zonas privadas.
- Footer semántico fuera del main, aviso no clínico completo ES/EN y año dinámico. Se elimina el fetch antiguo que solo alimentaba los textos sustituidos; queda el lector/fallback ES-66 existente.
- ES-90 retiró marcadores internos de la landing. Resolución registrada antes del ajuste en ES-65/10396: se ocultan enlaces de privacidad/términos/contacto mientras D-08 esté pendiente, usando la alternativa aprobada en DISENO-FASE2 §6. No hay enlaces falsos, texto nuevo no aprobado ni cambios en el panel de administración.
- CTA profesional oculto mientras no esté definido su flujo. No se inventan contactos, precios, certificaciones, analítica ni cookies.

## Privacidad: entregado y pendiente

Se preservan `frontend/public/privacy/index.html` y el rewrite público de `/privacy`, sin editar su contenido. El archivo anterior sigue describiendo un GPT de OpenAI; no se presenta como una política actualizada. El criterio de enlace aprobado y comprobado en despliegue sigue **pendiente**, no cubierto por este PR.

Alejo solicitó crear y adjuntar un documento nuevo. Borrador ES/EN v0.1 adjunto en ES-65 (adjunto 10004), recepción en 10341. Al integrar main se actualizó la descripción de rutas, experimentos y planes; versión vigente de revisión: **ES-65-POLITICA-PRIVACIDAD-BORRADOR-v0.2-ES-EN.md**, adjunto **10006**. No sustituye aún `/privacy`.

La propuesta separa datos/finalidades, espacios privados/profesionales, proveedores, almacenamiento local, seguridad, exportación y borrado. Responsable legal, contacto público, jurisdicción/bases, contratos/regiones, retención/backups y revisión especializada/EN permanecen explícitamente pendientes. Referencias oficiales de Anthropic y Google Cloud incluidas en el documento; no acreditan contratos ni configuración de la cuenta de Elevation. Autorizar redactar el borrador no equivale a aprobar su publicación.

## Pruebas ejecutadas

| Capa/comando | Resultado real final |
| --- | --- |
| npm ci frontend/backend | exit 0, 192/292 paquetes |
| Frontend npm run lint | exit 0, sin errores ni advertencias |
| Frontend npm test, Node 24 | 97/97, 0 fallos/omitidas, tras integrar main |
| Frontend node --test test/*.test.mjs, Node 22 | 97/97, 0 fallos/omitidas, tras integrar main |
| tsc -b, mediante build y ejecución explícita anterior | exit 0 |
| Frontend npm run build | exit 0; 131 módulos; JS 689,68 kB (gzip 182,72); CSS 94,00 kB (gzip 14,76) |
| Backend npm test | 335/335, 0 fallos/omitidas, tras integrar main |
| Frontend npm audit --json | exit 0, 0 vulnerabilidades |
| Backend npm audit --json | exit 1, 6 moderadas, 0 altas/críticas; dependencias sin cambios en esta HU |
| git diff --check | exit 0 |

Antes de integrar main: 43/43 frontend y 257/257 backend. Se detectó un fallo en la aserción antigua de ES-62 que buscaba el tag footer literal dentro de LandingPage; se actualizó para la extracción del componente, conservando la comprobación de que está después de main. Render SSR real y navegador comprueban el footer resultante. No se silenciaron reglas.

El test nuevo de frontend compila y renderiza los componentes TSX reales con React/MemoryRouter: seis claves ES/EN, CTA fijo, escape HTML, overrides completos y fallback ante error/vacío. El test backend usa servidor Express/HTTP/JWT reales y **persistencia/proveedores simulados**: todas las claves se guardan solo como superadmin; anónimo, participante, terapeuta, board y admin no pueden editarlas. No se ejecutó PostgreSQL real en ES-65; no hay endpoints, modelos ni migraciones nuevos.

## Verificación visual local

- Navegador sobre build real y servidor de fixtures local; no se usaron producción, personas reales ni credenciales reales.
- ES/EN, anchos 320/375/390/768/1024/1440, sin desbordamiento horizontal. Se repitieron las doce combinaciones después de integrar main; el footer final no contiene enlaces ni marcadores internos.
- CTA de 48,39 px, Tab/Shift+Tab con contorno ocre de 3 px y activación con Enter hasta el formulario real de registro de ES-74 (campo nombre visible). No se efectuó un registro real contra el servidor de fixtures.
- Claro y oscuro: título, aviso y CTA legibles. Preferencia oscura simulada solo por el arnés; usa el tema real. Contraste calculado: texto secundario claro 5,12:1; oscuro 7,59:1; CTA claro 16,69:1 y oscuro 16,18:1. Tests existentes comprueban contraste de ambos temas y foco.
- CMS 503, vacío, texto editado, JSON malformado, palabra extensa y HTML: se mantiene fallback bilingüe o se muestra texto escapado, sin inyección ni overflow. Los escenarios son fixtures, no una prueba de persistencia en producción.
- Artefacto de privacidad conservado por build: SHA256 de public y dist idéntico `b7a0c3ffa9ca5329489c1bbc2cb1f57af2c6ef2507e793af5871ce8062404b4c`. GET `/privacy` del arnés: 200 y contenido idéntico; el arnés tiene mapeo explícito, **no demuestra el routing de Railway/Vercel**.

## Pendientes de aceptación integral

1. Resolver D-08 con datos legales, revisión de la política, aprobación y publicación conservando `/privacy`; habilitar y comprobar el enlace real. No se considera cumplido ese criterio.
2. QA y Mauricio revisan el PR; Dev no fusiona ni cierra hilos de QA. PR draft hasta resolver la objeción de privacidad.
3. Sin verificación de despliegue, lector de pantalla, zoom nativo al 200 %, revisión nativa EN ni evaluación jurídica final. Sin nuevas animaciones; se conserva la política de movimiento reducido existente.
4. Vite mantiene la advertencia de chunk >500 kB; audit backend no está en verde. No se ocultan esos resultados ni se amplía el alcance a actualizar dependencias.
