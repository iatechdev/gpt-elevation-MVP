# PR #56 — semilla de demostración (QA-Claude)
Base vacía (0 tablas): 9 corridas rechazadas (sin bandera/clave, solo bandera, solo clave, bandera false/1/TRUE, clave corta o vacía): salida 1, 0 tablas.
Clave de 12 espacios: pasa la guarda, crea 11 tablas y falla después ("No se pudo cargar la demostración") → QA-56-01 (Bajo).
Base migrada: corrida 1 crea catálogos, participante y 3 evidencias; corrida 2 idempotente (todo "exists"). Un solo usuario demo (example.invalid).
Clave débil «aaaaaaaaaaaa» aceptada → QA-56-02 (Bajo).
demo-seed.test 6/6; test:seed-demo:pg 13/13; mutación (guarda tras connect/sync): 5/6 → la prueba la detecta.
Requiere JWT_SECRET y claves de cifrado presentes al cargar los módulos (antes de la guarda): sin ellas el script cae con una excepción, no con el mensaje «Se niega».
