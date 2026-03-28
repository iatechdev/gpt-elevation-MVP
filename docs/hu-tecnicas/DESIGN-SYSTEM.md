# Elevation — Sistema de Diseño
> Documentado: 28 de marzo de 2026

---

## Filosofía
Estilo Muji / japonés minimalista. Calma, espacio, tipografía elegante. Sin ruido visual. Cada elemento tiene un propósito.

---

## Paleta de colores

### Colores primarios
```css
--elevation-bg:        #f9f9f7;  /* Warm white — fondo principal */
--elevation-surface:   #FAF8F4;  /* Beige suave — cards, modales */
--elevation-border:    #E7E5E4;  /* Borde sutil */
--elevation-border-md: #D6D2C4;  /* Borde medio */
```

### Colores de marca
```css
--elevation-olive:     #6B7D5C;  /* Olive — CTA principal, acciones */
--elevation-olive-lt:  #A8B5A2;  /* Sage — accents secundarios */
--elevation-olive-bg:  #EAF0E6;  /* Badge, fondos sutiles */
```

### Colores de texto
```css
--elevation-text-1:    #1C1917;  /* Texto principal */
--elevation-text-2:    #78716C;  /* Texto secundario */
--elevation-text-3:    #A8A29E;  /* Texto terciario, placeholders */
```

### Colores de acento (IA y sistema)
```css
--elevation-teal:      #0d9488;  /* Mensajes IA, links activos */
--elevation-teal-bg:   #F0FDFA;  /* Fondo suave teal */
--elevation-teal-dark: #065f46;  /* Texto sobre teal-bg */
```

### Colores de estado
```css
--elevation-success:   #059669;  /* Verde éxito */
--elevation-warning:   #92400E;  /* Amarillo advertencia */
--elevation-warning-bg:#FEF3C7;
--elevation-error:     #DC2626;  /* Rojo error */
```

---

## Tipografía

### Fuentes
```css
/* Títulos y logotipo */
font-family: 'Playfair Display', serif;
font-weight: 300 | 400;  /* Nunca bold en títulos */
letter-spacing: 0.05em a 0.25em según contexto;

/* Cuerpo e interfaz */
font-family: 'Inter', sans-serif;
font-weight: 400 | 500 | 600;

/* Mensajes IA y contenido emocional */
font-family: 'Noto Serif', serif;
font-style: italic;
```

### Escala tipográfica
```
10px / 0.625rem  — Labels, badges, microtext (letter-spacing 0.1-0.3em)
11px / 0.6875rem — Texto administrativo pequeño
13px / 0.8125rem — Texto secundario, descripciones
14px / 0.875rem  — Texto de UI (botones, inputs)
16px / 1rem      — Cuerpo principal
18px / 1.125rem  — Cuerpo destacado
22px / 1.375rem  — Títulos de sección
28-48px          — Títulos hero (clamp responsivo)
```

---

## Espaciado
Sistema de 4px base.
```
4px   — 0.25rem  — Espacio mínimo interno
8px   — 0.5rem   — Separación entre elementos relacionados
12px  — 0.75rem  — Padding de badges y chips
16px  — 1rem     — Padding estándar
20px  — 1.25rem  — Padding de headers
24px  — 1.5rem   — Separación de secciones pequeñas
32px  — 2rem     — Padding de cards y paneles
48px  — 3rem     — Separación de secciones
80px  — 5rem     — Separación de secciones grandes (landing)
```

---

## Bordes y radios
```css
border: 0.5px solid var(--elevation-border);  /* Borde estándar ultra-fino */
border: 1px solid var(--elevation-border);    /* Borde activo */
border: 1.5px solid var(--elevation-olive);  /* Borde seleccionado */

border-radius: 0.5rem;    /* 8px — Elementos pequeños: badges, inputs */
border-radius: 0.75rem;   /* 12px — Botones, cards pequeñas */
border-radius: 1rem;      /* 16px — Cards medianas, modales */
border-radius: 1.25rem;   /* 20px — Modales principales */
border-radius: 50%;       /* Círculos: emojis, avatares */
border-radius: 9999px;    /* Pills: badges de estado */
```

---

## Sombras
Elevation usa sombras muy sutiles — casi transparentes.
```css
/* Sombra estándar — cards en chat */
box-shadow: 0 2px 12px rgba(26,28,27,0.06);

/* Sombra panel admin */
box-shadow: 0 0 60px rgba(0,0,0,0.08);

/* Sin sombras fuertes ni drop-shadows agresivos */
```

---

## Componentes definidos

### Botón primario
```css
background: #6B7D5C;
color: #FAF8F4;
border: none;
border-radius: 0.85rem;
padding: 0.85rem 2rem;
font-family: Inter;
font-size: 0.95rem;
font-weight: 500;
cursor: pointer;
/* Hover: opacity 0.88 */
```

### Botón secundario
```css
background: transparent;
color: #6B7D5C;
border: 0.5px solid #A8B5A2;
border-radius: 0.85rem;
padding: 0.85rem 2rem;
```

### Botón deshabilitado
```css
background: #E7E5E4;
color: #A8A29E;
cursor: not-allowed;
```

### Badge de estado
```css
/* Activo */
background: #F0FDFA; color: #065f46;
/* Pendiente */
background: #FEF3C7; color: #92400E;
/* Error */
background: #FEF2F2; color: #DC2626;
border-radius: 9999px;
padding: 0.2rem 0.75rem;
font-size: 11px; font-weight: 500;
```

### Input / Textarea
```css
border: 0.5px solid #D6D2C4;
border-radius: 0.5rem;
background: #FAF8F4;
padding: 0.6rem 0.75rem;
font-family: Inter;
font-size: 13px;
color: #1C1917;
outline: none;
/* Focus: border-color: #6B7D5C */
```

### Card
```css
background: #FAF8F4;
border: 0.5px solid #D6D2C4;
border-radius: 1rem;
padding: 2rem;
```

### Header sticky
```css
background: rgba(249,249,247,0.85);
backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(231,229,228,0.5);
position: fixed; top: 0; z-index: 50;
```

---

## Layout del backoffice (Sprint 4)

### Estructura
```
┌─────────────────────────────────────────┐
│  HEADER: Logo | Nombre admin | Logout   │  60px fijo
├──────────┬──────────────────────────────┤
│          │                              │
│ SIDEBAR  │   CONTENIDO PRINCIPAL        │
│ 240px    │   flex-1                     │
│          │                              │
│ • Dashboard    │                        │
│ • Prompts      │                        │
│ • Contenido    │                        │
│ • Usuarios     │                        │
│ • Métricas     │                        │
│          │                              │
└──────────┴──────────────────────────────┘
```

### Colores backoffice
El backoffice usa la misma paleta pero con fondo ligeramente diferente para distinguirlo visualmente del área de usuarios:
```css
--admin-bg:      #F5F3EF;  /* Fondo admin — más warm */
--admin-sidebar: #EDEAE4;  /* Sidebar — tono más oscuro */
--admin-header:  rgba(245,243,239,0.9);
```

---

## Iconografía
Iconos SVG inline — sin librerías de iconos para mantener el bundle pequeño.
- Stroke-width: 1.5 (nunca 2 o más — demasiado pesado)
- Size estándar: 16px (UI) | 20px (acciones) | 24px (ilustrativos)
- Color: heredado del texto (currentColor)

---

## Responsive
```
Mobile:  < 640px  — Stack vertical, padding 1rem
Tablet:  640-1024px — Grid adaptable
Desktop: > 1024px  — Layout completo
```

El backoffice es principalmente **desktop** — los admins trabajan desde computadora.
El área de usuarios (landing, chat) debe funcionar perfectamente en **mobile**.

---
*Documentado: 28 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
