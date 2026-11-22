// ES-360: las secciones de la portada bajo «Cómo funciona», con los textos aprobados en el diseño (comentario 12863 de ES-360): qué puedes hacer en Elevation, SkillMap, idiomas,
// próximo paso y solicitud profesional. Una sola escala de estado: «Disponible / En preparación» (landing.status.*); lo que está en preparación va en un bloque aparte con su título.
// Piezas de Cartografía (Card, Chip, Button) y tokens --cg-*; sin números de sección ni planes ni precios.
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, Chip } from '../../cartografia'

type Text = (key: string) => string
const Available = ({ text }: { text: Text }) => <Chip tone="ok" symbol="✓ ">{text('landing.status.available')}</Chip>
const Soon = ({ text }: { text: Text }) => <Chip>{text('landing.status.soon')}</Chip>

function Item({ text, group, name, status }: { text: Text; group: string; name: string; status: 'available' | 'soon' }) {
  return <Card as="div" className="pt-card">
    <h3>{text(`landing.${group}.${name}.title`)}</h3>
    <p>{text(`landing.${group}.${name}.body`)}</p>
    <p>{status === 'available' ? <Available text={text} /> : <Soon text={text} />}</p>
  </Card>
}

function SoonBlock({ text, children }: { text: Text; children: ReactNode }) {
  return <div className="pt-soon">
    <h3>{text('landing.soon.title')}</h3>
    <p className="pt-note">{text('landing.soon.intro')}</p>
    <div className="pt-grid">{children}</div>
  </div>
}

/** «Qué puedes hacer en Elevation»: conversación, diario y brújula disponibles; ejercicios y «Tus datos» en preparación (estado según lo activo en main, ver PR). */
export function Features({ text }: { text: Text }) {
  return <section className="pt-sec" aria-labelledby="pt-features-title">
    <p className="cg-tag">{text('landing.features.label')}</p>
    <h2 id="pt-features-title" className="pt-h2">{text('landing.features.title')}</h2>
    <p className="pt-lead2">{text('landing.features.intro')}</p>
    <div className="pt-grid pt-grid--3">
      {['conversation', 'journal', 'compass'].map(name => <Item key={name} text={text} group="features" name={name} status="available" />)}
    </div>
    <SoonBlock text={text}>
      {['exercises', 'data'].map(name => <Item key={name} text={text} group="features" name={name} status="soon" />)}
    </SoonBlock>
  </section>
}

/** SkillMap: tres principios disponibles y, aparte, lo que está en preparación (rutas, experimento, tareas y era de la IA). */
export function SkillMap({ text }: { text: Text }) {
  return <section id="skill-map" tabIndex={-1} className="pt-sec" aria-labelledby="pt-skillmap-title">
    <p className="cg-tag">{text('landing.skillmap.label')} <Available text={text} /></p>
    <h2 id="pt-skillmap-title" className="pt-h2">{text('landing.skillmap.title')}</h2>
    <p className="pt-lead2">{text('landing.skillmap.intro')}</p>
    <div className="pt-grid pt-grid--3">
      {['p1', 'p2', 'p3'].map(name => <Card key={name} as="div" className="pt-card"><h3>{text(`landing.skillmap.${name}.title`)}</h3><p>{text(`landing.skillmap.${name}.body`)}</p></Card>)}
    </div>
    <SoonBlock text={text}>
      {['routes', 'experiment', 'ai'].map(name => <Item key={name} text={text} group="skillmap" name={name} status="soon" />)}
    </SoonBlock>
  </section>
}

export function Languages({ text }: { text: Text }) {
  return <section className="pt-sec" aria-labelledby="pt-langs-title">
    <h2 id="pt-langs-title" className="pt-h2">{text('landing.langs.title')}</h2>
    <p className="pt-lead2">{text('landing.langs.body')}</p>
  </section>
}

/** Próximo paso. VARIANTE B (piloto cerrado), aprobada por Mauricio en ES-360 (comentario 12870). Ver el PR: el registro del servidor es público hoy. */
export function NextStep({ text }: { text: Text }) {
  return <section id="proximo-paso" className="pt-sec" aria-labelledby="pt-next-title">
    <Card as="div">
      <h2 id="pt-next-title" className="pt-h2">{text('landing.next.pilot.title')}</h2>
      <p>{text('landing.next.pilot.body')}</p>
      <div className="pt-actions">
        <Link className="cg-btn" to="/login?mode=register">{text('landing.portada.cta_create')}</Link>
        <Link className="cg-btn cg-btn--ghost" to="/login">{text('landing.next.login')}</Link>
      </div>
    </Card>
  </section>
}

/** Solicitud profesional. Solo con la bandera de revisión (professionalsEnabled) y con la ruta /profesionales disponible; el texto no promete acceso ni fecha. */
export function Professionals({ text, applicationAvailable }: { text: Text; applicationAvailable: boolean }) {
  return <section id="profesionales" tabIndex={-1} className="pt-sec" aria-labelledby="pt-pros-title">
    <h2 id="pt-pros-title" className="pt-h2">{text('landing.pros.title')}</h2>
    <p className="pt-lead2">{text('landing.pros.intro')}</p>
    {applicationAvailable && <>
      <div className="pt-actions"><Link className="cg-btn cg-btn--ghost" to="/profesionales" aria-describedby="pt-pros-note">{text('landing.pros.cta')}</Link></div>
      <p id="pt-pros-note" className="pt-note">{text('landing.pros.cta_note')}</p>
    </>}
  </section>
}
