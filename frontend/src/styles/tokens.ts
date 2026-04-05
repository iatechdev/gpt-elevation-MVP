// frontend/src/styles/tokens.ts
// HU-076 — Design system tokens
// Fuente única de verdad para colores, radios, sombras y espaciados
// Importar desde cualquier componente: import { colors, radius, shadow, spacing } from '../../styles/tokens'

export const colors = {
  primary:      '#6B7D5C',  // olive — color principal Elevation
  primaryLight: '#EAF0E6',  // olive muy claro — fondos, badges
  primaryDark:  '#4A6741',  // olive oscuro — texto sobre primaryLight
  text:         '#1C1917',  // casi negro — texto principal
  textMuted:    '#78716C',  // gris cálido — subtítulos, labels
  textSubtle:   '#A8A29E',  // gris más claro — textos secundarios
  border:       '#E7E5E4',  // borde estándar
  borderLight:  '#D6D2C4',  // borde inputs
  bg:           '#F9F9F7',  // fondo global
  bgCard:       '#FFFFFF',  // fondo cards
  bgMuted:      '#F5F3EF',  // fondo alternativo filas, secciones
  danger:       '#DC2626',  // rojo errores
  dangerLight:  '#FEE2E2',  // rojo claro — fondos alertas
  warning:      '#92400E',  // ámbar oscuro — texto alertas
  warningLight: '#FEF3C7',  // ámbar claro — fondos alertas
  info:         '#0369A1',  // azul — info
  infoLight:    '#E0F2FE',  // azul claro — fondos info
  success:      '#4A6741',  // verde oscuro — texto éxito
  successLight: '#EAF0E6',  // verde claro — fondos éxito
}

export const radius = {
  sm:  '0.5rem',
  md:  '0.65rem',
  lg:  '1rem',
  xl:  '1.25rem',
  full: '999px',
}

export const shadow = {
  card:  '0 2px 12px rgba(26,28,27,0.06)',
  modal: '0 8px 40px rgba(26,28,27,0.12)',
}

export const spacing = {
  xs:  '0.25rem',
  sm:  '0.5rem',
  md:  '0.75rem',
  lg:  '1rem',
  xl:  '1.5rem',
  xxl: '2rem',
  xxxl:'3rem',
}

export const typography = {
  fontBody:    'Inter, sans-serif',
  fontDisplay: 'Playfair Display, serif',
}

// ── Estilos de componentes reutilizables ──────────────────────────────────────
// Estos objetos se pueden usar directamente como style props en React

export const cardStyle: React.CSSProperties = {
  background:   colors.bgCard,
  borderRadius: radius.lg,
  border:       `0.5px solid ${colors.border}`,
  boxShadow:    shadow.card,
  padding:      `${spacing.lg} ${spacing.xl}`,
}

export const labelStyle: React.CSSProperties = {
  fontSize:      '0.72rem',
  fontWeight:    600,
  color:         colors.textMuted,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

export const btnPrimaryStyle: React.CSSProperties = {
  background:    colors.primary,
  color:         colors.bgCard,
  border:        'none',
  borderRadius:  radius.md,
  padding:       `${spacing.sm} ${spacing.lg}`,
  fontSize:      13,
  fontWeight:    500,
  cursor:        'pointer',
  fontFamily:    typography.fontBody,
}

export const btnSecondaryStyle: React.CSSProperties = {
  background:   'transparent',
  color:        colors.primary,
  border:       `0.5px solid #A8B5A2`,
  borderRadius: radius.md,
  padding:      `${spacing.sm} ${spacing.lg}`,
  fontSize:     13,
  fontWeight:   500,
  cursor:       'pointer',
  fontFamily:   typography.fontBody,
}