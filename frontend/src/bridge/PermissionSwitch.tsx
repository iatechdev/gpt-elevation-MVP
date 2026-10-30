// ES-121: interruptor accesible (role="switch") para un permiso. No decide nada por sí mismo: avisa con onToggle y el padre pide confirmación o guarda.
type Props = { checked: boolean; busy: boolean; label: string; describedBy: string; dataSource: string; onToggle: () => void }

export function PermissionSwitch({ checked, busy, label, describedBy, dataSource, onToggle }: Props) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} aria-describedby={describedBy} aria-busy={busy || undefined} disabled={busy}
    className="bridge-switch" data-source={dataSource} onClick={onToggle}><span className="bridge-switch-knob" aria-hidden="true" /></button>
}
