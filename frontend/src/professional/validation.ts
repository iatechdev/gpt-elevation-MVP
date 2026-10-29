// ES-95: validación del lado del cliente (comodidad). El servidor repite todas las comprobaciones, incluida la firma real del PDF.
import { MAX_CV_BYTES } from './copy.ts'

export type Values = { name: string; email: string; country: string; profession: string; licenseNumber: string; profileUrl: string; message: string }
export type FieldKey = keyof Values | 'cv' | 'consent'

export const EMPTY: Values = { name: '', email: '', country: '', profession: '', licenseNumber: '', profileUrl: '', message: '' }
export const LIMITS: Record<keyof Values, number> = { name: 120, email: 254, country: 80, profession: 120, licenseNumber: 60, profileUrl: 300, message: 1000 }
const REQUIRED: (keyof Values)[] = ['name', 'email', 'country', 'profession']
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/

export const validProfileUrl = (value: string): boolean => {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? !url.username && !url.password : false } catch { return false }
}

// Devuelve los campos con problema, en el orden del formulario.
export function validate(values: Values, file: { name: string; type: string; size: number } | null, consent: boolean): FieldKey[] {
  const bad: FieldKey[] = []
  for (const key of REQUIRED) if (!values[key].trim()) bad.push(key)
  if (values.email.trim() && !EMAIL.test(values.email.trim())) bad.push('email')
  for (const key of Object.keys(LIMITS) as (keyof Values)[]) if (values[key].length > LIMITS[key] && !bad.includes(key)) bad.push(key)
  if (values.profileUrl.trim() && !validProfileUrl(values.profileUrl.trim()) && !bad.includes('profileUrl')) bad.push('profileUrl')
  if (!file || fileProblem(file)) bad.push('cv')
  if (!consent) bad.push('consent')
  const order: FieldKey[] = ['name', 'email', 'country', 'profession', 'licenseNumber', 'profileUrl', 'message', 'cv', 'consent']
  return order.filter(key => bad.includes(key))
}

export const fileProblem = (file: { name: string; type: string; size: number } | null): 'required' | 'type' | 'size' | null => {
  if (!file) return 'required'
  if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) return 'type'
  if (file.size > MAX_CV_BYTES) return 'size'
  return null
}
