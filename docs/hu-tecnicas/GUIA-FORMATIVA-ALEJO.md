# Guía Formativa — Elevation MVP
## Para Alejo Roldán — Desarrollador del equipo
> Documentado: 30 de marzo de 2026
> Autor: Claude (Tech Lead AI) + Mauro Roldán

---

## ¿Para qué sirve este documento?

Este documento existe para que Alejo pueda entender el proyecto Elevation desde adentro — no solo el código, sino el razonamiento detrás de cada decisión. Aquí se explica qué construimos, por qué lo construimos así, y cómo pensar sobre los problemas que van a aparecer.

La idea es que después de leer esto, Alejo pueda:
- Entender cualquier archivo del repo sin necesidad de explicación
- Tomar decisiones técnicas alineadas con la arquitectura existente
- Contribuir al producto con el mismo criterio con que fue construido

---

## 1. ¿Qué es Elevation?

Elevation es una aplicación web de apoyo emocional con inteligencia artificial. Los usuarios pueden:
1. Hacer un **check-in emocional** antes de cada sesión (¿cómo llegás hoy?)
2. **Chatear** con una IA empática llamada Elevation
3. Hacer un **check-out emocional** al cerrar (¿cómo te vas?)
4. **Calificar** la sesión con estrellas

El objetivo del producto es que las personas tengan un espacio privado, accesible y sin juicios para procesar sus emociones. No es un reemplazo de la terapia — es un acompañante cotidiano.

---

## 2. ¿Quiénes usan Elevation?

Hay cuatro tipos de usuarios y cada uno ve una pantalla diferente:

### Usuario regular (`user`)
El usuario final del producto. Hace check-in, chatea con la IA, hace check-out.
- Accede a: `/app/checkin` y `/app/chat`
- No ve ningún panel de administración

### Administrador (`admin`)
Un miembro del equipo interno que puede proponer cambios al prompt de la IA.
- Puede proponer nuevas versiones del prompt de Elevation
- NO puede aprobar sus propios cambios — eso requiere un superadmin
- Ve el panel admin en el chat (ícono de llave)

### Superadministrador (`superadmin`)
El rol con más poder del sistema. Puede hacer todo lo que hace el admin más:
- Aprobar o rechazar versiones de prompts propuestas por admins
- Editar el contenido de texto de la landing pública
- Ver métricas del sistema
- Gestionar usuarios

### Terapeuta (`therapist`) — Sprint 4
Un nuevo rol específico del producto de salud mental:
- Ve los pacientes que le fueron asignados
- Puede ver el historial emocional (check-ins y check-outs) de sus pacientes
- Genera reportes de progreso emocional
- NO tiene acceso al panel técnico de administración

---

## 3. ¿Cómo está construido técnicamente?

### Frontend — React + TypeScript + Vite
El frontend es una SPA (Single Page Application) construida en React. Usa TypeScript para tener tipado estático y Vite como bundler.

**¿Por qué React y no Next.js o Vue?**
Porque para un MVP la complejidad de Next.js (SSR, rutas de archivo) no era necesaria. React puro con React Router v6 es suficiente y más simple de mantener.

**Estructura de páginas:**
- `LandingPage.tsx` — la página pública `/`
- `LoginPage.tsx` — login y registro
- `CheckinPage.tsx` — el check-in emocional obligatorio
- `ChatPage.tsx` — el chat + el panel admin integrado
- `PricingPage.tsx` — la página de precios

**Sistema de idiomas (i18n):**
Elevation es bilingüe ES/EN. Se implementó sin librerías externas (sin i18next) para mantener el bundle pequeño. Funciona así:
- `LanguageProvider.tsx` guarda el idioma en `localStorage`
- `useLanguage.ts` es el hook que cualquier componente usa para obtener traducciones
- `es.ts` y `en.ts` son los archivos de textos

**BreathingBackground:**
El fondo animado con círculos que "respiran" está en `BreathingBackground.tsx`. Usa la Canvas API del browser directamente — sin librerías de animación. Es un componente frágil: si se borra o corrompe, hay que pegar el código completo de nuevo.

### Backend — Express + Sequelize + PostgreSQL
El backend es un servidor Express (Node.js) que expone una API REST. Sequelize es el ORM que traduce código JavaScript a queries SQL.

**¿Por qué Express y no NestJS o Fastify?**
Express es simple, bien conocido, y para un MVP no necesitamos la estructura opinada de NestJS. La deuda técnica de escalar Express a NestJS es manejable cuando el producto lo requiera.

**Modelos de base de datos:**
- `User` — usuarios con roles y control de intentos de login
- `Message` — mensajes del chat, encriptados en AES-256-CBC
- `PromptVault` — versiones del prompt de la IA, con flujo de aprobación
- `MoodLog` — registros de check-in y check-out emocional por día
- `SessionRating` — calificaciones de sesión (1-5 estrellas)
- `LandingContent` — textos editables de la landing en ES y EN

### Base de datos — PostgreSQL en Google Cloud SQL
PostgreSQL es la base de datos relacional. Corre en Google Cloud SQL conectada al servidor en Cloud Run. Sequelize sincroniza los modelos automáticamente con `sync({ alter: true })` — eso significa que si agregás un campo nuevo al modelo, Sequelize lo agrega a la tabla sin borrar datos.

### Deploy — Google Cloud Run
El servidor corre en un contenedor Docker en Google Cloud Run. El proceso de deploy es:
1. Se hace `npm run build` en el frontend → genera `frontend/dist/`
2. El `Dockerfile` copia todo el proyecto, instala dependencias del backend, hace el build del frontend, y expone el puerto 8080
3. Express sirve el frontend compilado como archivos estáticos desde `frontend/dist/`
4. Todas las rutas que no son `/api/...` las maneja el `index.html` del frontend (SPA routing)

---

## 4. El sistema de prompts — el corazón de Elevation

Esto es lo más importante de entender porque es lo que hace que la IA se comporte bien.

### ¿Qué es un prompt de sistema?
Cuando el usuario escribe en el chat, el backend no solo manda ese mensaje a la IA. Primero le manda un "prompt de sistema" — un texto que le dice a la IA cómo debe comportarse. Ese texto define la personalidad, el tono, y los límites de Elevation.

### ¿Por qué tiene versionado y aprobación?
Porque el prompt define el comportamiento de la IA con usuarios reales que buscan apoyo emocional. Un cambio descuidado podría hacer que la IA responda mal. Por eso existe el flujo:

```
Admin edita prompt → propone cambio → Superadmin revisa → aprueba o rechaza
```

Si el superadmin aprueba, la nueva versión se activa inmediatamente en producción.
Si rechaza, puede dejar una nota explicando por qué.
Si algo sale mal, se puede hacer rollback a cualquier versión anterior.

### ¿Cómo está encriptado?
El contenido del prompt está encriptado con AES (librería CryptoJS) usando una clave que solo existe en las variables de entorno del servidor. Esto significa que aunque alguien acceda directamente a la base de datos, no puede leer el prompt.

---

## 5. Seguridad — decisiones que tomamos

### Encriptación de mensajes del chat
Cada mensaje que el usuario escribe y cada respuesta de la IA se guarda encriptado en la BD con AES-256-CBC. La clave de encriptación viene de la variable de entorno `DB_PASS`. Si alguien accede a la BD, solo ve texto cifrado.

### Login seguro
Implementamos tres capas de seguridad en el login:
1. **Mensaje genérico** — siempre dice "Credenciales incorrectas" sin importar si el email existe o no (evita que alguien descubra qué emails están registrados)
2. **Rate limiting** — máximo 10 intentos por minuto por IP
3. **Bloqueo de cuenta** — después de 3 intentos fallidos, la cuenta se bloquea 15 minutos

### JWT (JSON Web Tokens)
El sistema de autenticación usa JWT. Cuando el usuario hace login, el servidor genera un token firmado que contiene el ID del usuario, su nombre y su rol. Ese token vive en `localStorage` del browser y se manda en cada request al backend en el header `Authorization: Bearer <token>`.

---

## 6. El flujo completo de una sesión de usuario

Esto es lo que pasa técnicamente cuando un usuario usa Elevation:

```
1. Usuario abre / (LandingPage)
   → Fetch a /api/landing-content?lang=es para obtener textos editables
   → Renderiza con BreathingBackground animado

2. Usuario hace click en "Iniciar conversación"
   → Navega a /login

3. Usuario ingresa email y password
   → POST /api/login
   → Servidor verifica bcrypt, genera JWT
   → Frontend guarda token, name, role en localStorage
   → Navega a /app/checkin

4. Usuario selecciona su estado de ánimo en CheckinPage
   → POST /api/mood/checkin con { mood: 3 }
   → Guarda en MoodLogs con fecha de hoy
   → Navega a /app/chat

5. Usuario chatea
   → POST /api/chat con { message: "..." }
   → Backend encripta mensaje y guarda en Messages
   → Backend llama a Anthropic API con el prompt activo + mensaje del usuario
   → Respuesta de IA se encripta y guarda en Messages
   → Frontend muestra respuesta

6. Usuario cierra sesión
   → Abre modal de check-out
   → Selecciona emoji de cómo se va + estrellas opcionales
   → POST /api/mood/checkout con { mood: 4 }
   → POST /api/rating con { rating: 5 } (si seleccionó estrellas)
   → Se borra el token del localStorage
   → Navega a /login
```

---

## 7. Patrones de código que vas a ver en todo el proyecto

### apiFetch — el helper de requests autenticados
En `ChatPage.tsx` hay una función `apiFetch` que todos los requests al backend usan:
```js
async function apiFetch(path, token, options) {
  return fetch(`${BACKEND}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  })
}
```
Siempre verifica `res.ok` antes de usar los datos.

### Verificar siempre res.ok en el frontend
Un error común es asumir que si la API responde, respondió bien. Siempre:
```js
const res = await apiFetch('/api/algo', token, { method: 'POST', body: ... })
if (!res.ok) {
  const error = await res.json()
  // manejar error
  return
}
const data = await res.json()
```

### Middlewares de autorización en el backend
Cada endpoint del backend está protegido por uno de estos tres middlewares:
- `verificarToken` — cualquier usuario autenticado
- `verificarAdmin` — solo admin o superadmin
- `verificarSuperAdmin` — solo superadmin

Siempre preguntarse: ¿quién puede llamar este endpoint? Y usar el middleware correcto.

### upsert en lugar de create cuando es un registro por día
MoodLog tiene un registro por usuario por día. Se usa `upsert` (crear si no existe, actualizar si existe) para evitar duplicados:
```js
await MoodLog.upsert({
  UserId: userId,
  date: today,
  checkin_mood: mood,
})
```

---

## 8. Errores comunes y cómo evitarlos

### Error: BreathingBackground vacío
Este archivo se ha corrompido en sesiones anteriores de edición. Si la landing aparece en blanco con un error de export, el archivo está vacío. Solución: pegar el código completo del componente de nuevo.

### Error: imports sin extensión .tsx en Vite
Vite en Windows a veces no resuelve imports sin extensión. Siempre escribir:
```js
import { BreathingBackground } from '../components/BreathingBackground.tsx'
// NO: import { BreathingBackground } from '../components/BreathingBackground'
```

### Error: npm install sin --legacy-peer-deps
Hay un conflicto de dependencias entre `vite@8` y `@tailwindcss/vite@4.2.1`. Siempre instalar con:
```bash
npm install --legacy-peer-deps
```

### Error: variables de entorno no cargadas
El backend usa `dotenv`. Si una variable de entorno falta, el servidor puede fallar silenciosamente. Siempre verificar que el archivo `backend/.env` existe y tiene todas las variables requeridas.

---

## 9. Por qué el humano siempre debe estar en el loop — la lección más importante del proyecto

Esta es probablemente la sección más importante de toda la guía. No habla de código — habla de cómo pensar el desarrollo de software con IA en 2026.

### El error más común al trabajar con IA: delegar el pensamiento

Cuando empezás a trabajar con herramientas de IA como Claude, la tentación más grande es pedirle que resuelva todo de forma autónoma. "Encontrá el bug y arreglalo." "Construí el backoffice." "Migrá la base de datos."

Y la IA puede hacerlo. Técnicamente tiene la capacidad. El problema no es si puede — el problema es si *debe*.

El desarrollo de software no es solo escribir código que funcione. Es tomar decisiones que tienen consecuencias en el tiempo, en los datos de usuarios reales, en la arquitectura del sistema. Esas decisiones requieren contexto del negocio, criterio humano, y comprensión del producto que ninguna IA tiene de forma completa.

### El ejemplo real: BUG-001 — cómo la conversación salvó el proyecto

En el Sprint 4, Mauro reportó un bug: cuando un admin proponía un cambio de prompt, el superadmin no lo veía. El flujo parecía roto.

La respuesta automática de una IA sin supervisión humana hubiera sido: **analizar el código, encontrar dónde falla la lógica, y proponer un fix en el código.**

Y efectivamente, Claude analizó el código y encontró patrones que *podrían* ser problemáticos:
- Una variable declarada pero no usada en `proposePrompt()`
- La posibilidad de que `res.ok` no se estuviera verificando en el frontend
- Un posible conflicto de rutas en Express

Con esa información, Claude hubiera generado automáticamente cambios en `promptVault.js`, en `server.js`, y en `ChatPage.tsx`. Tres archivos modificados, decenas de líneas cambiadas.

**Pero eso hubiera sido un error grave.**

¿Por qué? Porque el código nuevo estaba perfectamente bien. No había ningún bug en la lógica nueva. El problema real era completamente diferente: los datos viejos en la base de datos tenían el campo `status` en NULL, mientras el código nuevo esperaba encontrar `status: 'active'`.

La solución correcta fue **una sola línea de SQL** que migró los datos viejos:

```sql
UPDATE "PromptVaults"
SET status = 'active'
WHERE "isActive" = true
AND (status IS NULL OR status = '');
```

Sin tocar ni una sola línea de código.

### ¿Cómo se llegó a esa solución? Con conversación, no con automatización.

El proceso fue así:

1. Mauro describió el bug en lenguaje natural a Claude
2. Claude leyó el código y propuso varias hipótesis
3. **Mauro pensó sobre esas hipótesis** y se preguntó: "¿pero si cambiamos el código, no rompemos lo que ya funciona?"
4. Esa pregunta llevó a entender que el problema no era el código sino los datos
5. Claude propuso la migración de BD como solución limpia
6. Mauro la ejecutó y verificó que funcionaba

En ningún momento Claude actuó solo. Cada paso fue una conversación donde el humano aportó el criterio de negocio, la memoria del historial del sistema, y la pregunta correcta que redirigió el análisis.

### Qué hubiera pasado con automatización total

Si el proceso hubiera sido completamente automatizado — Claude detecta el bug, Claude genera el fix, Claude hace el commit — esto es lo que probablemente hubiera ocurrido:

- Se hubieran modificado tres archivos de código que estaban correctos
- Se hubiera introducido complejidad innecesaria para manejar casos que ya estaban bien manejados
- Los cambios hubieran pasado a producción con una falsa sensación de que el problema estaba resuelto
- El bug real (los datos viejos en la BD) seguiría existiendo
- Y ahora además tendríamos código más complejo y difícil de mantener

Esto en un sistema de salud mental con usuarios reales que confían sus emociones a la plataforma. El costo de ese error hubiera sido real.

### La regla que seguimos en Elevation

En este proyecto trabajamos con dos instancias de Claude que tienen roles muy diferentes:

**Claude.ai — el Tech Lead**
Es donde ocurre el pensamiento. Se analiza el problema, se debaten las hipótesis, se toman decisiones de arquitectura, se define *qué* hacer y *por qué*. Mauro aporta el contexto del negocio y la visión del producto. Claude aporta el conocimiento técnico y el análisis del código. Juntos llegan a la solución correcta.

**Claude Code — el ejecutor**
Solo actúa después de que Claude.ai y Mauro ya tomaron la decisión. Recibe instrucciones concretas, acotadas y ya validadas. "Ejecutá este script de migración." "Aplicá este cambio específico en este archivo." Nunca decide por su cuenta qué cambiar ni cómo.

La regla es simple: **Claude Code nunca toma decisiones, solo ejecuta decisiones que ya fueron tomadas.**

### Por qué este modelo es el correcto en 2026

El desarrollo de software con IA está en un punto donde las herramientas son increíblemente capaces pero todavía requieren supervisión humana activa. No porque sean poco confiables, sino porque:

**El código vive en un contexto que la IA no conoce completamente.** La IA puede leer el código, pero no estuvo en la reunión donde se decidió la arquitectura, no sabe qué compromisos se hicieron con el cliente, no conoce qué partes son frágiles por la historia del proyecto.

**Los errores de software tienen consecuencias reales.** En Elevation, los usuarios comparten sus emociones más vulnerables. Un bug en el sistema de prompts podría hacer que la IA responda de forma inapropiada a alguien en un momento difícil. Eso no es un error de software — es un error humano.

**La IA optimiza para lo que puede medir, no para lo que importa.** Una IA autónoma puede generar código que pasa todos los tests y aun así ser la solución incorrecta para el problema de negocio. Solo un humano que entiende el producto puede distinguir entre las dos.

### Lo que esto significa para vos como desarrollador

Tu rol en el equipo no es ser el que escribe código — las IAs pueden hacer eso. Tu rol es ser el que *entiende* el producto, *cuestiona* las soluciones propuestas, y *decide* qué cambios son correctos.

Cuando Claude proponga una solución, la pregunta más valiosa que podés hacer es: **"¿Es esto realmente necesario?"**

Muchas veces la respuesta va a revelar una solución más simple, más limpia, y más respetuosa con el código que ya existe.

Eso es pensar como senior developer — con o sin IA.

---

## 10. Estado actual del proyecto — Marzo 2026

### Sprint 3 — CERRADO ✅ (36/36 puntos)
Todo el Sprint 3 fue completado exitosamente:
- Landing pública con diseño Muji y fondo animado
- Sistema bilingüe ES/EN completo
- Seguridad de login mejorada
- Gestión de contenido landing desde backoffice
- Página de precios
- Check-out emocional con persistencia en BD
- Calificación con estrellas

### BUG-001 — RESUELTO ✅
El flujo de propuesta/aprobación de prompts tenía un problema: los registros viejos en la BD tenían `isActive: true` pero `status: NULL`. Se resolvió con una migración directa en BD — sin tocar el código. Ver `BUG-001-prompt-versions-superadmin.md` para el detalle completo.

### Sprint 4 — EN PLANIFICACIÓN
Las próximas HUs del Sprint 4 incluyen:
- Refactor del backoffice a rutas `/admin` dedicadas con sidebar
- Gestión de usuarios desde el backoffice
- Nuevo rol `therapist` con dashboard de pacientes
- Dashboard de métricas ejecutivas
- Gestión de imágenes y videos en la landing

---

## 11. Recursos y enlaces importantes

- **Repositorio principal:** `github.com/iatechdev/gpt-elevation-MVP`
- **Rama de desarrollo:** `feature/mvp-elevation`
- **Rama de documentación:** `main → docs/hu-tecnicas/`
- **URL de producción:** `https://elevation-ia-747531656650.us-central1.run.app`
- **Proyecto GCP:** `elevation-490611`
- **Modelo de IA en producción:** `claude-3-haiku-20240307`

---

## Mensaje final para Alejo

Este proyecto fue construido con mucho cuidado en cada decisión. Cada línea de código tiene un motivo, cada arquitectura tiene un porqué. Cuando no entiendas algo, la pregunta correcta no es "¿qué hace este código?" sino "¿por qué se decidió hacerlo así?". La respuesta probablemente está en los documentos de `docs/hu-tecnicas/`.

Las herramientas de IA son increíblemente poderosas. Pero su poder se multiplica cuando hay un humano que piensa, cuestiona y decide. Ese humano sos vos.

Si algo no está documentado y lo entendés, documentalo vos. La documentación es parte del trabajo, no un extra.

Bienvenido al equipo. 🌿

---
*Documentado: 30 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
