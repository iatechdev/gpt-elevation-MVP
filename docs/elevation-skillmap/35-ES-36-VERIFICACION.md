# ES-36 — Interfaz contra fixtures y recomendación de contrato

[Dev-Codex]

28-oct-2026. Base main 6dc61e9; rama propia `ES-36-utilidad-piloto`. Diseño/plan en Jira 10246. Aprobación recibida: «Aprobar diseño e interfaz contra fixtures»; para los contratos se solicitó «El contrato que me recomiendes».

**Tramo entregado: interfaz de revisión. No es la HU integrada, no hay guardado real ni autorización para recoger datos del piloto.** El contrato recomendado está en `34-ES-36-CONTRATO-RECOMENDADO.md`, pendiente de revisión técnica de Mauricio para el núcleo de consentimiento/identidad/derechos. No se reemplazó research ni se cambió PURPOSES/SCOPES.

## Qué se implementa

- `/app/feedback`: formulario opcional ES/EN, sin texto libre, valores iniciales sin seleccionar, no responder/no seguro/no explorado separados; categorías de ayuda opcionales. Valor personal no exige contexto profesional.
- Simulación en RAM de guardar/leer/reintentar, conflicto y retirada, con mensajes explícitos “Guardado solo en la simulación”. Recargar/cambiar sesión desmonta los datos; no hay autosave, POST/PUT/DELETE de feedback, almacenamiento web de respuestas, telemetría o SDK analítico.
- `/admin/pilot-metrics`: metas propuestas separadas de resultados ficticios; estados sin configurar, no disponible, en curso, protegido y error. Un DTO protegido que incluya conteos ocultos se rechaza. El fixture normal no contiene conteos individuales/ocultos; no se compara el subgrupo EN ni se ofrecen filtros de personas.
- `VITE_ENABLE_PILOT_FEEDBACK_PREVIEW` exige literalmente true. Por defecto, enlace de entrada oculto y URL directa sin formulario ni datos. No hay fallback de un backend real a fixtures: el único repositorio de este tramo es explícitamente ficticio y no tiene fetch.
- El enlace de revisión se añade al cuerpo del dashboard solo cuando la bandera está habilitada. El layout admin reutiliza cabecera/sidebar/guard existentes y recibe una variante responsive **solo en esta ruta**: en móvil se oculta su barra lateral, conservando un regreso explícito a administración. El resto de admin mantiene su variante previa.
- Componentes daisyUI con prefijo actual, tokens locales, primer enlace de salto, fieldset/legend, etiquetas/casillas visibles, foco y diálogo con Escape/cancelación; reduced motion y responsive. Sin rediseño de chat, checkout, terapeuta/board o panel de ánimo existente.

## Pruebas reales ejecutadas

| Comprobación | Resultado final |
| --- | --- |
| frontend npm run lint | exit 0; 0 errores/0 advertencias; sin reglas silenciadas |
| frontend npx tsc -b | exit 0 |
| frontend npm test | 29/29, 0 fail; siete nuevas ES-36 |
| Nuevas unitarias con Node 22 | 7/7, 0 fail |
| frontend npm run build | exit 0; 79 módulos; JS 542,38 kB (gzip 140,53), CSS 41,77 kB |
| frontend npm audit | exit 0; 0 vulnerabilidades |
| node scripts/es36-browser.cjs | exit 0; ocho builds de escenarios y nueve grupos de navegador PASS |
| git diff --check | exit 0 |

Permanece el aviso de bundle >500 kB; no se oculta ni cambia el umbral. No se añaden dependencias. No se ejecutan pruebas backend/migraciones porque este PR no cambia backend ni crea tablas/endpoints; no se presentan tests de fixtures como integración PostgreSQL o autorización de servidor.

El navegador usa React compilado y Chromium aislado con repositorio ficticio. Los GET ajenos del dashboard son respuestas HTTP simuladas; se observa que no haya escrituras a `/api/*`. Nada usa credenciales/cuentas reales ni Claude. Los builds se guardan en `frontend/node_modules/.es36-*`, fuera de Git, y no sustituyen dist de producción. Las capturas sintéticas inspeccionadas quedan en `frontend/node_modules/.es36-artifacts/`.

Nueve grupos:

1. Build por defecto: URL deshabilitada, cero radios y sin enlace de revisión en dashboard.
2. ES/EN sin perder elecciones; opciones iniciales vacías, sin textarea; guardado/lectura/retirada de simulación; cancelación con Escape y foco inicial en permanecer; recarga/cambio de token limpia; salida cancelada conserva ruta y borrador; 320/375/768/1440; cero escrituras y cero errores de ejecución. Se comprueba radio visible >=18px y etiqueta 16px.
3. Fixture lost-ack: conservar intención y consultar explícitamente antes de anunciar guardado solo simulado.
4. Fixture save-error: error conserva borrador y no anuncia persistencia.
5. Fixture conflict: revisión de versión conserva elección local; nueva operación usa versión actual.
6. Sin configurar: guardado de simulación no habilitado.
7. Error de carga: error/reintento, sin inventar respuestas guardadas.
8. Reporte admin: metas diferenciadas, sin valores ocultos en dl, responsive a cuatro anchos y reflow con zoom CSS 200%.
9. Error de métricas: se presenta error, no resultado observado cero.

Contraste sRGB calculado: tinta #1C1917 sobre #F9F9F7 16,59:1; acción/foco #4A6741 sobre fondo 6,02:1 y blanco 6,35:1; aviso #92400E sobre #FEF3C7 6,37:1. No se declara conformidad universal ni prueba de lector de pantalla solo por estos checks.

Durante desarrollo se corrigieron un estado en efecto señalado por lint y un import de TypeScript sin extensión que impedía las unitarias en Node. La inspección de capturas detectó radios invisibles por variables daisyUI ausentes y etiquetas menores de 16px; se añadieron los tokens locales y sus comprobaciones de navegador, sin cambiar el flujo/layout aprobado. Se corrigió una aserción de salida cancelada que no contemplaba el ancla #pilot-main. Las comprobaciones finales pasaron sin relajar configuración.

## Reproducción

Desde frontend:

```powershell
npm ci --ignore-scripts
npm run lint
npm test
npx tsc -b
npm run build
npm audit
```

Revisión local explícita, nunca activada por defecto:

```powershell
$env:VITE_ENABLE_PILOT_FEEDBACK_PREVIEW='true'
npm run dev
```

Escenarios opcionales de build: `VITE_PILOT_FEEDBACK_SCENARIO` = normal, load-error, save-error, lost-ack, conflict, unconfigured o metrics-error. Solo afectan al repositorio de simulación; no son endpoints o modos operativos del servidor.

Para el arnés: Playwright disponible mediante el paquete local o `PLAYWRIGHT_MODULE` con su ruta absoluta; ejecutar `node scripts/es36-browser.cjs`. El arnés compila escenarios por separado, usa puertos loopback aleatorios y cierra navegador/servidores al terminar. Es verificación local explícita; las siete nuevas unitarias sí entran en el npm test del CI.

## Seguridad, límites y continuación

El rol/token de localStorage solo ejerce los guards existentes del frontend; **no prueba autorización de servidor** ni asignación de cohortes. No hay API nueva sobre la que afirmar A/B, 403 de cohorte, revocación real, cifrado, idempotencia SQL, exportación, purga o migración. La limpieza por token y el rechazo de DTO inválido son defensas de UI, no sustitutos de esos contratos.

Contrato recomendado: finalidad opcional `pilot_metrics` independiente y scope/ventanas/asignación de servidor; datos propios accesibles/retirables sin volver a conceder analítica; withConsent y publicación bajo permiso vigente; incorporación a ES-23; política de retención configurada; supresión de muestras/complementos, sin facilitar reconstrucción del piloto de seis. **Mauricio debe revisar/implementar ese contrato antes de conectar datos reales.** Las ventanas 7/30 son las del diseño; el inicio asignado de cada persona no se infiere ni existe todavía en esta interfaz.

No se recogen ejemplos cualitativos libres: la objeción del plan continúa si el PO exige ese criterio del PRD. No se implementan rutas/experimentos/decisiones de ES-32/33. Una meta 5/6 o 4/6 no se presenta como resultado obtenido.

Pendientes: revisión técnica del contrato y de este PR; backend/modelos/migración y derechos reales; política de supresión y responsables/ventanas operativos; integración/QA con APIs autorizadas; staging, móviles físicos, otros navegadores y lector de pantalla. Sin merge propio, activación del piloto o cambios de producción.
