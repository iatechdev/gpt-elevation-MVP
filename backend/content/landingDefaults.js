const catalog = require('../../shared/landing-content.json');

const defaults = Object.fromEntries(['es', 'en'].map(lang => [
  lang, Object.fromEntries(catalog.map(entry => [entry.key, entry[lang]])),
]));

module.exports = { catalog, defaults };
