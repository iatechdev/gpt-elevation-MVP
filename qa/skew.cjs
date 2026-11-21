// [QA-Claude-3] Precarga de Node: desfasa el reloj de ESTE proceso (SKEW_MS, puede ser negativo). Solo para pruebas de QA con varias instancias.
const off = Number(process.env.SKEW_MS || 0); const RD = Date
if (off) { class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a) } static now() { return RD.now() + off } }; global.Date = D }
