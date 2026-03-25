# HU-043 — Gestión de imágenes y videos en landing desde backoffice

> Sprint 4 | Must Have | 8 puntos  
> Documentada: 24 de marzo de 2026  
> Aprobada por Mauro Roldán

---

## Contexto y decisión arquitectónica

Esta HU fue separada de HU-039 intencionalmente para evitar deuda técnica.
Gestionar medios (imágenes/videos) requiere decisiones de infraestructura de storage que impactan el proyecto a largo plazo. Se toma el tiempo necesario en Sprint 4 para hacerlo bien desde el inicio.

---

## Descripción

Como superadmin, quiero poder subir, reemplazar y gestionar las imágenes y videos de la landing pública desde el panel de administración, sin necesidad de hacer deploy. Los medios deben servirse desde un CDN para garantizar performance.

---

## Análisis de opciones de storage

### Opción A — Cloudinary ⭐ Recomendada

| Aspecto | Detalle |
|---|---|
| Plan gratuito | 25GB storage + 25GB bandwidth/mes |
| Upload | SDK directo desde frontend o backend |
| Transformaciones | Resize, crop, format automático |
| CDN | Global, incluido |
| Integración | npm cloudinary — simple |
| Escalabilidad | Alta — planes de pago bien estructurados |

**Flujo:**
```
Admin sube imagen → Cloudinary SDK → URL guardada en BD → Landing consume URL
```

### Opción B — Google Cloud Storage

| Aspecto | Detalle |
|---|---|
| Integración | Nativa con Cloud Run |
| Costo | ~$0.02/GB/mes |
| CDN | Requiere Cloud CDN adicional |
| Complejidad | Alta — service account + IAM + bucket |
| Escalabilidad | Muy alta |

**Recomendación:** evaluar si ya se tiene GCS configurado. Si no, Cloudinary es más rápido de implementar.

### Opción C — Uploadcare

| Aspecto | Detalle |
|---|---|
| Plan gratuito | 3GB storage |
| UI | Widget de upload listo |
| CDN | Global |
| Video | Soporte nativo |

---

## Medios a gestionar

| Slot | Tipo | Ubicación en landing | Dimensiones recomendadas |
|---|---|---|---|
| `hero_image` | Imagen | Hero — columna derecha | 800x600px mínimo |
| `hero_video` | Video (opcional) | Hero — reemplaza imagen | MP4, max 30s |
| `og_image` | Imagen | Meta tags Open Graph | 1200x630px |
| `favicon` | Imagen | Browser tab | 32x32px, 64x64px |

---

## Base de datos

### Extender `LandingContent` con soporte de medios

```sql
-- Agregar columna type a LandingContents
ALTER TABLE LandingContents ADD COLUMN type VARCHAR(20) DEFAULT 'text';
-- type: 'text' | 'image' | 'video'

-- Agregar columna metadata para info del medio
ALTER TABLE LandingContents ADD COLUMN metadata JSONB;
-- metadata: { url, publicId, width, height, format, size }
```

### O tabla separada `LandingMedia`

```sql
CREATE TABLE LandingMedia (
  id          SERIAL PRIMARY KEY,
  slot        VARCHAR(50) NOT NULL UNIQUE,  -- 'hero_image', 'og_image', etc.
  url         TEXT NOT NULL,
  public_id   VARCHAR(200),                 -- ID en Cloudinary/GCS
  provider    VARCHAR(20) DEFAULT 'cloudinary',
  width       INTEGER,
  height      INTEGER,
  format      VARCHAR(10),
  size_bytes  INTEGER,
  updated_by  VARCHAR(100),
  updated_at  TIMESTAMP DEFAULT NOW()
);
```

---

## API

```
POST /api/landing-media/upload     → sube imagen/video, retorna URL
GET  /api/landing-media            → retorna todos los slots con sus URLs actuales
DELETE /api/landing-media/:slot    → elimina medio de un slot
```

### POST /api/landing-media/upload
- Solo superadmin
- Multipart form data
- Valida tipo (image/video) y tamaño (max 10MB imágenes, 50MB videos)
- Sube a Cloudinary/GCS
- Guarda URL y metadata en BD
- Retorna URL pública

---

## Frontend — AdminPage

- Nueva sección `"Medios Landing"` en panel admin
- Un card por slot con preview de la imagen actual
- Botón `"Cambiar imagen"` → file picker → upload → preview actualizado
- Soporte drag & drop
- Progress bar durante upload
- Validación de dimensiones mínimas

---

## Frontend — LandingPage

```tsx
// Consume /api/landing-media al montar
// Fallback: usa UNSPLASH_URL hardcodeado si la API falla
const heroImage = landingMedia?.hero_image?.url ?? UNSPLASH_URL
```

---

## Tareas Sprint 4

- [ ] Evaluar y decidir provider: Cloudinary vs GCS
- [ ] Configurar cuenta y credenciales
- [ ] Crear modelo `LandingMedia`
- [ ] Endpoint upload con validación
- [ ] Integrar SDK del provider en backend
- [ ] UI de gestión de medios en admin
- [ ] Consumo en LandingPage con fallback
- [ ] Documentar variables de entorno nuevas
- [ ] Configurar en Cloud Run

---

## Variables de entorno requeridas (pendiente de decisión)

### Si Cloudinary:
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### Si Google Cloud Storage:
```
GCS_BUCKET_NAME=
GCS_PROJECT_ID=
GOOGLE_APPLICATION_CREDENTIALS=
```

---

## Decisión pendiente para Sprint 4

Antes de arrancar esta HU, Mauro Roldán debe confirmar:
1. ¿Cloudinary o Google Cloud Storage?
2. ¿Se incluye soporte de video en MVP o solo imágenes?
3. ¿Se necesita CDN global o Colombia es suficiente?

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
