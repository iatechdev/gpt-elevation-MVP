# ES-63 · Ambas puertas a /login

Corrección posterior al PR #11, desde main 1dc0630. Alejo indicó en esta conversación: «Mantener ambas puertas en /login», al elegir entre ese destino y /app/dashboard para personas con sesión. El código integrado todavía redirigía por rol; esta corrección aplica la decisión directa del PO. Registro en ES-63, comentario 10149.

Solo cambia el destino del helper doorTarget a /login. Sin lectura de localStorage, redirecciones a zonas privadas ni modificación del login. Se conservan componente, textos, layout, estilos y datos. Destino aprobado explícitamente; no se propone otra pantalla o diseño.

Resultados reales:

- `npm run lint -- --max-warnings 0`: exit 0, 0 errores/advertencias.
- `npm test`: 15/15 pasan. Los tres casos antiguos sobre destinos se consolidan en un caso que cubre visitante, todos los roles y almacenamiento no disponible. El resto de pruebas ES-61/62/63 permanece intacto.
- `npm run build` incluye `tsc -b`: exit 0; JS 521.91 kB gzip 133.36; CSS 30.12 kB gzip 6.20; permanece aviso de chunk >500 kB.
- `npm audit` completo de frontend: exit 0, 0 vulnerabilidades. Dependencias sin cambios.
- Chromium aislado: 14 combinaciones de idioma/sesión, 28 navegaciones reales por teclado (las dos puertas). Visitante, user con/sin onboarding, admin, superadmin, therapist y board; ES y EN. Cada enlace tiene href /login, sin controles anidados, y Enter lleva a /login. Sin errores de página.

[Salida del navegador](browser-output.txt). Script: frontend/scripts/es63-login-browser.cjs. Usa Playwright/Chromium como herramienta externa y TEST_URL local; sesión y API simuladas, no autentica usuarios reales ni consulta DB.

No verificado: autenticación/almacenamiento real, staging o producción. No hay cambios de backend, API, permisos o esquema. QA y merge de Mauricio pendientes para esta corrección; no modifica el head ya aprobado de ES-64.
