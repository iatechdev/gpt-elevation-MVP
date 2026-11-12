# Línea base de rendimiento del frontend — noviembre 2026 (ES-195 · PERF-01)

Medición del frontend `frontend/` sobre `main` (7e1b0836). `main` avanzó después (a 12-nov-2026 el mayor bloque medido por `build:check` es 420,6 kB bruto, frente a 411,35 kB aquí); las cifras de este documento NO se re-midieron sobre ese avance. Solo mide: no cambia UI ni lógica. Todas las cifras de este documento salen de las dos órdenes de la sección «Cómo reproducirlo»; no hay cifras estimadas. Lo que no se pudo medir está en «Limitaciones».

## 1. Peso del paquete (`npm run perf:report`)

kB = 1000 bytes; gzip nivel 9. Resumen de la corrida del 11-nov-2026 (la lista completa de los 97 bloques la imprime el comando):

| Concepto | Bruto | gzip | Presupuesto vigente (`npm run build:check`) |
| --- | --- | --- | --- |
| Carga inicial de JS (índice + `jsx-runtime` + `api` + `pending`) | 423,19 kB | **128,42 kB** | 150 kB gzip |
| CSS inicial | 102,28 kB | 16,76 kB | 20 kB gzip |
| Mayor bloque (`index-*.js`, el de entrada) | 411,35 kB | 123,45 kB | 500 kB bruto |

Nota sobre el ticket: ES-195 citaba 468,64 kB (142,13 kB gzip) del bloque de entrada en 5366a392; en 7e1b0836 son 411,35 kB (123,45 kB gzip). El bloque de entrada bajó desde esa medición; no se investigó cuál cambio lo causó.

Otros bloques grandes (bruto / gzip): `es-*.js` 135,39 / 48,28 kB y `en-*.js` 131,38 / 47,20 kB (catálogos de textos por idioma, cargados bajo demanda), `SkillMapPage` 52,51 / 13,34, `Onboarding` 38,54 / 10,53, `ChatPage` 38,12 / 10,51, `BridgePage` 37,55 / 12,07.

De qué está hecho el bloque de entrada (tamaño del **código fuente** por grupo, no del bundle minificado; sirve para ordenar, no para sumar): `react-dom` 545 kB (4 módulos), `react-router` 376 kB (1), `src/i18n` 68 kB (10), `src/components/landing` 32 kB (14), el resto de `src/` por debajo de 16 kB cada carpeta. Es decir, el peso de la entrada es casi todo React y el enrutador; el código propio de la entrada es menor.

## 2. Lighthouse (`perf-lighthouse.mjs`)

Lighthouse 13.5.0, Node v22.23.4, Chromium 156 (Playwright), **móvil con el throttling por defecto de Lighthouse móvil (4G lenta simulada, CPU ×4)**, solo la categoría de rendimiento, carga en frío (caché y almacenamiento vaciados salvo `localStorage`, que lleva la sesión sintética), 3 corridas por pantalla. Se informa la **mediana** y entre paréntesis las tres corridas. Equipo: Intel Core i5-8365U, 8 hilos, 17 GB, Windows 11.

| Pantalla | LCP (s) | TBT (ms) | CLS | Transferido (kB) | Peticiones | Puntaje Lighthouse |
| --- | --- | --- | --- | --- | --- | --- |
| Landing `/` | 2,68 (2,44 / 2,82 / 2,68) | 174 (202 / 73 / 174) | 0,000 | 246 | 11 | 0,92 |
| Entrar `/login` | 2,67 (2,53 / 2,68 / 2,67) | 103 (108 / 103 / 100) | 0,000 | 246 | 10 | 0,93 |
| Mi espacio `/app/dashboard` | 3,81 (3,83 / 3,81 / 3,77) | 154 (183 / 154 / 128) | 0,156 (0,156 / 0,156 / 0,000) | 352 | 37 | 0,76 |
| Chat `/app/chat` | 3,21 (3,21 / 3,16 / 3,21) | 290 (290 / 227 / 439) | 0,015 | 273 | 19 | 0,83 |
| Skill Map `/app/skill-map` | 3,40 (3,40 / 3,41 / 3,38) | 172 (168 / 172 / 172) | 0,000 | 317 | 23 | 0,85 |
| Panel profesional `/therapist/dashboard` | 3,76 (3,44 / 3,76 / 3,95) | 135 (135 / 135 / 160) | 0,154 (0,154 / 0,154 / 0,155) | 404 | 31 | 0,78 |

«Transferido» = `total-byte-weight` de Lighthouse (bytes sobre la red, comprimidos). Las peticiones incluyen las del servidor sintético de `/api/**`.

Lecturas (hechos medidos, sin diagnóstico de causa):

- **LCP:** entre 2,67 s y 3,81 s en este montaje; las pantallas con sesión (Mi espacio, Chat, Skill Map, Panel) son más lentas que la landing y el login, que comparten el mismo bloque de entrada.
- **CLS:** Mi espacio (0,156 en 2 de 3 corridas) y Panel profesional (0,154 en 3 de 3) tienen desplazamientos de diseño; el resto, 0 o 0,015. Es el único hallazgo de estabilidad visual y queda como candidato para PERF-02; no se investigó su causa aquí.
- **TBT:** Chat es la más alta (290 ms) y la menos estable (227–439 ms entre corridas).
- **Peticiones:** Mi espacio hace 37, la que más; el resto entre 10 y 31.

## 3. Cómo reproducirlo

Desde `frontend/`:

```bash
# Paquete (construye en una carpeta temporal; no toca dist/ ni el repositorio)
npm run perf:report            # tabla legible; añade  -- --json  para la salida completa

# Lighthouse (solo en equipo local o de QA; NUNCA en CI; no es dependencia del repositorio)
npm i lighthouse@13.5.0 --prefix <carpeta fuera del repo>     # versión exacta, publicada el 2026-09-18
npx vite build
LH_DIR=<carpeta fuera del repo> CHROME_PATH=<ruta a chrome/chromium> node scripts/perf-lighthouse.mjs --runs 3 --out resultado.json
# opciones: --only landing,login,space,chat,skillmap,panel   ·   en Windows pasa las rutas con «C:/…»
```

`perf-lighthouse.mjs` sirve `dist/` con gzip y reserva de rutas de la SPA, y responde `/api/**` con datos sintéticos fijos (18 habilidades para el mapa, listas vacías para el panel, etc.). Cada pantalla se comprobó con una captura que muestra su estado real (no un error): Mi espacio con la zona profesional, Skill Map con el radar, Chat con el aviso de uso de IA, Panel con sus bloques en 0 / «Sin datos».

## 4. Limitaciones (qué NO dice esta medición)

- **Servidor sintético, no el backend real**: no mide latencia de API, Railway ni Supabase. Eso es ES-202 (staging).
- **Localhost**: sin latencia de red real ni CDN; el throttling es el simulado de Lighthouse, no una red real. El hosting real puede comprimir o cachear distinto (aquí se comprime con gzip y los `assets/` son inmutables).
- **Datos casi vacíos**: las listas están vacías o pequeñas; con datos reales (muchas personas, muchos mensajes) el trabajo de la pantalla será mayor.
- **INP no se mide**: Lighthouse de laboratorio no da INP; se informa **TBT** como sustituto de la respuesta a la interacción. No hay datos de campo (usuarios reales).
- **Un solo equipo y un solo navegador** (Chromium): sin Safari, Firefox ni dispositivo móvil real; el CPU del equipo influye en TBT. La variación entre corridas va entre paréntesis.
- **Idioma**: todo en español (`elv_lang=es`); no se midió inglés.
- **Sin cálculo de causas**: este informe no analiza por qué hay CLS o por qué Mi espacio hace 37 peticiones.
- El tamaño por grupo del bloque de entrada es el del código fuente, no el minificado.

## 5. Presupuestos por pantalla — PROPUESTA (no aplicada; requiere aprobación de Mauricio o Alejo)

Criterio propuesto: mediana medida + 25 % de margen, redondeado, para que el presupuesto detecte regresiones sin romperse por la variación entre corridas. **No son metas de producto ni valores de referencia externos.** Para el CLS se propone un tope fijo de 0,1 (el valor «bueno» que publica web.dev; no lo verifiqué hoy) que hoy **incumplen** Mi espacio y Panel; si se aprueba, esos dos quedarían como deuda explícita de PERF-02 en vez de entrar al presupuesto.

| Pantalla | LCP máx. | TBT máx. | CLS máx. | Transferido máx. | Peticiones máx. |
| --- | --- | --- | --- | --- | --- |
| Landing | 3,4 s | 220 ms | 0,1 | 310 kB | 14 |
| Entrar | 3,4 s | 130 ms | 0,1 | 310 kB | 13 |
| Mi espacio | 4,8 s | 200 ms | 0,1 (hoy 0,156) | 440 kB | 47 |
| Chat | 4,0 s | 360 ms | 0,1 | 340 kB | 24 |
| Skill Map | 4,3 s | 220 ms | 0,1 | 400 kB | 29 |
| Panel profesional | 4,7 s | 170 ms | 0,1 (hoy 0,154) | 510 kB | 39 |

Además del presupuesto de paquete que ya existe (`build:check`: 150 kB gzip de JS inicial, 20 kB de CSS, 500 kB por bloque). No se añade ningún paso a CI en este ticket: un umbral de Lighthouse en CI sería inestable (el TBT varía mucho entre corridas: 73 a 202 ms en Landing, 227 a 439 ms en Chat) y el paso de tamaño ya existe. Medición contra staging: ES-202.
