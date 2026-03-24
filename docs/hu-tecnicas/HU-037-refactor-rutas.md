# HU-037 — Refactor de rutas con React Router

> Sprint 3 | Must Have | 5 puntos  
> Aprobada por Mauro Roldán — 24 marzo 2026

---

## Descripción

Como equipo técnico, necesitamos separar la landing pública de la app protegida usando React Router v6, para que los usuarios nuevos lleguen a `/` y los usuarios autenticados accedan a `/app`.

---

## Arquitectura de rutas

```
/                   → LandingPage          (pública, sin auth)
/login              → LoginPage            (pública)
/app                → AppLayout            (protegida — requiere JWT válido)
/app/checkin        → CheckinPage          (protegida)
/app/chat           → ChatPage             (protegida)
/admin              → AdminPage            (protegida — requiere role admin|superadmin)
```

---

## Criterios de aceptación

- [ ] `react-router-dom` v6 instalado
- [ ] `BrowserRouter` en `main.tsx`
- [ ] Rutas públicas (`/`, `/login`) accesibles sin token
- [ ] Rutas `/app/*` redirigen a `/login` si no hay JWT válido en localStorage
- [ ] Ruta `/admin` redirige a `/login` si no hay JWT con role admin o superadmin
- [ ] Navegación entre pantallas sin recarga de página
- [ ] `BreathingBackground` disponible en todas las rutas (ver HU-042)
- [ ] El estado de autenticación se lee desde `localStorage` o contexto global

---

## Implementación

### Estructura de archivos

```
frontend/src/
├── main.tsx                         ← BrowserRouter aquí
├── App.tsx                          ← Routes + layouts
├── components/
│   ├── BreathingBackground.tsx      ← fondo animado compartido
│   ├── ProtectedRoute.tsx           ← guard JWT
│   └── AdminRoute.tsx               ← guard role
├── pages/
│   ├── LandingPage.tsx
│   ├── LoginPage.tsx
│   ├── CheckinPage.tsx
│   ├── ChatPage.tsx
│   └── AdminPage.tsx
└── i18n/
    ├── es.ts
    └── en.ts
```

### ProtectedRoute (lógica)

```tsx
// Verifica que exista token válido en localStorage
// Si no hay token → <Navigate to="/login" replace />
// Si hay token → renderiza children
```

### AdminRoute (lógica)

```tsx
// Verifica token + decodifica role
// Si role !== 'admin' && role !== 'superadmin' → <Navigate to="/login" replace />
// Si es admin → renderiza children
```

### App.tsx estructura

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/app" element={<ProtectedRoute />}>
      <Route path="checkin" element={<CheckinPage />} />
      <Route path="chat" element={<ChatPage />} />
    </Route>
    <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
  </Routes>
</BrowserRouter>
```

---

## Migración desde el App.tsx actual

El `App.tsx` actual maneja todo el estado en un solo componente (login, checkin, chat, admin) con condicionales. La migración implica:

1. Extraer cada pantalla a su propio archivo en `pages/`
2. Mover el estado de autenticación a un contexto o localStorage
3. Reemplazar los condicionales de render por rutas
4. Mantener toda la lógica de negocio (JWT decode, check-in status, etc.)

---

## Definición de hecho

- [ ] `npm run build` sin errores TypeScript
- [ ] Navegar directamente a `/app/chat` sin token → redirige a `/login`
- [ ] Navegar directamente a `/admin` sin token admin → redirige a `/login`
- [ ] Refresh en cualquier ruta no rompe la app
- [ ] Back/forward del browser funciona correctamente
- [ ] Cloud Run sirve correctamente SPA (catch-all a `index.html`)

---

## Nota Cloud Run

El servidor Express debe incluir catch-all para servir `index.html` en cualquier ruta no-API:

```js
// backend/server.js — al final, después de todas las rutas API
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'))
})
```

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
