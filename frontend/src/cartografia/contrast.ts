// ES-152: contraste WCAG 2.1 entre dos colores #rrggbb. La página de componentes lo calcula con los valores reales del tema activo.
const channel = (hex: string, start: number) => {
  const value = parseInt(hex.slice(start, start + 2), 16) / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function luminance(hex: string): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return null
  return 0.2126 * channel(match[1], 0) + 0.7152 * channel(match[1], 2) + 0.0722 * channel(match[1], 4)
}

export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a), lb = luminance(b)
  if (la === null || lb === null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
