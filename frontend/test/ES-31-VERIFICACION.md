# ES-31 — fichas y gestor del catálogo

27-oct-2026 · Dev-Codex. Diseño Jira 10218, aprobado explícitamente en el chat: «Aprobar fichas y gestor completos». Documento de diseño: `docs/elevation-skillmap/26-ES-31-DISENO-INTERFAZ.md`. Base UI `main` 4311d69; backend aprobado de referencia: PR #33, 783e934.

## Alcance entregado

- Fichas publicadas en `/app/route-catalog` y `/app/route-catalog/roles/:roleKey`, filtros explícitos de mercado/idioma/contexto, fuentes y fechas, exposición IA con fuente/hipótesis/desconocida, requisitos de capacidad, habilitación, ofertas y recursos con ejercicio.
- Gestor `/admin/route-catalog`: versiones, borrador copiado del vigente, cinco formularios estructurados, referencias, guardar incompletos, faltantes por campo, eliminación confirmada del borrador y publicación confirmada. Versiones publicadas/archivadas de solo lectura.
- UI ES/EN, móvil y teclado. Solo dos nuevas entradas de navegación; no se rediseña el resto del admin ni se cambia chat, diario, evidencias o Skill Map.
- Se conserva la marca sintética al editar/copiar; no hay interruptor para quitarla, semilla automática ni activación de banderas desde frontend. Los textos reales siguen pendientes del cliente y revisión de dominio.

## Seguridad y límites

Reutiliza `verificarToken` y `verificarAdmin` del backend existente, sin nuevos endpoints, modelos, migraciones o permisos. Es un catálogo editorial compartido por administradores autorizados; no se inventa propiedad individual del catálogo. Se prueban IDs administrativos con un usuario sin rol. No se consulta ParticipantContext, chat, diario ni ánimo. Metadatos de revisores solo en admin; el parser público rechaza la presencia de los nombres privados de revisión/consulta.

Payloads PUT completos con lista cerrada de campos y origen sintético conservado. Borrador local solo en memoria; nunca se presenta como persistido sin ACK y consulta posterior. Sin reintentos automáticos de mutaciones: tras respuestas perdidas se consulta el estado antes de otra decisión. Un cambio/fin de sesión elimina el estado administrativo. API no-store; respuestas atrasadas de otra sesión ignoradas. Enlaces HTTPS explícitos sin previsualizaciones, credenciales ni enlaces a hosts/IP locales, con noopener/noreferrer.

La API no ofrece ETag/revisión de elemento. No se garantiza impedir sobrescrituras entre dos administradores: se documentó en el diseño aprobado y se avisa en el editor. No se simula un bloqueo o un parámetro expectedVersion. Fechas/estados de frescura son los recibidos del servidor; no se fijan plazos duplicados en UI. Precio cero, salario no publicado y precio por confirmar permanecen distintos.

## Resultados finales locales

| Comprobación | Salida real |
| --- | --- |
| `npm run lint` | exit 0, 0 errores y 0 advertencias; sin silenciar reglas |
| `npm test` frontend | exit 0, 35/35 (13 nuevas ES-31) |
| `npx tsc -b` | exit 0 |
| `npm run build` | exit 0, 77 módulos; JS 562,05 kB / gzip 145,88 kB; CSS 57,91 kB / gzip 9,60 kB |
| `npm audit` frontend | exit 0, `found 0 vulnerabilities` |
| `npm test` backend 783e934 | exit 0, 216/216, modelos simulados del arnés existente |
| `node scripts/es31-api-integration.cjs` | exit 0, 12 grupos de comprobaciones con Express/JWT/Sequelize/PostgreSQL reales y Chromium |

El build mantiene el aviso >500 kB; base 4311d69: JS 522,56 kB / gzip 133,49 kB y CSS 30,93 kB. La UI y formularios agregan unos 39,5 kB JS y los controles daisyUI aumentan CSS. No se oculta ni se relaja el aviso. Instalación del backend aprobado informa 6 vulnerabilidades moderadas; no se modifican sus dependencias desde este PR frontend.

Las unitarias ejercitan el TypeScript real mediante transpileModule, sin copiar la lógica a fixtures. Cubren serialización de los cinco tipos, referencias anidadas, flags sintéticos, valores cero/falso/desconocido, claves y enlaces seguros, etiquetas ES/EN, parsing cerrado y cliente HTTP (fetch simulado en ese caso).

Integración: el navegador usa la aplicación compilada y retransmite las llamadas a las rutas reales del PR #33 sobre PostgreSQL desechable 17.10. Se inyecta solo la conexión local al módulo database antes de cargar modelos/rutas; no se usa `.env` ni DATABASE_URL existente. JWT y claves de cifrado generados en memoria; solo datos sintéticos; ningún proveedor LLM o producción. Dos escenarios de fallos deliberados: respuesta PUT perdida después de persistir; PUT abortado antes de enviar seguido de una lectura 503 simulada. El resto de respuestas HTTP proviene de Express real.

### Grupos de integración aprobados

1. Sin publicado: 503 representado como catálogo no disponible. Sin token/usuario no administra: 403.
2. Crear borrador desde React y verificarlo en DB; GET/PUT/DELETE/publish de un ID administrativo con token de usuario: 403.
3. Crear y eliminar un elemento cuya clave es literalmente `new`; publicar vacío devuelve 422 y deja el borrador.
4. Editar los cinco tipos desde sus formularios conserva el resto del objeto, referencias y marcas sintéticas. Precio cero permanece cero. Editor de rol sin desbordamiento a 375 px.
5. ACK perdido no repite PUT ni muestra éxito; el estado persistido se consulta.
6. Fallo de escritura/lectura conserva el texto local al recuperar GET y bloquea nuevas escrituras mientras no se conoce el estado.
7. Política de textos 422 mantiene edición local; catálogo sintético no se publica sin la bandera de pruebas del servidor.
8. Publicación confirmada se verifica mediante GET admin y público; no salen nombres de revisores al participante.
9. Fichas reales muestran fechas/estados recibidos, ofertas vencidas, salario no publicado, precio por confirmar y precio cero. Filtros, ES/EN, 320/375/768/1440, zoom CSS 200% y reduced motion.
10. Editor de versión publicada deshabilitado y sin publicación disponible.
11. Nuevo borrador copia la publicada y no aparece en lectura participante; cancelar Atrás conserva cambios; Escape cierra diálogo; primer Tab llega al salto y Enter enfoca main.
12. Rol admin falsificado en localStorage no evita 403 del servidor; revocar JWT durante la edición provoca 401 y retira los campos administrativos sin guardar.

Capturas sintéticas de listado y editor generadas fuera de Git e inspeccionadas. Durante desarrollo se corrigieron el nombre accesible del filtro y el robo de foco del aviso de carga, detectados por navegador. El arnés tuvo un nombre de variable duplicado y una expectativa de cantidad de roles DK incorrecta; se corrigieron tras fallar, sin alterar backend para acomodar las pruebas.

## Reproducir

Node local 24.14.0; CI del proyecto usa Node 22. Instalar frontend, ejecutar build e iniciar `npm run preview -- --host 127.0.0.1 --port 4231 --strictPort`.

```powershell
$env:ES31_BACKEND_DIR='<checkout aislado del PR #33>/backend'
$env:PLAYWRIGHT_MODULE='<ruta a playwright instalado>'
$env:ES31_PREVIEW_URL='http://127.0.0.1:4231' # opcional, valor por defecto
$env:ES31_SCREENSHOT_DIR='<directorio de capturas fuera del repo>' # opcional
node scripts/es31-api-integration.cjs
```

Requiere dependencias fijadas del backend, embedded-postgres y Chromium de Playwright. Se inicia una DB temporal con puerto loopback aleatorio y credenciales generadas; se detienen navegador, servidor, conexión y PostgreSQL al terminar, también ante error. El proceso devuelve 1 ante fallo después de limpiar recursos. El arnés es una prueba local opcional; no se añade como paso del CI. Las unitarias sí se ejecutan en CI mediante npm test.

## Pendientes y no verificado

- Integrar el backend del PR #33 a main antes de desplegar esta UI. Se verificó localmente contra su head; no se apila ni duplica su código en este PR.
- Carga real del cliente, revisión editorial/dominio y comprobación de páginas oficiales: no realizadas. La HU no se cierra como catálogo real/piloto con fixtures.
- Sin verificación de Railway/Supabase/producción, migraciones de producción, Safari/Firefox ni lectores de pantalla reales.
- Enlace de skillKey con catálogo ES-29 y recomendaciones/experimentos/plan: ES-32/33/34, sin inventar esos servicios en esta UI.
- Edición simultánea entre administradores sin revisión/ETag: limitación existente del contrato aprobada en el diseño; sin garantía de exclusión mutua del editor.
- Revisión de Mauricio, QA del frontend y aviso de tamaño del bundle pendientes. Nunca se fusiona ni se cierran hilos desde Dev-Codex.
