import { exampleAccessibleTitle, exampleApproved } from '../../content/landingExample'

// Franja de ejemplo ilustrativo (ES-64). Textos landing.example.* con respaldo ES/EN; oculta sin aprobación del texto.
export function ExampleStrip({ text }: { text: (key: string) => string }) {
  if (!exampleApproved(import.meta.env.VITE_LANDING_EXAMPLE_APPROVED)) return null
  const title = text('landing.example.title')

  return (
    <section className="landing-example" aria-labelledby="landing-example-title">
      <div className="landing-container">
        <span className="landing-example-tag">{text('landing.example.label')}</span>
        <h2 id="landing-example-title" className="landing-example-title" aria-label={exampleAccessibleTitle(title)}>{title}</h2>
        <p className="landing-example-flow">{text('landing.example.flow')}</p>
      </div>
    </section>
  )
}
