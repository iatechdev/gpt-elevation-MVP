// ES-232: este catálogo ya no viaja en el arranque; se registra al evaluarse cualquier módulo que lo use (import con efecto), antes del primer pintado.
import { skillMapEs, skillMapEn } from './copy.ts'
import { registerCopy } from '../i18n/lazyCopy.ts'

registerCopy(skillMapEs as Record<string, string>, skillMapEn as Record<string, string>)
