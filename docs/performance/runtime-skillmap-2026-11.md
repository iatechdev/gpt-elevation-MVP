# Rendimiento en ejecución del Skill Map — noviembre 2026 (ES-199 · PERF-05, parte Skill Map)

Medición con `frontend/scripts/perf-skillmap.cjs`: build de producción servido en local, CPU ×4 (móvil de gama media), 390 px, español, capacidades SINTÉTICAS (una por territorio, en rotación), API simulada, mediana de 3 corridas. «A relieve» = volver del radar a la vista de relieve (la interacción más lenta). Sin lector de pantalla ni dispositivos reales.

## 1. Hallazgo

Al volver al relieve (o cargar el mapa, que abre en relieve) se repite trabajo que solo depende del mapa cargado:

1. `placeSkills` → `layoutChips` (colocación determinista en espiral): para cada capacidad recorría la espiral completa desde el centro y comparaba cada punto con todas las cajas ya colocadas. Era lo más caro de la carga y se repetía en CADA vuelta al relieve (el componente se vuelve a montar).
2. `separate()` (que los botones no se solapen): 160 pasadas × n² pares, creando dos objetos por comparación; además se recalculaba cuando llegaban las medidas de los rótulos aunque en móvil (solo marcas) no se usen.

Medido en Node sin limitar la CPU (ms): `layoutChips` 30 / 150 / 400 capacidades: 56 / 506 / 605 → ~7 / ~10 / ~15–20. `separate` (400 en 390 px): 1 580 → ~470 (en estos tamaños las marcas no caben y se agotan las 160 pasadas).

## 2. Correcciones (resultado idéntico; lo fijan pruebas contra la implementación anterior)

- `layout.ts`: la búsqueda en espiral continúa donde se quedó la capacidad anterior con el mismo ancla (lo libre solo puede encoger, así que los puntos ya rechazados siguen rechazados), las cajas colocadas viven en una cuadrícula y no se crea una caja por punto probado.
- `reliefPlace.ts` / `ReliefMap.tsx`: la colocación se calcula una vez por mapa cargado (`placeSkillsCached`, `WeakMap` en memoria: no se guarda nada fuera de la página, sin almacenamiento persistente).
- `reliefSeparate.ts`: cajas en arreglos tipados, sin objetos por comparación (misma aritmética y mismo orden de pares).
- `ReliefMap.tsx`: con solo marcas (`box.w < 640`) las medidas de los rótulos no recalculan la disposición.
- Descartado y revertido: cuadrícula también en `separate()`. Con entradas imposibles de acomodar (400 marcas en un móvil) fue MÁS lenta (10 s) y con pocas capacidades también (8 ms contra 3); no se justifica.

## 3. Antes y después (CPU ×4, 390 px, mediana de 3; el equipo estaba cargado, hay ruido de ±30 %)

| Capacidades | Carga inicial antes → después (ms) | Volver del radar al relieve antes → después (ms) |
| --- | --- | --- |
| 30 | 4 305 → 4 367 (sin diferencia fuera del ruido) | 835 → 1 126 (ruido; en una corrida con menos carga: 485 → 468) |
| 150 | 7 351 → 5 149 | 5 085 → 3 944 (en otra corrida: 2 571 → 1 688) |
| 400 | 25 398 → 12 824 | 24 390 → 12 415 (en otra corrida: 21 534 → 6 962) |

Tareas largas (> 50 ms) al volver al relieve: 3 / 5 / 5 antes y después (la medición no distingue su duración).

## 4. Objetivo propuesto por Infra y por qué NO se alcanza

Objetivo: 400 capacidades ≤ 2 s al volver del radar y carga ≤ 4 s. **No se alcanza (12,4 s y 12,8 s).** Lo que queda, con el perfil (400 capacidades, CPU ×4):

- `separate()` ~3,3 s: las 400 marcas de 28 px suman ~313 000 px² en una caja de ~190 000 px²; no caben, así que se agotan las 160 pasadas por construcción. Reducirlo sin cambiar el resultado no es posible; hacerlo exige cambiar lo que se dibuja cuando no caben (decisión de diseño/PO: p. ej. no separar cuando las marcas no caben, o agruparlas).
- Pintar el relieve (`reliefField`: capacidades × celdas del canvas) ~1 s y la lectura de tamaño tras crear 400 botones ~1 s.
- Con 400 capacidades, hasta cambiar de vista a la lista tarda ~2 s: el costo es del tamaño del DOM, no solo del relieve.
- **No verificado:** el tamaño real del catálogo (el perfil de PERF-01 usó 18 habilidades); si es de decenas, la pantalla ya queda dentro de lo razonable (30 capacidades: ~0,5–1 s a CPU ×4, ruido incluido). Los 400 son una prueba de esfuerzo, no un dato del piloto.

## 5. Guardas contra el regreso de la complejidad

`frontend/test/es-199-relieve.test.mjs`: equivalencia con la versión anterior de `separate()` y de `layoutChips()` (aleatorio y reproducible, hasta 400 capacidades), `layoutChips(400)` < 300 ms sin limitar la CPU (hoy ~15 ms; la anterior 600–1 100 ms), colocación una vez por mapa y sin recálculo por medidas en móvil.

## 6. Limitaciones

Servidor sintético, localhost, un equipo cargado, solo Chromium, CPU ×4 simulada; sin INP real ni Firefox/Safari; el relieve en canvas se midió por tiempo de interacción, no por cuadros por segundo.
