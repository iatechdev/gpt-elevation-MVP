// ES-232: este catálogo no viaja en el arranque; se registra al evaluarse cualquier módulo que lo use (import con efecto), antes del primer pintado.
import { checkinEs, checkinEn } from './copy.ts'
import { registerCopy } from '../i18n/lazyCopy.ts'

registerCopy(checkinEs as Record<string, string>, checkinEn as Record<string, string>)
