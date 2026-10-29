// ES-118 · Añade las 8 habilidades técnicas de PerfiladorV2 (backend/seeds/skillCatalogTechnicalDraft.json) a un BORRADOR nuevo del catálogo.
// Nunca publica y no trae criterios de nivel: Alejo o el especialista completan los 4 niveles, la fuente, el verificador y la fecha desde el backoffice.
// Crea el borrador copiando el catálogo vigente (si lo hay) y agrega solo claves NUEVAS: se niega, sin escribir nada, si alguna clave ya existe.
// Uso: node scripts/seedSkillCatalogTechnicalDraft.js   (con DATABASE_URL del entorno destino; en staging o producción, solo con confirmación de Mauricio)
// Aviso: publicar exige TODAS las habilidades completas; este borrador incompleto bloquea publicar cualquier otro cambio hasta completarlas o quitarlas.
// Operador: no imprime contenido; solo cuenta de habilidades.
const { sequelize } = require('../database');
const catalog = require('../utils/skillCatalog');
const seed = require('../seeds/skillCatalogTechnicalDraft.json');

async function main() {
  await sequelize.authenticate();
  await require('../SkillCatalog').sync();
  await require('../SkillDefinition').sync();
  const published = await catalog.getPublished();
  const clash = published ? seed.skills.filter((skill) => published.skills.has(skill.skillKey)).length : 0;
  if (clash) throw Object.assign(new Error('clash'), { code: 'skill_exists' });
  const draft = await catalog.createDraft();
  for (const skill of seed.skills) {
    await catalog.upsertSkill(draft.id, skill.skillKey, { type: skill.type, labels: skill.labels, territories: skill.territories });
  }
  console.log(JSON.stringify({ draftId: draft.id, version: draft.version, added: seed.skills.length, published: false }));
}
main().catch((error) => {
  if (error && error.code === 'draft_exists') console.error('Ya hay un borrador abierto: edítalo o publícalo desde el backoffice.');
  else if (error && error.code === 'skill_exists') console.error('Se niega: alguna de estas claves ya existe en el catálogo vigente. No se escribió nada.');
  else console.error('No se pudo cargar el borrador.');
  process.exitCode = 1;
}).finally(() => sequelize.close());
