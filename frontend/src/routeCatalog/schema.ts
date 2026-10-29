export const kinds = ['contexts', 'sources', 'roles', 'offers', 'resources'] as const
export type Kind = typeof kinds[number]
export type Data = Record<string, unknown>
export type Spec = { key: string; es: string; en: string; type: 'text' | 'url' | 'date' | 'number' | 'boolean' | 'select' | 'group' | 'repeat' | 'refs' | 'country'; max?: number; options?: string[]; children?: Spec[]; ref?: Kind; when?: string }
const text = (key: string, es: string, en: string, max = 200): Spec => ({ key, es, en, type: 'text', max })
const group = (key: string, es: string, en: string, children: Spec[]): Spec => ({ key, es, en, type: 'group', children })
const bilingual = (key: string, es: string, en: string, max: number): Spec => group(key, es, en, [text('es', 'Español', 'Spanish', max), text('en', 'Inglés', 'English', max)])
const date = (key: string, es: string, en: string): Spec => ({ key, es, en, type: 'date' })
const bool = (key: string, es: string, en: string): Spec => ({ key, es, en, type: 'boolean' })
const select = (key: string, es: string, en: string, options: string[]): Spec => ({ key, es, en, type: 'select', options })
const refs = (key: string, es: string, en: string, ref: Kind, max: number): Spec => ({ key, es, en, type: 'refs', ref, max })
const key = (name: string, es: string, en: string) => text(name, es, en, 48)
const url = { key: 'url', es: 'URL HTTPS', en: 'HTTPS URL', type: 'url', max: 500 } as const
const person = (es: string, en: string) => group('review', es, en, [text('by', 'Revisado por', 'Reviewed by', 120), date('at', 'Fecha de revisión', 'Review date')])
const modalities = ['onsite', 'hybrid', 'remote', 'unknown']
export const schemas: Record<Kind, Spec[]> = {
  contexts: [bilingual('labels', 'Etiqueta', 'Label', 80), bilingual('note', 'Nota', 'Note', 300)],
  sources: [select('type', 'Tipo de fuente', 'Source type', ['official', 'institutional', 'market_report', 'offer_page', 'course_provider', 'other']), text('title', 'Título original', 'Original title'), url, { key: 'country', es: 'País (ISO de dos letras o no aplica)', en: 'Country (two-letter ISO or not applicable)', type: 'country' }, text('language', 'Idioma original (código de dos letras)', 'Original language (two-letter code)', 2), date('publishedAt', 'Fecha de publicación', 'Publication date'), date('consultedAt', 'Fecha de consulta', 'Consultation date'), text('consultedBy', 'Consultado por', 'Consulted by', 120), bool('accessible', 'Accesibilidad comprobada', 'Accessibility checked')],
  roles: [bilingual('labels', 'Nombre del rol', 'Role name', 100), bilingual('industry', 'Industria', 'Industry', 100), text('market', 'Mercado (país ISO)', 'Market (ISO country)', 2), { key: 'languagesRequired', es: 'Idiomas requeridos (códigos o unknown)', en: 'Required languages (codes or unknown)', type: 'refs', max: 4, options: ['es', 'en', 'unknown'] }, { key: 'modality', es: 'Modalidades', en: 'Work arrangements', type: 'refs', max: 4, options: modalities },
    { key: 'tasks', es: 'Tareas', en: 'Tasks', type: 'repeat', max: 12, children: [bilingual('text', 'Tarea', 'Task', 200), group('aiExposure', 'Exposición a IA', 'AI exposure', [select('status', 'Base de la afirmación', 'Basis for the statement', ['sourced', 'hypothesis', 'unknown']), key('sourceKey', 'Clave de fuente', 'Source key'), bilingual('note', 'Nota de exposición', 'Exposure note', 300)])] },
    { key: 'barriers', es: 'Barreras', en: 'Barriers', type: 'repeat', max: 8, children: [text('es', 'Español', 'Spanish', 200), text('en', 'Inglés', 'English', 200)] },
    { key: 'capabilities', es: 'Capacidades requeridas', en: 'Required capabilities', type: 'repeat', max: 12, children: [key('skillKey', 'Clave de capacidad', 'Skill key'), select('importance', 'Importancia', 'Importance', ['essential', 'optional'])] },
    refs('contexts', 'Contextos editoriales', 'Editorial contexts', 'contexts', 6), refs('sourceKeys', 'Fuentes del rol', 'Role sources', 'sources', 12), person('Revisión de dominio', 'Domain review'), group('regulated', 'Profesión regulada', 'Regulated profession', [bool('isRegulated', '¿Es regulada?', 'Is it regulated?'), { ...bilingual('note', 'Nota de habilitación', 'Licensing note', 300), when: 'isRegulated' }, { ...key('sourceKey', 'Fuente de habilitación', 'Licensing source'), when: 'isRegulated' }])],
  offers: [text('title', 'Título original', 'Original title'), text('organization', 'Organización', 'Organization'), key('roleKey', 'Clave de rol', 'Role key'), url, text('market', 'Mercado (país ISO)', 'Market (ISO country)', 2), text('language', 'Idioma (código)', 'Language (code)', 2), select('modality', 'Modalidad', 'Work arrangement', modalities), date('postedAt', 'Fecha de publicación', 'Posting date'), date('checkedAt', 'Fecha comprobada en página oficial', 'Date checked on official page'), group('salary', 'Salario', 'Salary', [bool('published', '¿Salario publicado?', 'Salary published?'), { ...text('text', 'Salario tal como se publicó', 'Salary as published', 100), when: 'published' }]), group('verification', 'Verificación humana de la oferta', 'Human vacancy verification', [text('by', 'Verificado por', 'Verified by', 120), date('at', 'Fecha de verificación', 'Verification date')]), text('extract', 'Extracto', 'Excerpt', 300)],
  resources: [select('kind', 'Tipo de recurso', 'Resource type', ['course', 'reading']), text('title', 'Título original', 'Original title'), url, text('provider', 'Proveedor', 'Provider', 120), bilingual('purpose', 'Propósito', 'Purpose', 300), text('language', 'Idioma (código)', 'Language (code)', 2), select('level', 'Nivel', 'Level', ['introductory', 'intermediate', 'advanced']), group('duration', 'Duración', 'Duration', [{ key: 'minutes', es: 'Minutos', en: 'Minutes', type: 'number', max: 100000 }, text('text', 'Duración publicada', 'Published duration', 100)]), group('price', 'Precio', 'Price', [bool('published', '¿Precio publicado?', 'Price published?'), { key: 'amount', es: 'Importe', en: 'Amount', type: 'number', max: 1e9, when: 'published' }, { ...text('currency', 'Divisa (ISO de tres letras)', 'Currency (three-letter ISO)', 3), when: 'published' }]), key('linkedSkillKey', 'Capacidad vinculada', 'Linked skill'), bilingual('exercise', 'Ejercicio para mostrar aprendizaje', 'Exercise to demonstrate learning', 300), refs('roleKeys', 'Roles vinculados', 'Linked roles', 'roles', 12), key('sourceKey', 'Clave de fuente', 'Source key')],
}
export const object = (v: unknown): Data => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Data : {}
export const array = (v: unknown): unknown[] => Array.isArray(v) ? v : []
export const string = (v: unknown) => typeof v === 'string' ? v : ''
export function serialize(specs: Spec[], input: Data): Data {
  const out: Data = {}
  for (const field of specs) {
    if (field.when && input[field.when] !== true) continue
    const value = input[field.key]
    if (value === undefined || value === '' || (Array.isArray(value) && !value.length && !['barriers', 'capabilities'].includes(field.key))) continue
    if (field.type === 'group') { const nested = serialize(field.children!, object(value)); if (Object.keys(nested).length) out[field.key] = nested }
    else if (field.type === 'repeat') out[field.key] = array(value).map(item => serialize(field.children!, object(item)))
    else out[field.key] = value
  }
  return out
}
export function payload(kind: Kind, input: Data, synthetic: boolean): Data { return { ...serialize(schemas[kind], input), ...(synthetic ? { synthetic: true } : {}) } }
export const validKey = (key: string) => /^[a-z][a-z0-9_]{2,47}$/.test(key)
export function fieldLabel(kind: Kind, path: string, lang: 'es' | 'en'): string {
  let specs = schemas[kind]; const labels: string[] = []
  for (const part of path.split('.')) {
    const field = specs.find(row => row.key === part)
    if (field) { labels.push(field[lang]); specs = field.children ?? [] }
  }
  return labels.join(' · ') || (lang === 'es' ? 'Referencia o límite de la sección' : 'Section reference or limit')
}
export function safeUrl(value: unknown): string | null {
  try {
    const u = new URL(string(value)); const host = u.hostname.toLowerCase()
    if (u.protocol !== 'https:' || u.username || u.password || !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost') || host === 'localhost' || host.includes(':') || /^\d+(\.\d+){3}$/.test(host)) return null
    return u.href
  } catch { return null }
}
export const canonical = (v: unknown): string => JSON.stringify(v, (_, value) => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
