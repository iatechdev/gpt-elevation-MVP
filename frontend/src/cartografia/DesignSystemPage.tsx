// ES-152: página interna de componentes del diseño «Cartografía». No lleva datos de personas ni de servidor; no está en la navegación.
import { useEffect, useRef, useState } from 'react'
import { useLanguage } from '../i18n/useLanguage'
import './cartografia.css'
import { cgCopy } from './copy'
import { contrastRatio } from './contrast'
import { Button, Chip, CheckField, LinkButton, ScaleField, SelectField, TextAreaField, TextField } from './controls'
import { Banner, Bars, Card, DataTable, Figures, HintBox, ItemList, Requirements } from './pieces'
import { Dialog, Tabs } from './interactive'
import { ReliefCanvas } from './ReliefCanvas'
import { CartografiaRoot } from './theme'
import { useCgTheme, type CgTheme } from './themeState'
import type { ReliefPoint } from './relief'

const TOKENS = ['ground', 'panel', 'ink', 'muted', 'mark', 'err', 'good', 'contour', 'line'] as const
// El texto solo se mide contra el fondo donde se usa; panel, línea y curvas no son texto.
const NO_RATIO: readonly string[] = ['ground', 'panel', 'line']
const POINTS: ReliefPoint[] = [{ x: 0.2, y: 0.55, level: 2 }, { x: 0.5, y: 0.4, level: 3 }, { x: 0.8, y: 0.6, level: 1 }]
const BARS = [1, 3, 2, 5, 4, 6, 3]

export function DesignSystemPage() {
  const { lang, setLang } = useLanguage()
  const c = cgCopy[lang === 'en' ? 'en' : 'es']
  const [theme, setTheme] = useCgTheme()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [scale, setScale] = useState('3')
  const [values, setValues] = useState<Record<string, string>>({})
  const rootRef = useRef<HTMLDivElement>(null)

  // Valores reales de los tokens del tema activo; se recalculan al cambiar de tema o de preferencia del sistema.
  const [colours, setColours] = useState<Record<string, string>>({})
  useEffect(() => {
    const read = () => {
      const node = rootRef.current?.firstElementChild
      if (!node) return
      const style = getComputedStyle(node)
      setColours(Object.fromEntries(TOKENS.map(token => [token, style.getPropertyValue(`--cg-${token}`).trim()])))
    }
    read()
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)')
    scheme?.addEventListener('change', read)
    return () => scheme?.removeEventListener('change', read)
  }, [theme])

  const fmt = (value: number | null) => (value === null ? c.ratioNA : `${value.toFixed(1).replace('.', lang === 'es' ? ',' : '.')}:1`)
  const themes: { id: CgTheme; label: string }[] = [{ id: 'system', label: c.themeSystem }, { id: 'light', label: c.themeLight }, { id: 'dark', label: c.themeDark }]
  const rows = TOKENS.map(token => ({ token, value: colours[token] ?? '', use: c[token] }))

  return (
    <div ref={rootRef}>
      <CartografiaRoot theme={theme}>
        <a className="cg-sr" href="#cg-main">{c.skip}</a>
        <div className="cg-page">
          <div className="cg-bar">
            <label className="cg-tag" htmlFor="cg-lang">{c.language}</label>
            <select id="cg-lang" className="cg-select" value={lang} onChange={event => setLang(event.target.value === 'en' ? 'en' : 'es')}>
              <option value="es">ES</option><option value="en">EN</option>
            </select>
            <label className="cg-tag" htmlFor="cg-theme">{c.theme}</label>
            <select id="cg-theme" className="cg-select" value={theme} onChange={event => setTheme(event.target.value as CgTheme)}>
              {themes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>

          <main id="cg-main">
            <h1 className="cg-h1">{c.title}</h1>
            <p className="cg-muted">{c.intro}</p>

            <section className="cg-section" aria-labelledby="cg-s1">
              <h2 className="cg-h2" id="cg-s1">{c.colour}</h2>
              <p className="cg-muted">{c.colourIntro}</p>
              <DataTable
                caption={c.tokens} rowKey={row => row.token}
                columns={[
                  { key: 'swatch', header: '', render: row => <span className={`cg-swatch cg-swatch--${row.token}`} aria-hidden="true" /> },
                  { key: 'token', header: c.token, render: row => <><code>--cg-{row.token}</code> <span className="cg-muted cg-small">{row.value}</span></> },
                  { key: 'use', header: c.use, render: row => row.use },
                  { key: 'ratio', header: c.ratio, render: row => (NO_RATIO.includes(row.token) ? '' : fmt(contrastRatio(row.value, colours.ground ?? ''))) },
                ]}
                rows={rows}
              />
            </section>

            <section className="cg-section" aria-labelledby="cg-s2">
              <h2 className="cg-h2" id="cg-s2">{c.typography}</h2>
              <p className="cg-h2">{c.ty1}</p>
              <p className="cg-name">{c.ty2}</p>
              <p>{c.ty3}</p>
              <p className="cg-muted cg-small">{c.tyLicence}</p>
            </section>

            <section className="cg-section" aria-labelledby="cg-s3">
              <h2 className="cg-h2" id="cg-s3">{c.buttons}</h2>
              <div className="cg-row">
                <Button>{c.primary}</Button><Button variant="ghost">{c.secondary}</Button><Button variant="danger">{c.danger}</Button>
                <Button disabled>{c.disabled}</Button><LinkButton>{c.actionLink}</LinkButton>
              </div>
              <p className="cg-muted cg-small">{c.buttonsNote}</p>
            </section>

            <section className="cg-section" aria-labelledby="cg-s4">
              <h2 className="cg-h2" id="cg-s4">{c.fields}</h2>
              <div className="cg-grid2">
                <div>
                  <TextField label={c.fText} hint={c.fTextHint} placeholder={c.fTextPlaceholder} value={values.text ?? ''} onChange={event => setValues({ ...values, text: event.target.value })} />
                  <TextField label={c.fError} error={c.fErrorMsg} value={values.err ?? ''} onChange={event => setValues({ ...values, err: event.target.value })} />
                  <TextAreaField label={c.fArea} value={values.area ?? ''} onChange={event => setValues({ ...values, area: event.target.value })} />
                </div>
                <div>
                  <SelectField label={c.fSelect} defaultValue="1"><option value="1">{c.fOpt1}</option><option value="2">{c.fOpt2}</option></SelectField>
                  <CheckField label={c.fCheck} />
                  <ScaleField
                    legend={c.fScale} name="cg-scale" hint={c.fScaleHint} value={scale} onChange={setScale}
                    options={['1', '2', '3', '4', '5'].map(value => ({ value, label: value }))}
                  />
                </div>
              </div>
            </section>

            <section className="cg-section" aria-labelledby="cg-s5">
              <h2 className="cg-h2" id="cg-s5">{c.pieces}</h2>
              <p className="cg-tag">{c.chips}</p>
              <div className="cg-row">
                <Chip tone="wait">{c.cDraft}</Chip><Chip tone="ok" symbol={'✓'}>{c.cDone}</Chip><Chip>{c.cNone}</Chip><Chip tone="bad" symbol={'⚠'}>{c.cError}</Chip><Chip>{c.cSample}</Chip>
              </div>
              <p className="cg-tag">{c.notices}</p>
              <div className="cg-grid2">
                <Banner title={c.noteTitle}>{c.noteBody}</Banner>
                <Banner kind="error" title={c.errorTitle}>{c.errorBody}</Banner>
              </div>
              <p className="cg-tag">{c.hintLabel}</p>
              <HintBox label={c.hintTag}><p>{c.hintBody}</p></HintBox>
              <p className="cg-tag">{c.reqs}</p>
              <Requirements
                metLabel={c.reqMet} unmetLabel={c.reqUnmet}
                items={[{ id: 'a', text: c.req1, met: true }, { id: 'b', text: c.req2, met: true }, { id: 'c', text: c.req3, met: false }]}
              />
              <p className="cg-tag">{c.list}</p>
              <ItemList label={c.list} items={[
                { id: '1', top: <><strong>{c.item1}</strong><Chip tone="ok" symbol={'✓'}>{c.cDone}</Chip></>, body: <p className="cg-muted">{c.item1b}</p> },
                { id: '2', top: <><strong>{c.item2}</strong><Chip tone="wait">{c.cDraft}</Chip></>, body: <p className="cg-muted">{c.item2b}</p> },
              ]} />
              <p className="cg-tag">{c.table}</p>
              <DataTable
                caption={c.table} rowKey={row => row.name}
                columns={[
                  { key: 'name', header: c.tName, render: row => row.name },
                  { key: 'state', header: c.tState, render: row => row.state },
                  { key: 'when', header: c.tWhen, render: row => row.when },
                ]}
                rows={[{ name: c.tRow1, state: <Chip tone="ok" symbol={'✓'}>{c.cDone}</Chip>, when: c.tD1 }, { name: c.tRow2, state: <Chip tone="wait">{c.cDraft}</Chip>, when: c.tD2 }]}
              />
              <p className="cg-tag">{c.tabs}</p>
              <Tabs label={c.tabsLabel} tabs={[
                { id: 'a', label: c.tab1, panel: <Card><p>{c.panel1}</p></Card> },
                { id: 'b', label: c.tab2, panel: <Card><p>{c.panel2}</p></Card> },
                { id: 'c', label: c.tab3, panel: <Card><p>{c.panel3}</p></Card> },
              ]} />
              <p className="cg-tag">{c.dialog}</p>
              <div className="cg-row"><Button variant="ghost" onClick={() => setDialogOpen(true)}>{c.dialogOpen}</Button></div>
              <Dialog
                open={dialogOpen} onClose={() => setDialogOpen(false)} title={c.dialogTitle}
                actions={<><Button variant="ghost" onClick={() => setDialogOpen(false)}>{c.dialogCancel}</Button><Button variant="danger" onClick={() => setDialogOpen(false)}>{c.dialogConfirm}</Button></>}
              ><p>{c.dialogBody}</p></Dialog>
            </section>

            <section className="cg-section" aria-labelledby="cg-s6">
              <h2 className="cg-h2" id="cg-s6">{c.figures}</h2>
              <Figures items={[{ id: 'a', label: c.figA, value: 12 }, { id: 'b', label: c.figB, value: 3 }, { id: 'c', label: c.figC, value: '5/7' }]} />
              <Bars values={BARS} label={c.barsLabel} />
              <DataTable
                caption={c.barsTable} rowKey={row => String(row.day)}
                columns={[{ key: 'day', header: c.barsDay, render: row => row.day }, { key: 'count', header: c.barsCount, render: row => row.count }]}
                rows={BARS.map((count, index) => ({ day: index + 1, count }))}
              />
            </section>

            <section className="cg-section" aria-labelledby="cg-s7">
              <h2 className="cg-h2" id="cg-s7">{c.relief}</h2>
              <p className="cg-muted">{c.reliefIntro}</p>
              <ReliefCanvas points={POINTS} label={c.reliefLabel} />
              <p className="cg-tag">{c.reliefLoading}</p>
              <ReliefCanvas points={POINTS} label={c.reliefLoading} loading />
              <p className="cg-tag">{c.reliefFlat}</p>
              <ReliefCanvas points={[]} label={c.reliefFlat} />
            </section>

            <section className="cg-section" aria-labelledby="cg-s8">
              <h2 className="cg-h2" id="cg-s8">{c.a11y}</h2>
              <ul><li>{c.a1}</li><li>{c.a2}</li><li>{c.a3}</li><li>{c.a4}</li><li>{c.a5}</li></ul>
            </section>
          </main>
        </div>
      </CartografiaRoot>
    </div>
  )
}
