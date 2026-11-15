import './facilitation/navigation'
import './pilot/navigationGuard'
import './space/navigationGuard'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { rootErrorOptions } from './components/rootErrors'
import { BrowserRouter } from 'react-router-dom'
import { LanguageProvider } from './i18n/LanguageProvider'
import './index.css'
import App from './App.tsx'
import './catalogGuard'
import './compass/navigationGuard'
import './career/navigationGuard'
import './exercises/navigationGuard'
import { installRoutePrefetch } from './routePrefetch'

installRoutePrefetch() // ES-197: precarga de rutas probables (cursor/foco y reposo); respeta saveData

createRoot(document.getElementById('root')!, rootErrorOptions).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
