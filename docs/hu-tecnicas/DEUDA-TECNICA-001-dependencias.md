# DT-001 — Deuda Técnica: Conflictos de dependencias frontend

> Documentado: 24 de marzo de 2026  
> Detectado durante: Sprint 3 — HU-037 Refactor de rutas  
> Responsable: Mauro Roldán + Claude (Tech Lead AI)  
> Prioridad: Alta — resolver en Sprint 4 antes de cualquier nuevo deploy productivo

---

## Descripción del problema

Durante la instalación de `react-router-dom` en el Sprint 3 se detectaron conflictos de peer dependencies en el frontend que requirieron el flag `--legacy-peer-deps` para resolverse. Esto indica incompatibilidades entre versiones de paquetes que pueden generar comportamientos impredecibles en producción.

---

## Conflictos detectados

### Conflicto principal
```
npm error Conflicting peer dependency: vite@7.3.1
npm error peer vite@"^5.2.0 || ^6 || ^7" from @tailwindcss/vite@4.2.1
npm error   @tailwindcss/vite@"^4.2.1" from the root project
```

**Causa:** `@tailwindcss/vite@4.2.1` requiere `vite@^5||^6||^7` pero el proyecto tiene `vite@^8.0.0` instalado.

### Estado actual del `package.json`
```json
{
  "dependencies": {
    "@tailwindcss/vite": "^4.2.1",
    "tailwindcss": "^4.2.1",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-icons": "^5.6.0"
  },
  "devDependencies": {
    "vite": "^8.0.0",
    "@vitejs/plugin-react": "^6.0.0",
    "typescript": "~5.9.3"
  }
}
```

### Paquetes instalados con `--legacy-peer-deps` (workaround temporal)
- `react-router-dom` — instalado en Sprint 3, no registrado en `package.json`

---

## Riesgos

| Riesgo | Severidad | Descripción |
|---|---|---|
| Build roto en CI/CD | Alta | Sin `--legacy-peer-deps`, `npm install` falla en Cloud Run |
| Comportamiento impredecible | Media | Versiones incompatibles pueden generar bugs difíciles de reproducir |
| `react-router-dom` no en `package.json` | Alta | Si se regenera `node_modules`, la dependencia se pierde |
| Bloqueo de nuevas dependencias | Media | Cada nueva librería puede generar más conflictos en cadena |

---

## Solución planificada — Sprint 4

### Paso 1 — Registrar `react-router-dom` en `package.json`
```bash
cd frontend
npm install react-router-dom --save --legacy-peer-deps
```

### Paso 2 — Auditar y alinear versiones
Evaluar si bajar `vite` a `^7.x` o actualizar `@tailwindcss/vite` a una versión compatible con `vite@8`.

```bash
npm outdated
npm audit
```

### Paso 3 — Eliminar `react-icons` si no se usa
`react-icons` está en `dependencies` (no `devDependencies`) y pesa ~35MB en `node_modules`. Si solo se usan SVGs inline (como en el proyecto actual), esta dependencia es innecesaria.

### Paso 4 — Limpiar y reinstalar desde cero
```bash
rm -rf node_modules package-lock.json
npm install
```
Sin `--legacy-peer-deps`. Si falla, resolver los conflictos uno a uno.

### Paso 5 — Actualizar Dockerfile
Asegurar que el build de Cloud Run use el mismo lockfile limpio:
```dockerfile
RUN npm ci --legacy-peer-deps
# Cambiar a:
RUN npm ci
```

---

## Política de dependencias — decisión de arquitectura

A partir del Sprint 4, aplicar estas reglas antes de instalar cualquier librería nueva:

1. **Verificar compatibilidad** con las versiones actuales antes de instalar
2. **Preferir cero dependencias** para animaciones, iconos simples y utilidades pequeñas — usar CSS puro y SVG inline
3. **No usar `--legacy-peer-deps`** como solución permanente — solo como workaround temporal documentado
4. **Evaluar el peso** de cada dependencia nueva — bundle size impacta directamente el tiempo de carga en mobile
5. **Librerías de animación** (Framer Motion, GSAP, etc.) — solo si la funcionalidad requerida no se puede lograr con CSS transitions + Canvas API

---

## Librerías a evitar por conflictos conocidos

| Librería | Problema | Alternativa |
|---|---|---|
| `framer-motion` | Peso ~50kb gzip, posibles conflictos con React 19 | CSS transitions + Canvas |
| `@radix-ui/*` | Múltiples sub-paquetes, peer deps complejos | Componentes propios |
| `styled-components` | Incompatible con Vite 8 SSR | CSS inline + Tailwind |

---

## Estado

- [x] Detectado y documentado
- [ ] `react-router-dom` registrado formalmente en `package.json`
- [ ] Conflicto `vite@8` vs `@tailwindcss/vite@4.2.1` resuelto
- [ ] Build limpio sin `--legacy-peer-deps`
- [ ] Dockerfile actualizado

---

*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
