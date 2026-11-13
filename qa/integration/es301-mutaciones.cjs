// [QA-Claude] Mutaciones ES-301 servidor (PR #277). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const B = 'C:/Users/Usuario/Documents/qa-pr-253/backend/'; const m = process.argv[2];
const edit = (file, a, b) => { const p = B + file; const s = fs.readFileSync(p, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 80)); fs.writeFileSync(p, s.replace(a, () => b)); };
const T = 'utils/terms.js'; const A = 'routes/auth.js';
if (m === 'Y1') edit(A, 'try { accepted = terms.validate(req.body); }', 'try { if (!(await User.findOne({ where: { email } }))) accepted = terms.validate(req.body); }'); // valida solo si el correo es nuevo (oráculo)
if (m === 'Y2') edit(T, 'acceptedAt: new Date() };', 'acceptedAt: new Date(body.acceptedAt || Date.now()) };'); // fecha del cliente
if (m === 'Y3') edit(T, "const enforced = config.required === true && typeof config.version === 'string' && config.version !== '';", 'const enforced = config.required === true;'); // required sin versión cierra el registro
if (m === 'Y4') edit(T, 'if (body.termsVersion !== config.version) throw', 'if (false) throw'); // no compara versión
if (m === 'Y5') edit(T, 'if (body.acceptedTerms !== true) throw', 'if (!body.acceptedTerms) throw'); // acepta valores «verdaderos»
if (m === 'Y6') edit(T, 'const VERSION_SHAPE = /^[A-Za-z0-9._-]{1,32}$/;', 'const VERSION_SHAPE = /[A-Za-z0-9._-]{1,32}/;'); // regex sin anclar
if (m === 'Y7') edit(A, '...(accepted ? { termsVersion: accepted.termsVersion, acceptedAt: accepted.acceptedAt } : {})', ''); // no guarda
if (m === 'Y8') edit(A, "      // Usuario activo — no se puede registrar con ese email\n", "      if (accepted) await existing.update({ termsVersion: accepted.termsVersion, acceptedAt: accepted.acceptedAt });\n"); // pisa la aceptación del correo existente
if (m === 'Y9') edit(A, "if (error && error.name === 'SequelizeUniqueConstraintError') return", 'if (error) return'); // catch demasiado ancho
if (m === 'Y10') edit('utils/deletionProcessor.js', 'lockedUntil: null, termsVersion: null, acceptedAt: null,', 'lockedUntil: null,'); // purga conserva
if (m === 'Y11') edit('utils/personalData.js', "'termsVersion', 'acceptedAt', ", ''); // no exporta
if (m === 'Y12') edit(T, "if (typeof body.termsVersion !== 'string' || !VERSION_SHAPE.test(body.termsVersion)) throw", 'if (!VERSION_SHAPE.test(body.termsVersion)) throw'); // sin chequear el tipo (acepta números/listas)
if (m === 'Y13') edit(T, "{ currentVersion: config.version });\n  }\n  if (body.acceptedTerms", "{ currentVersion: config.version });\n  }\n  if (body.acceptedTerms"); // (control: sin efecto)
if (m === 'Y14') edit(A, "if (error instanceof terms.TermsError) return res.status(error.status)", 'if (error instanceof terms.TermsError) return res.status(422)'); // 422 en vez de 400
if (m === 'Y15') edit(T, 'const hasAcceptance = Object.hasOwn(body, \'acceptedTerms\') || Object.hasOwn(body, \'termsVersion\');', "const hasAcceptance = Object.hasOwn(body, 'acceptedTerms');"); // solo versión = sin aceptación
if (m === 'Y16') edit('User.js', "type: DataTypes.STRING(32),\n    allowNull: true\n  },\n  acceptedAt", "type: DataTypes.STRING(32),\n    allowNull: false, defaultValue: ''\n  },\n  acceptedAt"); // columna obligatoria
if (m === 'Y17') edit(A, "role: 'user', ...(accepted", "role: req.body.role || 'user', ...(accepted"); // el rol del cuerpo
if (m === 'Y18') edit(T, "if (typeof config.version !== 'string' || config.version === '') throw", 'if (false) throw'); // acepta versión sin texto publicado
console.log('M apl ' + m);
