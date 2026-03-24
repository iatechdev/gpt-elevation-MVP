# HU-041 — Soporte bilingüe ES / EN

> Sprint 3 | Must Have (promovido desde Nice to Have) | 5 puntos  
> Aprobada por Mauro Roldán — 24 marzo 2026

---

## Descripción

Como usuario, quiero poder usar Elevation en español o inglés, con un switcher visible en todas las pantallas, sin recargar la página.

---

## Decisión técnica

Implementación **sin librería externa** (sin i18next para el MVP). Sistema propio con:
- Archivos de textos en `src/i18n/es.ts` y `src/i18n/en.ts`
- Contexto React `LanguageContext` con `lang` + `setLang` + función `t(key)`
- Persistencia en `localStorage` (recuerda el idioma elegido)
- Detección automática del idioma del browser en primer acceso

---

## Criterios de aceptación

- [ ] Switcher ES/EN visible en topbar de todas las pantallas
- [ ] Cambio de idioma instantáneo sin reload
- [ ] Idioma persiste entre sesiones (localStorage)
- [ ] Primer acceso: detecta idioma del browser, default ES si no es EN
- [ ] Todas las pantallas cubiertas: Landing, Login, Check-in, Chat, Precios, Admin
- [ ] Sin textos hardcodeados en los componentes (todo via `t(key)`)
- [ ] Keys faltantes muestran el key mismo como fallback (no rompen)

---

## Estructura de archivos

```
frontend/src/
└── i18n/
    ├── es.ts          ← todos los textos en español
    ├── en.ts          ← todos los textos en inglés
    ├── types.ts       ← type TranslationKey (union de todas las keys)
    └── context.tsx    ← LanguageContext + useLanguage hook
```

---

## Implementación

### context.tsx

```tsx
import { createContext, useContext, useState } from 'react'
import es from './es'
import en from './en'

const translations = { es, en }
type Lang = 'es' | 'en'

const LanguageContext = createContext<{
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}>(null!)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const saved = localStorage.getItem('elv_lang') as Lang
  const browser = navigator.language.startsWith('en') ? 'en' : 'es'
  const [lang, setLangState] = useState<Lang>(saved || browser)

  function setLang(l: Lang) {
    setLangState(l)
    localStorage.setItem('elv_lang', l)
  }

  function t(key: string): string {
    return translations[lang][key] ?? key
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
```

### Uso en componentes

```tsx
const { t, lang, setLang } = useLanguage()

// Textos
<h1>{t('hero_title')}</h1>

// Switcher
<button onClick={() => setLang('es')} className={lang==='es' ? 'active' : ''}>ES</button>
<button onClick={() => setLang('en')} className={lang==='en' ? 'active' : ''}>EN</button>
```

---

## Keys requeridas (mínimo Sprint 3)

```ts
// Landing
hero_badge, hero_title, hero_subtitle, cta_primary, cta_secondary
step1_title, step1_desc, step2_title, step2_desc, step3_title, step3_desc
cta_final_title, cta_final_subtitle, disclaimer

// Login
login_title, login_subtitle, label_email, label_password, btn_login, link_register

// Check-in
checkin_title, checkin_subtitle, btn_continue
emo_1, emo_2, emo_3, emo_4, emo_5  ← labels de emociones

// Chat
chat_placeholder, btn_logout

// Precios
pricing_title, pricing_subtitle
plan_free_name, plan_free_price, plan_pro_name, plan_pro_price
btn_start_free, btn_start_pro

// Errores
err_credentials, err_rate_limit, err_locked
```

---

## Archivos a crear

```
frontend/src/i18n/es.ts
frontend/src/i18n/en.ts
frontend/src/i18n/types.ts
frontend/src/i18n/context.tsx
```

## Archivos modificados

```
frontend/src/main.tsx          ← envolver con <LanguageProvider>
Todos los Page components      ← reemplazar strings hardcodeados por t(key)
```

---

## Definición de hecho

- [ ] Switcher visible y funcional en todas las pantallas
- [ ] Sin una sola string hardcodeada en componentes (excepto el logo)
- [ ] Cambio de idioma no recarga ni pierde estado
- [ ] `localStorage` guarda la preferencia
- [ ] TypeScript no tiene errores de tipo en las keys

---
*Documentado: 24 de marzo de 2026 — Claude (Tech Lead AI) + Mauro Roldán*
