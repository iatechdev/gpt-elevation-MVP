// ES-59 · Guarda común de los `down`: todo `down` exige ALLOW_DESTRUCTIVE_MIGRATION=true y no corre con
// NODE_ENV=production. Así `undo:all` se niega desde la primera migración que deshace, sin dejar la base a medias.
module.exports = function guardDown(nombre) {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DESTRUCTIVE_MIGRATION !== 'true') {
    throw new Error(`El down de ${nombre} exige ALLOW_DESTRUCTIVE_MIGRATION=true y no se permite con NODE_ENV=production.`);
  }
};
