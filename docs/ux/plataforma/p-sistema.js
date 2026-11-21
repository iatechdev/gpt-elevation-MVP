/* Sistema de diseño: la página que desarrollo debe copiar. Los contrastes se calculan en vivo con los tokens reales. */
copy({
 sy_t:'Sistema de diseño',sy_p:'Tokens y componentes de Elevation. Todo lo que se ve en la plataforma sale de aquí. Los contrastes se calculan con los valores reales, en el tema que tengas activo.',
 sy_col:'Color',sy_col_p:'La marca es un azul de tinta de plano. El rojo existe solo para errores. Las curvas siena son el relieve del mapa.',
 sy_tok:'Token',sy_use:'Uso',sy_ratio:'Contraste sobre el fondo',
 sy_ground:'Fondo de la hoja',sy_panel:'Paneles y tarjetas',sy_ink:'Texto y trazos principales',sy_muted:'Texto de apoyo',sy_mark:'Marca: enlaces, foco, pistas, selección',sy_err:'Errores y acciones destructivas',sy_good:'Confirmado',sy_cont:'Curvas de nivel del mapa',sy_line:'Líneas finas',
 sy_ty:'Tipografía',sy_ty1:'Rótulos y títulos: Barlow Condensed, mayúsculas',sy_ty2:'Nombres de capacidades y voz de la plataforma: Spectral cursiva',sy_ty3:'Texto corrido: Barlow, 17 px, interlínea 1,55',
 sy_ty_s:'Licencias de las tipografías: por confirmar antes de producción.',
 sy_btn:'Botones',sy_b1:'Primario',sy_b2:'Secundario',sy_b3:'Destructivo',sy_b4:'Deshabilitado',sy_b5:'Enlace de acción',sy_btn_p:'Un solo botón primario por vista. Los botones dicen lo que pasa. Altura mínima 46 px.',
 sy_fld:'Campos',sy_f1:'Texto',sy_f1v:'Escribe aquí',sy_f2:'Con error',sy_f2e:'Este campo es obligatorio.',sy_f3:'Selección',sy_f4:'Casilla',sy_f5:'Escala de niveles',
 sy_cmp:'Piezas',sy_chip:'Chips de estado',sy_c1:'Borrador',sy_c2:'Confirmada',sy_c3:'Sin evaluar',sy_c4:'Ejemplo',
 sy_ban:'Avisos',sy_ban1:'Aviso informativo',sy_ban1p:'Para decir qué pasó o qué sigue.',sy_ban2:'Aviso de error',sy_ban2p:'Dice qué pasó, qué se conservó y qué hacer.',
 sy_pista:'Pista con su frase',sy_pista_p:'Se apoya en «reorganicé la entrega». Es una sugerencia, no una evaluación.',
 sy_rel:'Relieve',sy_rel_p:'Cada línea gruesa es un nivel registrado por la persona. Lo que no tiene evidencia queda plano.',
 sy_a11y:'Accesibilidad',sy_a1:'Foco visible en todo control: contorno de 3 px con el color de marca.',sy_a2:'Objetivos táctiles de 46 px o más.',sy_a3:'El color nunca es la única señal: siempre hay texto o forma.',sy_a4:'Respeta «reducir movimiento»: sin animaciones si el sistema lo pide.',sy_a5:'Textos en ES y EN con la misma estructura. El inglés es borrador.',
 routes:{sistema:'Sistema de diseño'}
},{
 sy_t:'Design system',sy_p:'Elevation tokens and components. Everything in the platform comes from here. Contrast ratios are computed from the real values in the theme you have active.',
 sy_col:'Colour',sy_col_p:'The brand is a survey-ink blue. Red exists only for errors. Sienna contours are the map relief.',
 sy_tok:'Token',sy_use:'Use',sy_ratio:'Contrast on the ground',
 sy_ground:'Sheet ground',sy_panel:'Panels and cards',sy_ink:'Main text and strokes',sy_muted:'Supporting text',sy_mark:'Brand: links, focus, hints, selection',sy_err:'Errors and destructive actions',sy_good:'Confirmed',sy_cont:'Map contour lines',sy_line:'Hairlines',
 sy_ty:'Typography',sy_ty1:'Labels and titles: Barlow Condensed, caps',sy_ty2:'Capability names and platform voice: Spectral italic',sy_ty3:'Body text: Barlow, 17 px, line height 1.55',
 sy_ty_s:'Typeface licences: to be confirmed before production.',
 sy_btn:'Buttons',sy_b1:'Primary',sy_b2:'Secondary',sy_b3:'Destructive',sy_b4:'Disabled',sy_b5:'Action link',sy_btn_p:'One primary button per view. Buttons say what happens. Minimum height 46 px.',
 sy_fld:'Fields',sy_f1:'Text',sy_f1v:'Type here',sy_f2:'With error',sy_f2e:'This field is required.',sy_f3:'Select',sy_f4:'Checkbox',sy_f5:'Level scale',
 sy_cmp:'Pieces',sy_chip:'Status chips',sy_c1:'Draft',sy_c2:'Confirmed',sy_c3:'Not assessed',sy_c4:'Sample',
 sy_ban:'Notices',sy_ban1:'Information notice',sy_ban1p:'To say what happened or what comes next.',sy_ban2:'Error notice',sy_ban2p:'Says what happened, what was kept and what to do.',
 sy_pista:'Hint with its phrase',sy_pista_p:'It rests on “rearranged the delivery”. It is a suggestion, not an assessment.',
 sy_rel:'Relief',sy_rel_p:'Each thick line is a level the person recorded. What has no evidence stays flat.',
 sy_a11y:'Accessibility',sy_a1:'Visible focus on every control: 3 px outline in the brand colour.',sy_a2:'Touch targets of 46 px or more.',sy_a3:'Colour is never the only signal: there is always text or shape.',sy_a4:'Respects reduced motion: no animation if the system asks.',sy_a5:'ES and EN texts with the same structure. The English is a draft.',
 routes:{sistema:'Design system'}
});
addRoutes('g_sys',['sistema']);
function lum(c){var m=c.match(/#([0-9a-f]{6})/i);if(!m)return null;var v=[0,2,4].map(function(i){var x=parseInt(m[1].substr(i,2),16)/255;return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*v[0]+.7152*v[1]+.0722*v[2]}
function ratio(a,b){var A=lum(a),B=lum(b);if(A===null||B===null)return'';var hi=Math.max(A,B),lo=Math.min(A,B);return((hi+.05)/(lo+.05)).toFixed(1).replace('.',S.lang==='es'?',':'.')+':1'}
V.sistema=function(){var g=css('--ground'),toks=[['--ground','sy_ground'],['--panel','sy_panel'],['--ink','sy_ink'],['--muted','sy_muted'],['--mark','sy_mark'],['--err','sy_err'],['--good','sy_good'],['--contour','sy_cont'],['--line','sy_line']];
 var rows=toks.map(function(k){var v=css(k[0]);return'<tr><td><i class="swa" style="background:'+v+'"></i></td><td><code>'+k[0]+'</code> <span class="muted small">'+v+'</span></td><td>'+t(k[1])+'</td><td>'+(k[0]==='--ground'||k[0]==='--panel'||k[0]==='--line'?'':ratio(v,g))+'</td></tr>'}).join('');
 var sec=function(id,title,body){return'<section class="sysx" aria-labelledby="'+id+'"><h2 id="'+id+'">'+title+'</h2>'+body+'</section>'};
 return'<main><div style="padding:1.2rem 0 .4rem"><h1 class="s">'+t('sy_t')+'</h1><p class="muted" style="max-width:44rem">'+t('sy_p')+'</p></div>'+
 sec('s1',t('sy_col'),'<p class="muted">'+t('sy_col_p')+'</p><div class="tw"><table class="tok"><thead><tr><th></th><th>'+t('sy_tok')+'</th><th>'+t('sy_use')+'</th><th>'+t('sy_ratio')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>')+
 sec('s2',t('sy_ty'),'<p class="h1x">Elevation</p><p style="font:700 1.7rem var(--cond);text-transform:uppercase;margin:.4rem 0">'+t('sy_ty1')+'</p><p class="nm">'+t('sy_ty2')+'</p><p>'+t('sy_ty3')+'</p><p class="muted small">'+t('sy_ty_s')+'</p>')+
 sec('s3',t('sy_btn'),'<div class="row"><button class="btn">'+t('sy_b1')+'</button><button class="btn ghost">'+t('sy_b2')+'</button><button class="btn danger">'+t('sy_b3')+'</button><button class="btn" disabled>'+t('sy_b4')+'</button><button class="lnk">'+t('sy_b5')+'</button></div><p class="muted small">'+t('sy_btn_p')+'</p>')+
 sec('s4',t('sy_fld'),'<div class="gal"><div><div class="fld" style="margin-top:0"><label for="sy1">'+t('sy_f1')+'</label><input id="sy1" type="text" placeholder="'+esc(t('sy_f1v'))+'"></div><div class="fld"><label for="sy2">'+t('sy_f2')+'</label><input id="sy2" type="text" aria-invalid="true" aria-describedby="sy2e" class="bad"><p class="err" id="sy2e">'+t('sy_f2e')+'</p></div></div><div><div class="fld" style="margin-top:0"><label for="sy3">'+t('sy_f3')+'</label><select id="sy3"><option>'+t('cap')[3]+'</option><option>'+t('cap')[5]+'</option></select></div><label class="check"><input type="checkbox"><span>'+t('sy_f4')+'</span></label><p class="tag" style="margin:1rem 0 0">'+t('sy_f5')+'</p><div class="opts"><label><input type="radio" name="sy4" checked>1</label><label><input type="radio" name="sy4">2</label><label><input type="radio" name="sy4">3</label><label><input type="radio" name="sy4">4</label></div></div></div>')+
 sec('s5',t('sy_cmp'),'<p class="tag">'+t('sy_chip')+'</p><div class="row" style="margin-top:.3rem"><span class="chip wait">'+t('sy_c1')+'</span><span class="chip ok">'+t('sy_c2')+'</span><span class="chip">'+t('sy_c3')+'</span><span class="chip">'+t('sy_c4')+'</span></div><p class="tag" style="margin-top:1.2rem">'+t('sy_ban')+'</p><div class="gal"><div class="banner" role="note"><b>'+t('sy_ban1')+'</b>'+t('sy_ban1p')+'</div><div class="banner bad" role="note"><b>'+t('sy_ban2')+'</b>'+t('sy_ban2p')+'</div></div><p class="tag" style="margin-top:1rem">'+t('sy_pista')+'</p><div class="pista" style="max-width:34rem"><p class="tag" style="margin:0">'+t('c5h')+'</p><p>'+t('sy_pista_p')+'</p></div>')+
 sec('s6',t('sy_rel'),'<p class="muted">'+t('sy_rel_p')+'</p><div class="mapbox" style="aspect-ratio:21/8;max-width:46rem"><canvas id="c-sys" aria-hidden="true"></canvas></div>')+
 sec('s7',t('sy_a11y'),'<ul><li>'+t('sy_a1')+'</li><li>'+t('sy_a2')+'</li><li>'+t('sy_a3')+'</li><li>'+t('sy_a4')+'</li><li>'+t('sy_a5')+'</li></ul>')+'</main>'};
