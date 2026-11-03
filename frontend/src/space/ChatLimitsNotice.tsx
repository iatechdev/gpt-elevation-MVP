// ES-149: aviso permanente de límites del asistente bajo la caja de mensaje (texto solo por copy.ts, ES/EN).
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'

export function ChatLimitsNotice() {
  const { lang } = useLanguage(); const c = copy[lang]
  return <p className="space-scope space-note chat-limits" role="note" aria-label={c.limitsLabel}>{c.limits}</p>
}
