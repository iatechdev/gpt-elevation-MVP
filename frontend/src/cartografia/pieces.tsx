// ES-152: tarjeta, avisos, listas, tabla con alternativa en tarjetas, cifras y barras. Sin texto visible propio ni estilos en línea.
import type { ElementType, ReactNode } from 'react'

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')

export function Card({ as: Tag = 'div', className, children }: { as?: ElementType; className?: string; children: ReactNode }) {
  return <Tag className={cx('cg-card', className)}>{children}</Tag>
}

/** Aviso. `note` informa (role=note); `error` dice qué pasó, qué se conservó y qué hacer (role=alert, con símbolo ⚠ además del color). */
export function Banner({ kind = 'note', title, children }: { kind?: 'note' | 'error'; title: string; children?: ReactNode }) {
  return (
    <div className={cx('cg-banner', kind === 'error' && 'cg-banner--error')} role={kind === 'error' ? 'alert' : 'note'}>
      <span className="cg-banner__title">{title}</span>
      {children}
    </div>
  )
}

/** Pista apoyada en una frase de la persona: es una sugerencia, no una evaluación. */
export function HintBox({ label, children }: { label: string; children: ReactNode }) {
  return <div className="cg-hintbox"><p className="cg-tag">{label}</p>{children}</div>
}

export function ItemList({ items, label }: { items: { id: string; top: ReactNode; body?: ReactNode }[]; label?: string }) {
  return (
    <ul className="cg-items" aria-label={label}>
      {items.map(item => (
        <li className="cg-item" key={item.id}>
          <div className="cg-item__top">{item.top}</div>
          {item.body}
        </li>
      ))}
    </ul>
  )
}

export type Requirement = { id: string; text: string; met: boolean }

/** Lista de requisitos: el estado va con símbolo (✓ / ○) y con palabra para lectores de pantalla, nunca solo con color. */
export function Requirements({ items, metLabel, unmetLabel }: { items: Requirement[]; metLabel: string; unmetLabel: string }) {
  return (
    <ul className="cg-reqs">
      {items.map(item => (
        <li key={item.id} className={cx('cg-req', item.met ? 'cg-req--met' : 'cg-req--unmet')}>
          <span className="cg-req__sym" aria-hidden="true">{item.met ? '✓' : '○'}</span>
          <span className="cg-sr">{item.met ? metLabel : unmetLabel}: </span>
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  )
}

export type Column<Row> = { key: string; header: string; render: (row: Row) => ReactNode }

/** Tabla accesible; en pantallas angostas (≤ 640 px) se presenta como tarjetas con los mismos datos (la versión oculta sale del árbol de accesibilidad). */
export function DataTable<Row>({ caption, columns, rows, rowKey }: { caption: string; columns: Column<Row>[]; rows: Row[]; rowKey: (row: Row) => string }) {
  return (
    <div className="cg-table-responsive">
      <div className="cg-tablewrap">
        <table className="cg-table">
          <caption>{caption}</caption>
          <thead><tr>{columns.map(column => <th key={column.key} scope="col">{column.header}</th>)}</tr></thead>
          <tbody>
            {rows.map(row => <tr key={rowKey(row)}>{columns.map(column => <td key={column.key}>{column.render(row)}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      <ul className="cg-cards" aria-label={caption}>
        {rows.map(row => (
          <li key={rowKey(row)} className="cg-card">
            <dl>{columns.map(column => <div key={column.key}><dt>{column.header}</dt><dd>{column.render(row)}</dd></div>)}</dl>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Cifras con su rótulo (dl/dt/dd). */
export function Figures({ items }: { items: { id: string; label: string; value: ReactNode }[] }) {
  return (
    <dl className="cg-figures">
      {items.map(item => <div className="cg-figure" key={item.id}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
    </dl>
  )
}

/** Barras en SVG (sin estilos en línea). Es una imagen con descripción: quien la usa debe ofrecer la tabla equivalente. */
export function Bars({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values)
  const width = 100 / Math.max(1, values.length)
  return (
    <svg className="cg-bars" role="img" aria-label={label} viewBox="0 0 100 40" preserveAspectRatio="none">
      {values.map((value, index) => {
        const height = Math.max(0.5, (Math.max(0, value) / max) * 40)
        return <rect key={index} x={index * width + width * 0.1} y={40 - height} width={width * 0.8} height={height} />
      })}
    </svg>
  )
}
