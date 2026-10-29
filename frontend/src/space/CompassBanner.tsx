// ES-13: banda de la Brújula profesional. Salir no envía nada, no crea turno y no deja seguimiento.
import { useNavigate } from 'react-router-dom'
import { copy } from './copy'
import './space.css'
export function CompassBanner({ lang, started, canLeave }: { lang: 'es' | 'en'; started: boolean; canLeave: () => boolean }) {
  const c = copy[lang]; const navigate = useNavigate()
  const leave = () => { if (canLeave()) navigate('/app/chat') }
  return <section className="space-scope space-card space-compass" aria-labelledby="space-compass-title">
    <div className="space-compass-head">
      <h2 id="space-compass-title">{c.proCompass}</h2>
      <button type="button" className="elv-btn" onClick={leave}>{c.proCompassClose}</button>
    </div>
    <p className="space-note">{c.proCompassIntro}</p>
    {!started && <button type="button" className="elv-link" onClick={leave}>{c.proCompassNotNow}</button>}
  </section>
}
