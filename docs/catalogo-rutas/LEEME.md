# Catálogo de rutas real: cómo llenarlo, revisarlo y publicarlo (ES-410)

| Archivo | Para qué |
|---|---|
| [`plantilla-catalogo-rutas.xlsx`](plantilla-catalogo-rutas.xlsx) | La que se llena (Excel o Google Sheets; guardar como `.xlsx`) |
| [`ejemplo-FICTICIO-catalogo-rutas.xlsx`](ejemplo-FICTICIO-catalogo-rutas.xlsx) | Muestra de cómo se llena. **Nada de él es real. No se carga.** |

*English: fill in the blank template (instructions sheet and column headers are bilingual). The example file is entirely fictitious and must never be published. Texts shown to participants are required in both Spanish and English.*

## 1. Para quien llena el catálogo (Alejo)

1. Descarga la plantilla y abre primero la hoja **Instrucciones**. En las demás hojas: fila 2 = nombre de la columna (no la cambies), fila 3 = qué escribir, desde la **fila 4** tus datos.
2. Orden: **Contextos → Fuentes → Rutas → Tareas, Barreras y Capacidades → Ofertas y Recursos** (estas dos son opcionales).
3. Lo mínimo para publicar: **1 contexto y 1 ruta** con al menos una fuente, al menos una tarea y la revisión de dominio (quién y cuándo).
4. Las «claves» son nombres cortos que tú inventas para unir las hojas (por ejemplo, la ruta apunta a sus fuentes por la clave).
5. **No inventes nada.** Cada fuente lleva quién la consultó y cuándo; cada ruta, quién hizo la revisión de dominio; cada oferta, quién la verificó. El sistema no abre las páginas: esas afirmaciones son de una persona. Si algo no se sabe: `unknown` donde se permite, o se deja fuera.
6. No escribas datos de participantes.

Topes: 6 contextos; 100 fuentes; 60 rutas; por ruta, 12 tareas, 8 barreras y 12 capacidades; 60 ofertas (10 por ruta); 100 recursos.

Con el tiempo (calculado al mostrar): una fuente consultada hace más de **180 días** o que no abre se muestra como desactualizada; una oferta verificada hace más de **14 días** se muestra como vencida.

**Capacidades:** las claves de «Capacidad» deben ser las del **catálogo de habilidades publicado** (Administración → Contenido → Catálogo de habilidades). El servidor no lo comprueba: si no coinciden, la persona ve «capacidad por confirmar».

## 2. Revisar el archivo (equipo técnico)

Desde `backend/`, con las dependencias instaladas (`npm ci`):

```
npm run catalog:validate -- <ruta del archivo.xlsx>
```

Opcional: `--capacidades=clave1,clave2,…` (las claves del catálogo de habilidades publicado) para avisar de las que no estén.

- Usa **las mismas funciones de validación del servidor** (`utils/routeCatalog.js`) y dice hoja, fila y columna de cada problema.
- **No usa base de datos ni red y no escribe nada.**
- Salida 0 = sin errores; 1 = hay errores; 2 = no se pudo leer el archivo. Los «AVISO» no impiden publicar.
- Rechaza contenido de ejemplo (direcciones `example.org` y similares, o las palabras «ficticio»/«sintético»). `--permitir-ejemplo` solo sirve para probar el archivo de ejemplo.
- Es estricto en una cosa más que el servidor: **cada recurso necesita al menos una ruta** (ver «Fallo conocido»).

Que el validador pase **no** comprueba que el contenido sea verdadero ni que las páginas existan.

## 3. Publicarlo desde Administración

**No hay carga de archivos: cada elemento se copia a mano en la pantalla**, una fila a la vez. Conviene calcular ese tiempo antes de fijar la fecha.

Antes: archivo validado sin errores, y una cuenta con rol `admin` o `superadmin`.

1. Entra y abre **Contenido → Catálogo de rutas**.
2. Pulsa **Crear borrador** (si ya hay uno, **Abrir borrador**). La persona participante no ve nada del borrador.
3. **El borrador nace como copia de la versión publicada.** Si la publicada es la de prueba, abre **cada** elemento marcado como contenido de prueba y pulsa **Quitar elemento**, en las cinco secciones. Comprueba que no quede ninguno antes de seguir.
   - ⚠️ En un entorno con `ALLOW_SYNTHETIC_CATALOG=true` (así está pensado staging) **el servidor no impide publicar una mezcla de datos reales y de prueba**. En un entorno sin esa variable la publicación se rechaza.
   - Como el máximo es de 6 contextos y la versión de prueba ya usa 6, hay que quitarlos antes de añadir los reales.
4. Carga en este orden (las casillas de una ruta salen de lo que ya existe): **Contextos → Fuentes → Roles y rutas → Ofertas → Recursos**. En cada una: **Añadir elemento**, escribe en **Clave estable** la clave de la fila, llena los campos y pulsa **Guardar borrador**.
   - Tareas, barreras y capacidades están **dentro** de cada ruta: **Añadir fila**.
   - Ruta **sin** barreras o **sin** capacidades: añade una fila de esa lista y quítala con **Quitar fila** antes de guardar. Si nunca se toca la lista, la pantalla dirá que faltan datos.
   - Fuente sin país (`NO APLICA` en la plantilla): marca **No aplica país**.
   - En cada recurso marca **al menos un rol** en «Roles vinculados».
   - No cierres la pestaña sin guardar; si aparece «No pudimos verificar el resultado», revisa lo guardado antes de repetir.
5. En la vista de la versión, cada elemento debe decir **Completo** y no debe aparecer «Faltan datos para publicar».
6. Compara el número de elementos por sección con las filas que informó el validador.
7. **Revisar publicación → Publicar esta versión.** Espera «Versión publicada y comprobada.»
8. Con una cuenta de prueba de participante, abre **Catálogo de rutas** y revisa las fichas en español y en inglés.

### Corregir o volver atrás

Una versión publicada **no se puede editar** y no hay botón para restaurar una anterior. Para corregir: **Crear borrador** (copia la vigente), corrige y publica de nuevo; la anterior queda archivada. Si las personas ya habían guardado preferencias o elegido una ruta, cambiar o quitar claves puede hacer que su elección aparezca como «la base cambió» y deban revisarla: **no cambies una clave ya publicada**.

## Fallo conocido del servidor (no se corrige en ES-410)

El servidor y la pantalla permiten publicar un **recurso sin roles vinculados**, pero el cálculo de rutas (`utils/routeEngine.js`) supone que la lista existe y falla con `TypeError` en cuanto hay una ruta candidata. Se reproduce con `calculateRoutes` y un recurso sin `roleKeys`. Hasta que se corrija, **ningún recurso se publica sin al menos un rol**; el validador lo exige.

## Para quien cambie los campos

Las columnas están en `backend/scripts/catalog-template/columns.cjs`. Después de cambiarlas: `npm run catalog:template` y `node --test test/es-410-route-template.test.cjs` (falla si la plantilla guardada no coincide o si se pierde algún campo).
