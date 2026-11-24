import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { safeArtifactPath } from './validate.mjs'
import { recordKey } from './consolidate.mjs'
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export class PackageError extends Error {
  constructor(code) { super(code); this.code = code }
}
function localPath(value) {
  if (typeof value !== 'string' || /^(https?:|file:|\\\\|\/\/)/i.test(value)) throw new PackageError('local_path_required')
  return path.resolve(value)
}
function beneath(parent, child) { const relative = path.relative(parent, child); return relative === '' || relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative) }
function noLinks(root, target) {
  if (!beneath(root, target)) throw new PackageError('path_escape')
  let p = root
  if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw new PackageError('symlink_refused')
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    p = path.join(p, part)
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw new PackageError('symlink_refused')
  }
}
export function readJson(value) {
  const target = localPath(value)
  noLinks(ROOT, target)
  if (path.extname(target) !== '.json' || !fs.statSync(target).isFile() || fs.statSync(target).size > 2 * 1024 * 1024) throw new PackageError('invalid_json_file')
  return JSON.parse(fs.readFileSync(target, 'utf8'))
}
export function loadBundle(options = {}) {
  return Object.fromEntries(['cases', 'journeys', 'readiness', 'results'].map(name => [name, readJson(options[name] || path.join(ROOT, name + '.json'))]))
}
export function verifyEvidence(results, directory) {
  const verified = new Set(), errors = []
  if (!directory) return { verified, errors }
  const root = localPath(directory)
  if (!fs.statSync(root).isDirectory() || fs.lstatSync(root).isSymbolicLink()) throw new PackageError('invalid_evidence_directory')
  const realRoot = fs.realpathSync(root)
  for (const r of results.records) {
    if (r.status !== 'passed') continue
    let valid = r.evidence.length > 0
    for (const item of r.evidence) {
      try {
        if (!safeArtifactPath(item.path)) throw new PackageError('invalid_evidence_path')
        const file = path.resolve(root, item.path)
        noLinks(root, file)
        if (!beneath(realRoot, fs.realpathSync(file))) throw new PackageError('path_escape')
        const stat = fs.statSync(file)
        if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw new PackageError('invalid_evidence_file')
        if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== item.sha256) throw new PackageError('hash_mismatch')
      } catch { valid = false; errors.push({ code: 'evidence_not_verified', recordKey: recordKey(r) }); break }
    }
    if (valid) verified.add(recordKey(r))
  }
  return { verified, errors }
}
export function writeReports(directory, json, md) {
  const base = path.join(ROOT, '.output'), target = localPath(directory || base)
  noLinks(ROOT, target)
  if (!beneath(base, target)) throw new PackageError('output_outside_own_directory')
  fs.mkdirSync(target, { recursive: true })
  for (const [name, value] of [['report.json', json], ['report.md', md]]) {
    const destination = path.join(target, name)
    noLinks(ROOT, destination)
    const temporary = path.join(target, '.write-' + randomUUID())
    try {
      fs.writeFileSync(temporary, value, { flag: 'wx' })
      fs.renameSync(temporary, destination)
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    }
  }
}
export function argumentsOf(argv) {
  const allowed = ['cases', 'journeys', 'readiness', 'results', 'evidence-dir', 'out-dir'], options = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.slice(2)
    if (!argv[i]?.startsWith('--') || !allowed.includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--') || Object.hasOwn(options, key)) throw new PackageError('invalid_arguments')
    options[key] = argv[i + 1]
  }
  return options
}
