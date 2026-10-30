// Carga el borrador de catálogo inicial (backend/seeds/skillCatalogDraft.json) como BORRADOR en el backoffice del cliente.
// Nunca publica: el borrador no trae fuente, verificador ni fecha, y el cliente debe completarlos antes de publicar (ES-29).
// Uso: node scripts/seedSkillCatalogDraft.js        (con DATABASE_URL del entorno destino; en producción, solo con confirmación de Mauricio)
// Operador: este script no imprime contenido; solo cuenta de habilidades. Se niega si ya hay un borrador abierto.
const { sequelize } = require('../database');
const catalog = require('../utils/skillCatalog');
const seed = require('../seeds/skillCatalogDraft.json');

async function main() {
  await sequelize.authenticate();
  await require('../SkillCatalog').sync();
  await require('../SkillDefinition').sync();
  const draft = await catalog.createDraft();
  for (const skill of seed.skills) {
    await catalog.upsertSkill(draft.id, skill.skillKey, { type: skill.type, labels: skill.labels, rubric: { levels: skill.levels }, territories: skill.territories });
  }
  console.log(JSON.stringify({ draftId: draft.id, version: draft.version, skills: seed.skills.length, published: false }));
}
main().catch((error) => {
  console.error(error && error.code === 'draft_exists' ? 'Ya hay un borrador abierto: edítalo o publícalo desde el backoffice.' : 'No se pudo cargar el borrador.');
  process.exitCode = 1;
}).finally(() => sequelize.close());
