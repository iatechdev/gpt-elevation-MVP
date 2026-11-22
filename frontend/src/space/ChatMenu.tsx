// ES-333 (PR 2) / ES-342 (B1): menú del chat (Dialog de Cartografía: hoja inferior en móvil, centrada en escritorio). Cabecera fija con «Cerrar», pie fijo con «Cerrar sesión» y un cuerpo que es lo único que se desplaza.
// Orden aprobado: Conversación (acciones de esta pantalla) → Principal → «Menú de usuario» plegado → Preferencias (idioma y tema, solo aquí) → Cerrar sesión. «Mi progreso» aparece una sola vez (en Conversación).
// Sin textos nuevos: todo sale de copy.ts, shell/copy.ts y i18n. «Cerrar sesión» abre el check-out (como antes).
import { useId, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { Button, Dialog } from '../cartografia'
import { LangSwitch, NavLinks, ThemeSwitch } from '../shell/Frame'
import { leaveBlocked } from '../shell/leaveGuard'
import { PERSON_MENU, PERSON_NAV } from '../shell/nav'
import { useShellCopy } from '../shell/useShellCopy'
import { useLanguage } from '../i18n/useLanguage'
import { copy } from './copy'
import { UsageText } from './ChatBar'

export type ChatMenuProps = {
  open: boolean; onClose: () => void
  onProgress: () => void; onRecs: () => void; onAdmin?: () => void; onCheckout: () => void
  enterSends: boolean; onEnterSends: (value: boolean) => void
  legacy?: boolean
}

// Un clic en un enlace del menú pregunta antes si hay un envío sin confirmar (igual que el encabezado del marco).
function guardLeave(event: ReactMouseEvent<HTMLElement>) {
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null
  const href = link?.getAttribute('href') ?? ''
  if (!link || href.startsWith('#') || event.defaultPrevented) return
  if (leaveBlocked(href)) { event.preventDefault(); event.stopPropagation() }
}

/** Grupo «Conversación»: lo propio de esta pantalla. Vive en la hoja de escritorio (MenuBody) y, a ≤ 900 px, arriba del cajón del marco (ES-359 PR4, drawerExtra).
 *  «Recomendaciones» se abre un cuadro después de cerrar el menú: así el foco vuelve primero al botón que abrió el menú y la hoja lo recuerda como destino. */
export function ConversationGroup({ onClose, onProgress, onRecs, onAdmin, enterSends, onEnterSends }: Pick<ChatMenuProps, 'onProgress' | 'onRecs' | 'onAdmin' | 'enterSends' | 'onEnterSends'> & { onClose: () => void }) {
  const { lang, t } = useLanguage(); const c = copy[lang]; const heading = useId()
  const pick = (action: () => void) => () => { onClose(); requestAnimationFrame(action) }
  return <>
    <h3 className="chat-menu-h" id={heading}>{c.conversation}</h3>
    <div className="chat-menu-list" role="group" aria-labelledby={heading}>
      <button type="button" onClick={pick(onProgress)}>{c.progress}</button>
      <button type="button" onClick={pick(onRecs)}>{t('rec_title')}</button>
      {onAdmin && <button type="button" onClick={pick(onAdmin)}>{t('admin_title')}</button>}
    </div>
    <UsageText />
    <label className="chat-enter"><input className="elv-checkbox" type="checkbox" checked={enterSends} onChange={event => onEnterSends(event.target.checked)} />{c.enterSends}</label>
  </>
}

/** Cuerpo del menú: solo existe mientras el Dialog está abierto, así «Menú de usuario» vuelve a quedar plegado en cada apertura. */
function MenuBody({ onClose, onProgress, onRecs, onAdmin, enterSends, onEnterSends, legacy }: Omit<ChatMenuProps, 'open' | 'onCheckout'> & { legacy: boolean }) {
  const { c: shell } = useShellCopy()
  const [more, setMore] = useState(false); const ids = { main: useId(), prefs: useId(), more: useId() }
  const userItems = PERSON_MENU.filter(item => item.label !== 'progress') // «Mi progreso» ya está en Conversación
  return <div className="chat-menu" onClickCapture={guardLeave}>
    <ConversationGroup onClose={onClose} onProgress={onProgress} onRecs={onRecs} onAdmin={onAdmin} enterSends={enterSends} onEnterSends={onEnterSends} />
    <h3 className="chat-menu-h" id={ids.main}>{shell.main}</h3>
    <NavLinks items={PERSON_NAV} label={shell.main} className="chat-menu-list chat-menu-grid" />
    <button type="button" className="chat-menu-disc" aria-expanded={more} aria-controls={ids.more} onClick={() => setMore(value => !value)}>
      <span>{shell.userMenu}</span><span aria-hidden="true">{more ? '▴' : '▾'}</span>
    </button>
    <nav id={ids.more} className="chat-menu-list chat-menu-grid" aria-label={shell.userMenu} hidden={!more}>
      {userItems.map(item => <NavLink key={item.to} to={item.to}>{shell[item.label]}</NavLink>)}
    </nav>
    <h3 className="chat-menu-h" id={ids.prefs}>{shell.preferences}</h3>
    <div className="chat-menu-prefs" role="group" aria-labelledby={ids.prefs}>
      <div className="chat-menu-pref"><span>{shell.language}</span><LangSwitch /></div>
      <div className="chat-menu-pref"><span>{shell.theme}</span><ThemeSwitch legacy={legacy} /></div>
    </div>
  </div>
}

export function ChatMenu({ open, onClose, onProgress, onRecs, onAdmin, onCheckout, enterSends, onEnterSends, legacy = false }: ChatMenuProps) {
  const { lang } = useLanguage(); const c = copy[lang]
  return <Dialog sheet open={open} onClose={onClose} title={c.menu}
    headerAction={<Button variant="ghost" onClick={onClose}>{c.close}</Button>}
    actions={<Button variant="danger" onClick={() => { onClose(); onCheckout() }}>{c.signOut}</Button>}>
    <MenuBody onClose={onClose} onProgress={onProgress} onRecs={onRecs} onAdmin={onAdmin} enterSends={enterSends} onEnterSends={onEnterSends} legacy={legacy} />
  </Dialog>
}
