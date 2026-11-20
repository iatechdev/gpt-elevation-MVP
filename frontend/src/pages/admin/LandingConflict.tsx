// ES-279 (pantalla): aviso de conflicto DENTRO de la fila del texto afectado (diseño aprobado, comentarios 12123/12124). No pierde lo escrito: el campo conserva su texto.
// «Ver su versión» (abre/cierra) · «Conservar la mía» (reenvía con la versión vigente) · «Usar la suya» (solo con su versión abierta; pone su texto en el campo SIN guardar).
import { useEffect, useRef, useState } from 'react'
import { Banner, Button } from '../../cartografia'
import { useAdminText } from '../../i18n/useAdminText'
import { useLanguage } from '../../i18n/useLanguage'
import { conflictId, type LandingVersion } from './landingVersions.ts'

export function LandingConflict({ fieldKey, current, mine, busy, onKeepMine, onUseTheirs }: {
  fieldKey: string; current: LandingVersion | null; mine: string; busy: boolean; onKeepMine: () => void; onUseTheirs: () => void
}) {
  const tr = useAdminText()
  const { lang } = useLanguage()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const id = conflictId(fieldKey)
  // Al aparecer el aviso el foco va a su primera acción: «Ver su versión» (o «Conservar la mía» si el texto ya no existe).
  useEffect(() => { box.current?.querySelector('button')?.focus() }, [])
  const when = current ? new Date(current.updatedAt).toLocaleString(lang === 'en' ? 'en-US' : 'es-CO') : ''
  return (
    <div className="ac-conflict" id={id} ref={box}>
      <Banner kind="error" title={tr('Otra persona guardó este texto mientras lo editabas. Tus cambios siguen en esta pantalla.')}>
        <div className="ac-conflict__actions">
          {current && <Button variant="ghost" aria-expanded={open} aria-controls={`${id}-theirs`} onClick={() => setOpen(v => !v)}>{open ? tr('Ocultar su versión') : tr('Ver su versión')}</Button>}
          <Button variant="ghost" disabled={busy} onClick={onKeepMine}>{tr('Conservar la mía')}</Button>
          {current && open && <Button variant="ghost" disabled={busy} onClick={onUseTheirs}>{tr('Usar la suya')}</Button>}
        </div>
        {current && open && (
          <div id={`${id}-theirs`} className="ac-theirs">
            {current.value === mine
              ? <p className="cg-hint">{tr('Su versión coincide con lo que tienes en pantalla.')}</p>
              : <>
                  <p className="cg-hint">{tr('Su versión')} · {tr('Guardado por')} {current.updatedBy ?? '—'} · {when}</p>
                  <p className="ac-theirs__text">{current.value}</p>
                </>}
          </div>
        )}
      </Banner>
    </div>
  )
}
