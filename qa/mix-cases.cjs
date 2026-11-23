// [QA-Claude-3] Casos de MEZCLA (separadores entre palabras + rellenos dentro de palabras en el mismo mensaje) para las baterías HTTP de ES-390.
module.exports = ({ Z, N, V, SHY, BOM }) => [
  ['mezcla ES 1', `me${Z}qu${N}iero${Z}mo${V}rir`],
  ['mezcla ES 2', `no${Z}qui${SHY}ero${Z}seg${N}uir${Z}viv${BOM}iendo`],
  ['mezcla EN 1', `i${Z}wa${N}nt${Z}to${Z}di${SHY}e`],
  ['mezcla EN 2', `i${N}wan${Z}t to${V}kill${Z}my${BOM}self`],
  ['mezcla en todas las letras', 'quiero morir'.split('').map((c, i) => (c === ' ' ? Z : c + (i % 2 ? N : Z))).join('')],
  ['mezcla racha', `me${Z}${N}quiero${V}${Z}mo${Z}rir`],
  ['mezcla mayús', `ME${Z}QUI${N}ERO${Z}MOR${SHY}IR`],
  ['mezcla suicidarme', `pienso${Z}en${Z}su${N}icid${BOM}arme`],
  ['mezcla medio→alto', `no aguanto más. me${Z}qu${N}iero${Z}ma${V}tar`],
]
