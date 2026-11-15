// ES-155 (tramo C): el cuerpo de la portada bajo el hero — «Pruébalo con una escena», los tres pasos y el hueco de fotografía real. Va en su propio bloque (con su CSS) para no pesar en el arranque.
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Chip, ReliefCanvas, type ReliefPoint } from '../../cartografia'
import { useAfterFirstPaint } from './useAfterFirstPaint'
import { useScrollToHash } from './useScrollToHash'
import './portadaBody.css'

type Text = (key: string) => string
const t = (text: Text) => (key: string) => text(`landing.portada.${key}`)
const RISE_POINTS: ReliefPoint[] = [{ x: 0.5, y: 0.55, level: 1 }]

type Phase = 'idle' | 'hint' | 'yes' | 'no' | 'rise'
/** «Pruébalo con una escena»: marca una pista FIJA sobre una escena de ejemplo. Sin red, sin cuenta, sin guardar nada; «ver mi mapa» muestra un relieve de ejemplo. */
export function TryScene({ text }: { text: Text }) {
  const p = t(text); const id = useId(); const ready = useAfterFirstPaint()
  const [scene, setScene] = useState(() => p('try_value'))
  const [phase, setPhase] = useState<Phase>('idle')
  const [empty, setEmpty] = useState(false)
  const mark = () => { if (!scene.trim()) { setEmpty(true); return } setEmpty(false); setPhase('hint') }
  return (
    <section className="pt-try" aria-labelledby={`${id}-title`}>
      <div>
        <p className="cg-tag" id={`${id}-title`}>{p('try_title')} <Chip>{p('try_example')}</Chip></p>
        <label className="pt-sr" htmlFor={`${id}-scene`}>{p('try_label')}</label>
        <textarea id={`${id}-scene`} className="pt-scene" maxLength={360} rows={4} value={scene} aria-describedby={empty ? `${id}-empty ${id}-note` : `${id}-note`} aria-invalid={empty || undefined}
          onChange={event => { setScene(event.target.value); setEmpty(false) }} />
        {empty && <p id={`${id}-empty`} className="pt-error" role="alert">{p('try_empty')}</p>}
        <p id={`${id}-note`} className="pt-note">{p('try_note')}</p>
        <div className="pt-actions">
          <Button onClick={mark}>{p('try_mark')}</Button>
          <Link className="cg-btn cg-btn--ghost" to="/login?mode=register">{p('try_own')}</Link>
        </div>
      </div>
      {/* D1 (revisión de UX): la región viva existe siempre; la tarjeta solo aparece cuando hay pista (antes: una caja vacía con borde) */}
      <div aria-live="polite" className="pt-hint-live">
        {phase !== 'idle' && <Card as="div"><div className="pt-hint">
            <>
              <p className="cg-tag">{p('hint_title')}</p>
              {phase === 'hint' && <>
                <p>{p('hint_body')}</p>
                <div className="pt-actions"><Button variant="ghost" onClick={() => setPhase('yes')}>{p('hint_yes')}</Button><Button variant="ghost" onClick={() => setPhase('no')}>{p('hint_no')}</Button></div>
              </>}
              {phase === 'yes' && <>
                <p>{p('hint_ok')}</p>
                <Button variant="ghost" onClick={() => setPhase('rise')}>{p('see_rise')}</Button>
              </>}
              {phase === 'no' && <p>{p('hint_no_ok')}</p>}
              {phase === 'rise' && <>
                <p>{p('hint_ok')}</p>
                <div className="pt-rise"><ReliefCanvas points={RISE_POINTS} loading={!ready} label={p('rise_alt')} /></div>
              </>}
            </>
        </div></Card>}
      </div>
    </section>
  )
}

export function Steps({ text }: { text: Text }) {
  const p = t(text)
  return (
    <section id="como-funciona" tabIndex={-1} className="pt-steps" aria-labelledby="pt-steps-title">
      <h2 id="pt-steps-title" className="pt-h2">{p('steps_title')}</h2>
      <ol>
        {(['1', '2', '3'] as const).map(n => <li key={n}><span className="cg-tag">{p(`st${n}`)}</span><p>{p(`st${n}b`)}</p></li>)}
      </ol>
    </section>
  )
}

/** Hueco de fotografía real: marcador visible hasta tener la fotografía (no se genera con IA ni se inventa). */
export function PhotoSlot({ text }: { text: Text }) {
  return <div className="pt-photo" role="note">{t(text)('photo')}</div>
}

/** Todo lo que va bajo el hero, en un solo bloque. */
export default function PortadaBody({ text }: { text: Text }) {
  useScrollToHash()
  return <><TryScene text={text} /><Steps text={text} /><PhotoSlot text={text} /></>
}
