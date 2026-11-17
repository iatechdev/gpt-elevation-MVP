// ES-333 (PR 2): menú del chat (hoja inferior, Dialog de Cartografía). Reúne lo que salía de la cabecera propia y de los íconos sueltos:
// Mi progreso, Recomendaciones, Administración (solo admin/superadmin), uso de IA, «Enter envía…» y Cerrar sesión (abre el check-out). En ≤ 900 px el marco de persona no dibuja
// su encabezado en esta ruta: el menú conserva su navegación, el idioma y el tema (mismas piezas del marco). Sin textos nuevos: todo sale de copy.ts, shell/copy.ts y i18n.
import type { MouseEvent as ReactMouseEvent } from 'react'
import { Button, Dialog } from '../cartografia'
import { NavLinks, PreferencesBar } from '../shell/Frame'
import { leaveBlocked } from '../shell/leaveGuard'
import { PERSON_MENU, PERSON_NAV } from '../shell/nav'
import { NavLink } from 'react-router-dom'
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

export function ChatMenu({ open, onClose, onProgress, onRecs, onAdmin, onCheckout, enterSends, onEnterSends, legacy = false }: ChatMenuProps) {
  const { lang, t } = useLanguage(); const c = copy[lang]; const { c: shell } = useShellCopy()
  const pick = (action: () => void) => () => { onClose(); action() }
  return <Dialog sheet open={open} onClose={onClose} title={c.menu} actions={<Button variant="ghost" onClick={onClose}>{c.close}</Button>}>
    <div className="chat-menu">
      <div className="chat-menu-list" role="group" aria-label={c.conversation}>
        <button type="button" onClick={pick(onProgress)}>{c.progress}</button>
        <button type="button" onClick={pick(onRecs)}>{t('rec_title')}</button>
        {onAdmin && <button type="button" onClick={pick(onAdmin)}>{t('admin_title')}</button>}
      </div>
      <UsageText />
      <label className="chat-enter"><input className="elv-checkbox" type="checkbox" checked={enterSends} onChange={event => onEnterSends(event.target.checked)} />{c.enterSends}</label>
      <div className="chat-menu-list"><button type="button" onClick={pick(onCheckout)}>{c.signOut}</button></div>
      <div className="chat-menu-frame" onClickCapture={guardLeave}>
        <NavLinks items={PERSON_NAV} label={shell.main} className="chat-menu-list" />
        <nav className="chat-menu-list" aria-label={shell.userMenu}>{PERSON_MENU.map(item => <NavLink key={item.to} to={item.to}>{shell[item.label]}</NavLink>)}</nav>
        <PreferencesBar legacy={legacy} />
      </div>
    </div>
  </Dialog>
}
