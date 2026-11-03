# ES-71 · Verificación de la sección de profesionales

[Dev-Codex] · 29-oct-2026. Rama ES-71-seccion-profesionales. Base main d5eb00f.

## Aprobación y alcance

Diseño general ES-60/10279 y ES-71/10283; adaptación de textos/estados/CTA en 10482 y aprobación explícita del usuario registrada en 10483. S8 se monta entre S7 y S9 con seis funciones, límites del espacio privado, puente al profesional Próximamente, invitación al piloto y CTA al formulario existente.

Se corrige la descripción antigua de resúmenes: no usan notas privadas ni conversaciones con IA. No se anuncia videollamada o integración de proveedores como operativa por deducirlo del código. Los seis estados «Disponibilidad por confirmar» son claves individuales; no son comprobaciones automáticas de despliegue.

Las 31 claves nuevas landing.pros.* y la navegación existente son ES/EN editables con fallback. Se reutilizan tema ES-61 y componentes daisyUI ya instalados; no se añade librería, módulo de UI ni dependencia.

## Publicación y destino

Solo VITE_ENABLE_LANDING_PROFESSIONALS=true literal monta S8 y su ancla de cabecera. Ausente/false/otro valor: ambas ocultas. El CMS no puede habilitar la bandera ni dar por aprobada la revisión especializada. No se modificó Dockerfile ni configuración de staging/producción.

El CTA va a /profesionales únicamente si el registro existente de rutas contiene esa ruta. Si falta, no hay enlace y aparece Próximamente. No se duplica el formulario ES-95, no se crea cuenta ni se envía solicitud desde S8. La nota junto al CTA distingue solicitud de acceso automático.

La publicación integral sigue pendiente de revisión especializada ES-17 y Mauricio/Alejo, disponibilidad D-03 e inglés. La conexión al espacio del profesional sigue pendiente de D-12. No se acredita una prestación real ni se cierra la historia integral por esta preparación.

## Seguridad y privacidad

Sin cambios de endpoints, consultas personales, modelos, migraciones, helpers de identidad/consentimiento/revocación/derechos, permisos o zonas privadas. El backoffice conserva su implementación. Solo catálogo declarativo del GET/PUT existente.

Prueba HTTP con Express y JWT reales, persistencia LandingContent simulada: lectura pública de las 31 claves ES/EN, edición superadmin 200; sin sesión y user/therapist/board/admin 403; token inválido 401; entradas inválidas 400. No se afirma PostgreSQL real ni A/B de endpoints nuevos, porque no existen en esta HU.

Arnés de navegador local con CMS simulado y aplicación compilada: no usa .env, base de datos, cuentas reales, credenciales, IA o almacenamiento externo. Abre el formulario para verificar el destino sin rellenarlo, subir archivos, aceptar consentimiento ni enviar. Contador final observado: 0 escrituras API.

## Pruebas ejecutadas

| Prueba | Resultado real |
| --- | --- |
| Frontend npm test | 160/160, exit 0 |
| ES-71 + cabecera afectada | 10/10, exit 0 |
| Cuatro pruebas nuevas con Node 22 | 4/4, exit 0 |
| Frontend npm run lint | exit 0, 0 errores/advertencias |
| Frontend npm run build (incluye tsc -b) | exit 0 |
| Build de revisión true | exit 0 |
| Backend npm test | 389/389, exit 0 |
| Backend ES-71 HTTP | 1/1, exit 0, modelos simulados |
| Frontend npm audit | exit 0, 0 vulnerabilidades |
| Backend npm audit | exit 1, 6 moderadas, 0 altas/críticas |
| git diff --check / node --check arnés | exit 0 |

Build estándar: 171 módulos, JS 826.50 kB (gzip 220.59), CSS 113.36 kB (gzip 16.62). El de revisión tiene el mismo tamaño redondeado. Permanece el aviso de chunk >500 kB; no se silenció ni se cambió su umbral. Audit backend reporta la cadena existente de storage/uuid/Sequelize; no se modifican dependencias ni lockfiles dentro de ES-71.

Las pruebas unitarias de frontend renderizan TSX real mediante SSR, con MemoryRouter; fetch se simula para fallos del CMS. La prueba de cabecera verifica el enlace real con bandera apagada y encendida. Las pruebas existentes afectadas se actualizaron por el nuevo prop opcional, sin relajar reglas o borrar comprobaciones de accesibilidad.

## Navegador local

Desde frontend: npm run build. Para la vista de revisión:

```powershell
$env:VITE_ENABLE_LANDING_PROFESSIONALS = 'true'
npx vite build --outDir dist/es71-review
Remove-Item Env:VITE_ENABLE_LANDING_PROFESSIONALS
# Desde backend:
node test/support/es71-preview.cjs
```

El arnés anuncia dos puertos loopback, default y review; sirve respectivamente dist y dist/es71-review. Escenarios /__es71/cms/normal|offline|empty|malformed|partial|long, /__es71/dark y /__es71/text-zoom son fixtures explícitos. La última amplía la fuente raíz al 200%; no es zoom nativo de navegador. /__es71/metrics informa escrituras y POST /__es71/stop cierra ambos servidores. No se monta en producción.

Resultados observados:

- Build default: cero secciones .landing-pros y cero enlaces .landing-nav-pros. Review: seis tarjetas y enlace a la sección.
- Ancla directa #profesionales enfoca la sección; margen bajo cabecera, sin ocultar el comienzo.
- CTA activado con Enter abre /profesionales y muestra «Solicitud para profesionales» con formulario existente. Sin envío ni alta.
- Cambio ES/EN conserva todos los textos y traduce sección/navegación; sin mezcla. Privacidad y nota de no acceso automático presentes.
- Móvil: Escape cierra menú y devuelve foco a Open menu; Enter en For psychologists cierra menú y enfoca #profesionales a ~112 px bajo cabecera.
- Tab desde el enlace de navegación llega al selector de idioma con contorno ocre 3 px.
- Anchos 320/375/390: una columna; 768/1440: dos. Sin desbordamiento horizontal. CTA medido 48.39 px de alto.
- CMS offline, vacío y malformado conservan seis tarjetas y texto completo. Una edición parcial cambia solo el título. Texto largo a 320 sin desbordamiento; <img> literal, cero imágenes inyectadas.
- Tema oscuro real del componente con preferencia simulada: fondo rgb(21,21,19), texto rgb(243,241,234). Sin animación nueva; tokens de contraste cubiertos por la prueba existente (ocre oscuro sobre papel 5.54:1).
- Raíz al 200%: texto de tarjeta 28 px a 390, sin desbordamiento. Es ampliación de texto CSS, no zoom nativo.

Captura de revisión local fuera de Git: es71-profesionales-revision.jpg en la carpeta de visualizaciones de la tarea. No acredita publicación en clientes.

## Límites

Sin staging/producción, envío profesional real, verificación de credenciales con documentos reales, proveedores IA/videollamada/storage ni integración PostgreSQL adicional. Sin revisión especializada, inglés nativo, Safari/Firefox, lector de pantalla real o zoom nativo. Las pruebas no sustituyen esas revisiones.

Un PR contra main, sin merge propio ni cierre de hilos de QA. La entrega preparatoria no habilita la sección para clientes.
