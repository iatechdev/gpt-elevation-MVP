# QA-LAND-01 · Evidencia

Hallazgo (Medio): a 1440 px la maqueta aprobada centra la cabecera, el héroe, las puertas y la franja en un marco de 1078 px; la implementación iba de borde a borde con el texto a 58 px.

## Corrección
- Cabecera (ES-62): barra interior centrada de 1080 px con bordes laterales (`.landing-header-inner`).
- Héroe, puertas y franja de ejemplo (ES-63/ES-64): dentro de `.landing-frame` (1080 px centrado, bordes laterales, margen interior de 28 px).
- Las tres ramas se apilaron (ES-62 → ES-63 → ES-64) para resolver una sola vez los conflictos de `LandingPage.tsx` y `landing.css`.

## Medido en navegador (head de ES-64, Vite local, franja visible)
- 1440 px (barra de desplazamiento de 15 px): marco de 1080 px de ancho entre x=173 y x=1253; barra de cabecera con los mismos límites; logotipo, etiqueta, titular y etiqueta de la franja a x=202 (= 173 + 1 + 28, como la maqueta: 209 sin barra); franja de 1078 px; sin scroll horizontal.
- 390 px oscuro: marco de borde a borde, margen interior de 16 px (logotipo, titular y etiqueta a x=17), sin scroll horizontal.
- Pruebas de frontend del head: 23/23; lint, tipos y build correctos.

## Capturas
- `landing-1440-light.jpg`, `landing-390-dark.jpg`.

## No verificado
Comparación píxel a píxel con la maqueta, 768 px, tema oscuro a 1440 px y lector de pantalla.
