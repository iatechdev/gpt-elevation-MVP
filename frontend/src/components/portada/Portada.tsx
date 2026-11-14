// ES-155 (tramo C): portada «Cartografía». Hero con relieve decorativo, leyenda de símbolos, pieza «pruébalo con una escena», tres pasos y un hueco para fotografía real.
// Todos los textos salen de `landing.portada.*` (CMS editable, con respaldo ES/EN en shared/landing-content.json). Sin promesas de empleo ni de resultados; el ejemplo va rotulado.
import { useAfterFirstPaint } from './useAfterFirstPaint'
import { Link } from 'react-router-dom'
import { ReliefCanvas, type ReliefPoint } from '../../cartografia'
import './portada.css'

type Text = (key: string) => string
const t = (text: Text) => (key: string) => text(`landing.portada.${key}`)

/** Picos decorativos del hero (no son datos de nadie): forma fija, determinista. */
const HERO_POINTS: ReliefPoint[] = [
  { x: 0.2, y: 0.34, level: 1 }, { x: 0.46, y: 0.6, level: 3 }, { x: 0.68, y: 0.36, level: 4 }, { x: 0.84, y: 0.66, level: 2 }, { x: 0.3, y: 0.78, level: 2 },
]

export function Hero({ text }: { text: Text }) {
  const p = t(text); const ready = useAfterFirstPaint()
  return (
    <section className="pt-hero" aria-labelledby="pt-hero-title">
      <div className="pt-hero__relief" aria-hidden="true"><ReliefCanvas points={HERO_POINTS} decor loading={!ready} label="" /></div>
      <div className="pt-here" aria-hidden="true"><i />{p('here')}</div>
      <div className="pt-hero__in">
        <h1 id="pt-hero-title">{p('hero_pre')} <em>{p('hero_em')}</em></h1>
        <p className="pt-lead">{p('lead')}</p>
        <Link className="cg-btn" to="/login?mode=register">{p('cta_up')}</Link>
      </div>
      <div className="pt-legend">
        <span className="cg-tag">{p('legend')}</span>
        <ul>
          <li><i className="pt-sym pt-sym--s" aria-hidden="true" />{p('leg1')}</li>
          <li><i className="pt-sym pt-sym--p" aria-hidden="true" />{p('leg2')}</li>
          <li><i className="pt-sym pt-sym--n" aria-hidden="true" />{p('leg3')}</li>
          <li><i className="pt-sym pt-sym--l" aria-hidden="true" />{p('leg4')}</li>
        </ul>
      </div>
    </section>
  )
}
