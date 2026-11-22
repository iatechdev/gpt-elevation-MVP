// ES-155 (tramo C): el cuerpo de la portada bajo el hero. Va en su propio bloque (con su CSS) para no pesar en el arranque.
// ES-360: la demostración es un EJEMPLO FIJO de solo lectura (cita, no cuadro editable): la pista está preparada y no analiza nada que se escriba, así que no se invita a escribir.
// Sin red, sin cuenta, sin guardar. Se retiró el hueco de fotografía (era una nota de diseño, no contenido).
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
/** «Mira cómo funciona con un ejemplo»: muestra una pista FIJA sobre una escena de ejemplo. Nada se envía ni se guarda; recargar vuelve al inicio. */
export function TryScene({ text }: { text: Text }) {
  const p = t(text); const id = useId(); const ready = useAfterFirstPaint()
  const [phase, setPhase] = useState<Phase>('idle')
  return (
    <section id="ejemplo" tabIndex={-1} className="pt-try" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="pt-h2 pt-try__title">{p('try_title')}</h2>
      <div>
        <Card as="div">
          <p className="cg-tag">{p('try_label')} <Chip>{p('try_example')}</Chip></p>
          <blockquote className="pt-quote">{p('try_value')}</blockquote>
          <p className="pt-note">{p('try_note')}</p>
          <div className="pt-actions">
            <Button onClick={() => setPhase('hint')}>{p('try_mark')}</Button>
            <Link className="cg-btn cg-btn--ghost" to="/login?mode=register">{p('try_own')}</Link>
          </div>
        </Card>
      </div>
      {/* D1 (revisión de UX): la región viva existe siempre; la tarjeta solo aparece cuando hay pista (antes: una caja vacía con borde) */}
      <div aria-live="polite" className="pt-hint-live">
        {phase !== 'idle' && <Card as="div"><div className="pt-hint">
            <>
              <p className="cg-tag">{p('hint_title')}</p>
              {phase === 'hint' && <>
                <p>{p('hint_body')}</p>
                <p><strong>{p('hint_q')}</strong></p>
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
      <p className="cg-tag">{p('steps_title')}</p>
      <h2 id="pt-steps-title" className="pt-h2">{p('steps_heading')}</h2>
      <ol>
        {(['1', '2', '3'] as const).map(n => <li key={n}><h3 className="pt-step">{p(`st${n}`)}</h3><p>{p(`st${n}b`)}</p></li>)}
      </ol>
      <p className="pt-note">{p('steps_note')}</p>
    </section>
  )
}

/** Todo lo que va bajo el hero en este bloque: la demostración fija y los tres pasos. */
export default function PortadaBody({ text }: { text: Text }) {
  useScrollToHash()
  return <><TryScene text={text} /><Steps text={text} /></>
}
