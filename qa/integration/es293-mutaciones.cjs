// [QA-Claude] Mutaciones ES-293 (PR #270, cabeza a41d28b5). Árbol: C:/Users/Usuario/Documents/qa-pr-253
const fs = require('fs'); const B = 'C:/Users/Usuario/Documents/qa-pr-253/backend/'; const m = process.argv[2];
const edit = (file, a, b) => { const p = B + file; const s = fs.readFileSync(p, 'utf8'); if (s.split(a).length !== 2) throw new Error('no único/no encontrado ' + m + ': ' + a.slice(0, 80)); fs.writeFileSync(p, s.replace(a, () => b)); };
const AM = 'utils/applicationMinimize.js'; const DP = 'utils/deletionProcessor.js';
if (m === 'R1') edit(AM, "[where(fn('lower', col('email')), originalEmail.trim().toLowerCase())]", "[{ email: { [Op.iLike]: '%' + originalEmail.trim() + '%' } }]"); // coincidencia parcial (LIKE)
if (m === 'R2') edit(AM, "originalEmail.trim().toLowerCase())]", "originalEmail.trim())]"); // sin pasar a minúsculas el correo original
if (m === 'R3') edit(AM, "await ProfessionalApplicationFile.destroy({ where: { ApplicationId: row.id }, transaction });", "await ProfessionalApplicationFile.destroy({ where: { ApplicationId: row.id } });"); // la hoja de vida se borra fuera de la transacción
if (m === 'R4') edit(AM, "      userId, minimizedAt: now,", "      minimizedAt: now,"); // no enlaza la solicitud por correo a la persona
if (m === 'R5') edit(AM, "where: { minimizedAt: null, [Op.or]", "where: { [Op.or]"); // vuelve a minimizar las ya minimizadas
if (m === 'R6') edit(DP, "minimizeForPerson(user.id, user.email, transaction)", "minimizeForPerson(user.id, null, transaction)"); // sin coincidencia por correo
if (m === 'R7') edit(AM, "...(row.status === 'pending' ? { status: 'rejected', reviewedAt: now } : {}),", ""); // la pendiente sigue pendiente
if (m === 'R8') edit(AM, "licenseNumber: null, profileUrl: null, message: null,", "licenseNumber: null, profileUrl: null,"); // conserva el mensaje
if (m === 'R9') edit(AM, "name: PLACEHOLDER, email:", "name: row.name, email:"); // conserva el nombre
if (m === 'R10') edit(AM, "    await ProfessionalApplicationFile.destroy({ where: { ApplicationId: row.id }, transaction });\n", ""); // no borra la hoja de vida
if (m === 'R11') edit(AM, "[Op.or]: [{ userId }, ...byEmail]", "[Op.or]: [{ userId: { [Op.ne]: null } }, ...byEmail]"); // toca a todas las solicitudes ligadas a alguien
if (m === 'R12') edit(AM, "reviewedBy: null, reviewNote: null,", "reviewNote: null,"); // conserva quién la revisó
if (m === 'R13') edit(AM, "const hasMinimized = async (userId, transaction) => Boolean(", "const hasMinimized = async (userId, transaction) => false && Boolean("); // el recibo no declara la categoría
if (m === 'R14') edit(DP, "      await minimizeForPerson(user.id, user.email, transaction);\n", ""); // no minimiza
console.log('M apl ' + m);
