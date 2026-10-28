const { DataTypes } = require('sequelize');
const { sequelize } = require('./database');

// Elemento de una versión del catálogo de rutas (ES-31): contexto, fuente, rol, oferta o recurso. `data` es un JSON validado en
// servidor (utils/routeCatalog.js) con claves cerradas. No es dato personal. Tabla nueva: sync() la crea.
const RouteCatalogItem = sequelize.define('RouteCatalogItem', {
  catalogId: { type: DataTypes.INTEGER, allowNull: false },
  kind: { type: DataTypes.STRING(12), allowNull: false }, // contexts | sources | roles | offers | resources
  itemKey: { type: DataTypes.STRING(48), allowNull: false },
  data: { type: DataTypes.JSON, allowNull: false },
}, {
  indexes: [{ unique: true, fields: ['catalogId', 'kind', 'itemKey'] }],
});

module.exports = RouteCatalogItem;
