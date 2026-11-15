// ES-232: este catálogo no viaja en el arranque; se registra al evaluarse cualquier módulo que lo use (import con efecto), antes del primer pintado.
import { accessEs, accessEn } from './accessCopy.ts'
import { registerCopy } from '../i18n/lazyCopy.ts'

registerCopy(accessEs as Record<string, string>, accessEn as Record<string, string>)
