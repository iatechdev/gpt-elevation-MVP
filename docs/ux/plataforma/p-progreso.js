/* /app/progress «Tu progreso» (HU-052, HU-060) y /app/feedback «Tu opinión» (ES-54, vista de revisión con datos ficticios).
   Textos reales: pages/UserProgress.tsx, i18n (rec_*), pilot/copy.ts. Cifras, fechas y recomendaciones son EJEMPLOS.
   Cambios propuestos respecto al código: los emojis de ánimo y de categoría se sustituyen por palabras (las mismas del check-in), las estrellas llevan texto («4 de 5»),
   la flecha de entrada/salida lleva palabra y no depende del color verde/rojo, y se añade la aclaración «no es una medición de salud».
   El permiso real de «Tu opinión» está pendiente del contrato de Mauricio: la franja «Vista de revisión» se retira cuando exista. */
copy({
 nav_prog:'Mi progreso',nav_op:'Tu opinión',
 pr_t:'Tu progreso',pr_p:'Últimos 30 días',pr_note:'Esto es un registro tuyo, no una medición de salud ni un diagnóstico.',pr_find:'Buscar terapeuta',
 pr_s1:'Sesiones totales',pr_s2:'Ánimo promedio',pr_s3:'Valoración promedio',pr_s4:'Racha actual',pr_day:'día',pr_days:'días',pr_of5:'{n} de 5',
 pr_rec:'Recomendaciones para ti',pr_recn:'Sugerencias generadas a partir de tus registros. Son ideas para probar, no indicaciones.',pr_new:'Nueva',
 pr_c_mindfulness:'Mindfulness',pr_c_habit:'Hábito',pr_c_reflection:'Reflexión',pr_c_resource:'Recurso',
 pr_r1:'Antes de abrir el correo, haz tres respiraciones lentas y elige qué atender primero.',pr_r2:'Deja preparada hoy la primera tarea de mañana: arrancar cuesta menos.',pr_r3:'Anota una cosa que hiciste hoy y que no estaba en tu lista.',
 pr_mood:'Historial emocional',pr_mood0:'Aún no hay registros.',pr_in:'Entrada',pr_out:'Salida',pr_up:'subió',pr_down:'bajó',pr_same:'igual',
 pr_rate:'Calificaciones',pr_rate0:'Aún no hay calificaciones.',
 pr_load:'Cargando tu progreso…',pr_err:'No se pudo cargar tu progreso.',pr_retry:'Reintentar',pr_empty:'Todavía no hay nada que mostrar. Aparecerá aquí cuando hagas tu primer registro del día.',pr_go:'Hacer mi registro de hoy',
 pr_p0:'Prototipo:',pr_pa:'ver normal',pr_pb:'ver cargando',pr_pc:'ver error',pr_pd:'ver sin registros',
 op_t:'Tu opinión es opcional',op_opt:'Puedes omitir preguntas o salir. Esto no cambia tu acceso ni tus opciones.',op_prev:'Vista de revisión · datos ficticios',op_prevp:'Todavía no se recogen respuestas reales: nada se envía ni se guarda en un servidor, y recargar borra lo que escribas.',
 op_q1:'¿Has encontrado algo que te haya servido aquí?',op_q2:'¿En qué ámbito? (opcional)',op_q3:'¿Te has sentido escuchado?',op_q4:'¿Te has sentido respetado?',op_q5:'Si exploraste opciones profesionales: ¿encontraste una opción pertinente o un siguiente paso más claro?',op_q6:'¿Qué ayudó? (opcional, sin añadir textos personales)',
 op_yes:'Sí',op_no:'No',op_unsure:'No estoy seguro',op_skip:'No responder',op_ne:'No he explorado esa parte',op_personal:'Personal',op_career:'Profesional',op_both:'Ambos',
 op_ideas:'Ordenar ideas',op_experience:'Reconocer experiencia',op_next_step:'Aclarar un siguiente paso',op_other:'Otra ayuda, sin detallar',
 op_loading:'Cargando…',op_dirty:'Cambios sin guardar',op_empty:'Aún no hay una respuesta guardada.',op_saving:'Guardando…',op_saved:'Respuesta guardada.',op_save:'Guardar respuestas',op_leave:'Salir sin responder',
 op_loadError:'No pudimos cargar tu respuesta.',op_saveError:'No pudimos guardar. Tus respuestas siguen en esta pantalla.',op_unknown:'No pudimos confirmar el guardado. Consulta antes de reintentar.',
 op_conflict:'La respuesta guardada cambió. Tu borrador sigue aquí; revisa la versión guardada antes de continuar.',op_retry:'Reintentar carga',op_check:'Consultar estado',op_retrySave:'Reintentar el mismo envío',op_review:'Revisar versión guardada',
 op_withdraw:'Retirar mi respuesta',op_withdrawText:'Se retirará tu respuesta. No cambia tus permisos ni tu acceso.',op_stay:'Permanecer',op_confirm:'Confirmar retirada',op_removed:'Respuesta retirada.',
 op_exit:'Si sales, perderás el borrador o la referencia del envío.',op_session:'Tu sesión cambió o venció. Inicia sesión para continuar.',op_login:'Iniciar sesión',
 op_p:'Prototipo:',op_p1:'ver «no pudimos confirmar»',op_p2:'ver cambio en la versión guardada',op_p3:'ver error de carga',op_p4:'ver con respuesta guardada',op_p0:'ver vacío',
 routes:{progreso:'Tu progreso',opinion:'Tu opinión'}
},{
 nav_prog:'My progress',nav_op:'Your feedback',
 pr_t:'Your progress',pr_p:'Last 30 days',pr_note:'This is your own record, not a health measurement or a diagnosis.',pr_find:'Find therapist',
 pr_s1:'Total sessions',pr_s2:'Average mood',pr_s3:'Average rating',pr_s4:'Current streak',pr_day:'day',pr_days:'days',pr_of5:'{n} of 5',
 pr_rec:'Recommendations for you',pr_recn:'Suggestions generated from your records. They are ideas to try, not instructions.',pr_new:'New',
 pr_c_mindfulness:'Mindfulness',pr_c_habit:'Habit',pr_c_reflection:'Reflection',pr_c_resource:'Resource',
 pr_r1:'Before opening your email, take three slow breaths and choose what to handle first.',pr_r2:'Set up tomorrow’s first task today: starting costs less.',pr_r3:'Note one thing you did today that was not on your list.',
 pr_mood:'Emotional history',pr_mood0:'No records yet.',pr_in:'Check-in',pr_out:'Check-out',pr_up:'went up',pr_down:'went down',pr_same:'same',
 pr_rate:'Session ratings',pr_rate0:'No ratings yet.',
 pr_load:'Loading your progress…',pr_err:'Could not load your progress.',pr_retry:'Retry',pr_empty:'Nothing to show yet. It will appear here once you make your first check-in.',pr_go:'Make today’s check-in',
 pr_p0:'Prototype:',pr_pa:'see normal',pr_pb:'see loading',pr_pc:'see error',pr_pd:'see no records',
 op_t:'Your feedback is optional',op_opt:'You can skip questions or leave. This does not change your access or options.',op_prev:'Review preview · fictional data',op_prevp:'Real responses are not collected yet: nothing is sent to or saved on a server, and reloading clears what you write.',
 op_q1:'Have you found something useful here?',op_q2:'In which area? (optional)',op_q3:'Have you felt listened to?',op_q4:'Have you felt respected?',op_q5:'If you explored career options: did you find a relevant option or a clearer next step?',op_q6:'What helped? (optional, without adding personal text)',
 op_yes:'Yes',op_no:'No',op_unsure:'Not sure',op_skip:'Skip this question',op_ne:'I have not explored that area',op_personal:'Personal',op_career:'Career-related',op_both:'Both',
 op_ideas:'Organizing ideas',op_experience:'Recognizing experience',op_next_step:'Clarifying a next step',op_other:'Other help, without details',
 op_loading:'Loading…',op_dirty:'Unsaved changes',op_empty:'No saved response yet.',op_saving:'Saving…',op_saved:'Response saved.',op_save:'Save responses',op_leave:'Leave without responding',
 op_loadError:'We could not load your response.',op_saveError:'We could not save. Your responses remain on this screen.',op_unknown:'We could not confirm the save. Check before retrying.',
 op_conflict:'The saved response changed. Your draft remains here; review the saved version before continuing.',op_retry:'Retry loading',op_check:'Check status',op_retrySave:'Retry the same submission',op_review:'Review saved version',
 op_withdraw:'Withdraw my response',op_withdrawText:'Your response will be withdrawn. This does not change your permissions or access.',op_stay:'Stay',op_confirm:'Confirm withdrawal',op_removed:'Response withdrawn.',
 op_exit:'Leaving will discard the draft or submission reference.',op_session:'Your session changed or expired. Sign in to continue.',op_login:'Sign in',
 op_p:'Prototype:',op_p1:'see “could not confirm”',op_p2:'see saved version changed',op_p3:'see load error',op_p4:'see with a saved response',op_p0:'see empty',
 routes:{progreso:'Your progress',opinion:'Your feedback'}
});
addRoutes('g_per',['progreso','opinion']);
/* ---------- Tu progreso ---------- */
S.pr={mode:'ok'};
var PRM=[{d:'2026-11-04',i:3,o:4},{d:'2026-11-03',i:2,o:2},{d:'2026-11-01',i:4,o:3},{d:'2026-10-30',i:3,o:5},{d:'2026-10-28',i:2,o:3}];
var PRR=[{d:'2026-11-04',r:5},{d:'2026-11-01',r:4},{d:'2026-10-30',r:5},{d:'2026-10-27',r:3}];
var PRC=[['mindfulness','pr_r1',false],['habit','pr_r2',true],['reflection','pr_r3',false]];
function prDate(s){return new Date(s+'T12:00:00').toLocaleDateString(S.lang==='es'?'es-CO':'en',{day:'2-digit',month:'short',year:'numeric'})}
V.progreso=function(){var m=S.pr.mode;
 var h='<main class="narrow"><div style="padding:1.2rem 0 .6rem"><div class="row" style="justify-content:space-between;align-items:center;margin:0 0 .8rem"><a class="btn ghost" href="#chat">← '+t('nav_chat')+'</a><a class="btn" href="#terapeuta" data-act="prfind">'+t('pr_find')+'</a></div><h1 class="s" id="pr-h" tabindex="-1">'+t('pr_t')+'</h1><p class="muted">'+t('pr_p')+'</p><p class="small muted" style="max-width:36rem">'+t('pr_note')+'</p></div>';
 var proto='<p class="small muted" style="margin:1.4rem 0">'+t('pr_p0')+' <button class="lnk" data-act="prsim" data-v="ok">'+t('pr_pa')+'</button> · <button class="lnk" data-act="prsim" data-v="load">'+t('pr_pb')+'</button> · <button class="lnk" data-act="prsim" data-v="err">'+t('pr_pc')+'</button> · <button class="lnk" data-act="prsim" data-v="empty">'+t('pr_pd')+'</button></p>';
 if(m==='load')return h+'<div role="status" style="padding:2rem 0"><div class="pulse" aria-hidden="true"></div><p>'+t('pr_load')+'</p></div>'+proto+'</main>';
 if(m==='err')return h+'<div class="banner bad" role="alert" id="pr-st" tabindex="-1"><b>'+t('pr_err')+'</b><div class="row"><button class="btn" data-act="prretry">'+t('pr_retry')+'</button></div></div>'+proto+'</main>';
 if(m==='empty')return h+'<p role="status">'+t('pr_empty')+'</p><div class="row"><a class="btn" href="#checkin">'+t('pr_go')+'</a></div>'+proto+'</main>';
 var mw=function(n){return t('ck_'+Math.max(1,Math.min(5,Math.round(n))))};
 var stats=[[t('pr_s1'),'9'],[t('pr_s2'),(S.lang==='es'?'3,6':'3.6')+' · '+mw(3.6)],[t('pr_s3'),t('pr_of5',{n:S.lang==='es'?'4,4':'4.4'})],[t('pr_s4'),'5 '+t('pr_days')]];
 h+='<dl class="sum" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr));gap:1rem;margin:0 0 1.6rem">'+stats.map(function(s){return'<div class="card" style="margin:0"><dt class="small muted">'+s[0]+'</dt><dd class="nm" style="margin:0;font-size:1.6rem">'+s[1]+'</dd></div>'}).join('')+'</dl>';
 h+='<section class="card" aria-labelledby="pr-rec"><h2 id="pr-rec" style="font-size:1.4rem">'+t('pr_rec')+'</h2><p class="small muted">'+t('pr_recn')+'</p><div class="stack">'+PRC.map(function(c){return'<div class="item"><p class="tag" style="margin:0">'+t('pr_c_'+c[0])+(c[2]?' · <span class="chip wait">'+t('pr_new')+'</span>':'')+'</p><p class="nm" style="margin:0;font-size:1.2rem">'+t(c[1])+'</p></div>'}).join('')+'</div></section>';
 h+='<div class="two" style="margin-top:1rem"><section class="card" aria-labelledby="pr-mood"><h2 id="pr-mood" style="font-size:1.4rem">'+t('pr_mood')+'</h2>'+(PRM.length?'<ul class="plain" style="list-style:none;padding:0;margin:0">'+PRM.map(function(l){var d=l.o>l.i?'pr_up':l.o<l.i?'pr_down':'pr_same';return'<li class="item" style="grid-template-columns:1fr;gap:.1rem"><span class="small muted">'+prDate(l.d)+'</span><span>'+t('pr_in')+': '+t('ck_'+l.i)+' → '+t('pr_out')+': '+t('ck_'+l.o)+' <span class="chip">'+t(d)+'</span></span></li>'}).join('')+'</ul>':'<p>'+t('pr_mood0')+'</p>')+'</section>'+
  '<section class="card" aria-labelledby="pr-rate"><h2 id="pr-rate" style="font-size:1.4rem">'+t('pr_rate')+'</h2>'+(PRR.length?'<ul style="list-style:none;padding:0;margin:0">'+PRR.map(function(r){return'<li class="item" style="grid-template-columns:1fr;gap:.1rem"><span class="small muted">'+prDate(r.d)+'</span><span><span aria-hidden="true" style="letter-spacing:.1em;color:var(--mark)">'+'★'.repeat(r.r)+'<span style="color:var(--line)">'+'★'.repeat(5-r.r)+'</span></span> '+t('pr_of5',{n:r.r})+'</span></li>'}).join('')+'</ul>':'<p>'+t('pr_rate0')+'</p>')+'</section></div>';
 return h+proto+'</main>'};
ACTS.prsim=function(b,v){S.pr.mode=v;render()};
ACTS.prretry=function(){var p=S.pr;p.mode='load';render();setTimeout(function(){p.mode=S.mode==='ok'?'ok':'err';render();bjFoc(p.mode==='ok'?'pr-h':'pr-st')},600)};
ACTS.prfind=function(){setTimeout(function(){if(S.route==='terapeuta'&&ACTS.thmatch)ACTS.thmatch()},60)};
/* ---------- Tu opinión ---------- */
var OPQ=[['init','op_q1',['yes','no','unsure']],['area','op_q2',['personal','career','both']],['lis','op_q3',['yes','no','unsure']],['res','op_q4',['yes','no','unsure']],['pro','op_q5',['yes','no','unsure','ne']]];
var OPH=['ideas','experience','next_step','other'];
function opBlank(){return{init:null,area:null,lis:null,res:null,pro:null,help:[],skip:[]}}
function opCopy(a){return JSON.parse(JSON.stringify(a))}
S.op={saved:null,draft:opBlank(),ph:'ok',notice:'',busy:false,intent:false,dlg:false};
function opHas(d){return d.init||d.area||d.lis||d.res||d.pro||d.help.length>0||d.skip.length>0}
function opDirty(){var o=S.op,s=o.saved||opBlank();return JSON.stringify(o.draft)!==JSON.stringify(s)}
V.opinion=function(){var o=S.op,d=o.draft,dirty=opDirty(),dis=o.busy||o.intent||o.ph==='load'?' disabled':'';
 var h='<main class="narrow"><div style="padding:1.2rem 0 .6rem"><h1 class="s" id="op-h" tabindex="-1">'+t('op_t')+'</h1><p style="max-width:38rem">'+t('op_opt')+'</p></div>'+
  '<p class="banner" role="note"><b>'+t('op_prev')+'</b>'+t('op_prevp')+'</p>';
 var msg=o.ph==='load'?t('op_loading'):o.busy?t('op_saving'):o.notice?t('op_'+o.notice):dirty?t('op_dirty'):o.saved?t('op_saved'):t('op_empty');
 h+='<p role="status" aria-live="polite" id="op-st" tabindex="-1" style="min-height:1.5em">'+msg+'</p>';
 if(o.notice==='loadError')h+='<div class="row"><button class="btn" data-act="opload">'+t('op_retry')+'</button></div>';
 if(o.ph!=='load'){
  h+='<form id="f-op" novalidate><fieldset class="fld" style="border:0;padding:0"'+dis+'>';
  OPQ.forEach(function(q,qi){if(q[0]==='area'&&d.init!=='yes')return;var v=d[q[0]],sk=d.skip.indexOf(q[0])>-1;
   h+='<div class="card" style="margin:0 0 1rem"><fieldset class="fld" style="border:0;padding:0;margin:0"><legend>'+t(q[1])+'</legend><div class="opts">'+q[2].map(function(x){return'<label><input type="radio" name="op-'+q[0]+'" value="'+x+'"'+(v===x?' checked':'')+'>'+t('op_'+x)+'</label>'}).join('')+'<label><input type="radio" name="op-'+q[0]+'" value=""'+(v===null&&sk?' checked':'')+'>'+t('op_skip')+'</label></div></fieldset></div>'});
  h+='<div class="card" style="margin:0 0 1rem"><fieldset class="fld" style="border:0;padding:0;margin:0"><legend>'+t('op_q6')+'</legend><div class="opts">'+OPH.map(function(x){return'<label><input type="checkbox" id="op-h-'+x+'"'+(d.help.indexOf(x)>-1?' checked':'')+'>'+t('op_'+x)+'</label>'}).join('')+'</div></fieldset></div>';
  h+='</fieldset><div class="row"><button class="btn" id="op-save"'+(!opHas(d)||!dirty||o.notice==='conflict'||o.busy||o.intent?' disabled':'')+'>'+t('op_save')+'</button></div></form>'}
 if(o.intent)h+='<div class="row"><button class="btn ghost" data-act="opcheck"'+(o.busy?' disabled':'')+'>'+t('op_check')+'</button>'+(o.notice==='unknown'?'<button class="btn ghost" data-act="opsame"'+(o.busy?' disabled':'')+'>'+t('op_retrySave')+'</button>':'')+'</div>';
 if(o.notice==='conflict')h+='<div class="row"><button class="btn ghost" data-act="opload">'+t('op_review')+'</button></div>';
 h+='<div class="row"><a class="btn ghost" href="#inicio">'+t('op_leave')+'</a>'+(o.saved?'<button class="btn ghost danger" id="op-wd" data-act="opwd"'+(o.busy||o.intent?' disabled':'')+'>'+t('op_withdraw')+'</button>':'')+'</div>';
 h+='<p class="small muted" style="margin:1.4rem 0">'+t('op_p')+' <button class="lnk" data-act="opsim" data-v="empty">'+t('op_p0')+'</button> · <button class="lnk" data-act="opsim" data-v="saved">'+t('op_p4')+'</button> · <button class="lnk" data-act="opsim" data-v="unknown">'+t('op_p1')+'</button> · <button class="lnk" data-act="opsim" data-v="conflict">'+t('op_p2')+'</button> · <button class="lnk" data-act="opsim" data-v="loadError">'+t('op_p3')+'</button></p></main>';
 if(o.dlg)h+='<div class="scrim"><div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="opd-t"><h2 id="opd-t" style="font-size:1.4rem">'+t('op_withdraw')+'</h2><p>'+t('op_withdrawText')+'</p><div class="row"><button class="btn ghost" id="opd-x" data-act="opdx">'+t('op_stay')+'</button><button class="btn danger" data-act="opdok">'+t('op_confirm')+'</button></div></div></div>';
 return h};
ACTS.opsim=function(b,v){var o=S.op;o.dlg=false;o.busy=false;o.intent=false;o.ph='ok';o.notice='';
 if(v==='empty'){o.saved=null;o.draft=opBlank()}
 else{o.saved={init:'yes',area:'career',lis:'yes',res:'yes',pro:'unsure',help:['ideas','next_step'],skip:[]};if(v==='saved'){o.draft=opCopy(o.saved)}
  else if(v==='unknown'){o.draft=opCopy(o.saved);o.draft.res='unsure';o.intent=true;o.notice='unknown'}
  else if(v==='conflict'){o.draft=opCopy(o.saved);o.draft.lis='unsure';o.notice='conflict'}
  else if(v==='loadError'){o.draft=opBlank();o.saved=null;o.notice='loadError'}}
 render()};
ACTS.opload=function(){var o=S.op;o.ph='load';o.notice='';render();setTimeout(function(){o.ph='ok';if(S.mode!=='ok'){o.notice='loadError'}else{o.notice='';if(!o.saved)o.saved={init:'yes',area:'career',lis:'yes',res:'yes',pro:'unsure',help:['ideas'],skip:[]};o.draft=opCopy(o.saved);o.intent=false}render();bjFoc('op-st')},600)};
SUBS['f-op']=function(){var o=S.op;if(o.busy||o.intent||!opHas(o.draft)||!opDirty())return;o.busy=true;o.notice='';render();bjFoc('op-st');
 setTimeout(function(){o.busy=false;
  if(S.mode==='offline'){o.intent=true;o.notice='unknown'}else if(S.mode==='limit'){o.notice='saveError'}else{o.saved=opCopy(o.draft);o.notice='';o.intent=false}
  render();bjFoc('op-st')},700)};
ACTS.opcheck=function(){var o=S.op;if(o.busy)return;o.busy=true;render();setTimeout(function(){o.busy=false;if(S.mode==='ok'){o.saved=opCopy(o.draft);o.intent=false;o.notice=''}else o.notice='unknown';render();bjFoc('op-st')},500)};
ACTS.opsame=function(){var o=S.op;if(o.busy)return;o.busy=true;render();setTimeout(function(){o.busy=false;if(S.mode==='ok'){o.saved=opCopy(o.draft);o.intent=false;o.notice=''}else o.notice='unknown';render();bjFoc('op-st')},700)};
ACTS.opwd=function(){S.op.dlg=true;render();bjFoc('opd-x')};
ACTS.opdx=function(){S.op.dlg=false;render();bjFoc('op-wd')};
ACTS.opdok=function(){var o=S.op;o.dlg=false;o.busy=true;render();setTimeout(function(){o.busy=false;if(S.mode!=='ok'){o.notice='unknown'}else{o.saved=null;o.draft=opBlank();o.notice='removed'}render();bjFoc('op-st')},600)};
document.addEventListener('change',function(e){if(S.route!=='opinion')return;var el=e.target,o=S.op,d=o.draft;
 if(el.type==='radio'&&el.name.indexOf('op-')===0){var k=el.name.slice(3);d[k]=el.value||null;var i=d.skip.indexOf(k);if(!el.value){if(i<0)d.skip.push(k)}else if(i>-1)d.skip.splice(i,1);
  if(k==='init'&&el.value!=='yes'){d.area=null;var j=d.skip.indexOf('area');if(j>-1)d.skip.splice(j,1)}
  o.notice=o.notice==='saved'||o.notice==='removed'?'':o.notice;render();var f=document.querySelector('input[name="'+el.name+'"][value="'+el.value+'"]');if(f)f.focus()}
 else if(el.id&&el.id.indexOf('op-h-')===0){var x=el.id.slice(5),p=d.help.indexOf(x);if(el.checked&&p<0)d.help.push(x);else if(!el.checked&&p>-1)d.help.splice(p,1);o.notice=o.notice==='saved'||o.notice==='removed'?'':o.notice;render();bjFoc(el.id)}});
document.addEventListener('keydown',function(e){if(S.route!=='opinion'||!S.op.dlg)return;if(e.key==='Escape'&&!S.op.busy){ACTS.opdx();return}
 if(e.key==='Tab'){var b=[].slice.call(document.querySelectorAll('.dlg button:not([disabled])'));if(!b.length)return;var f=b[0],l=b[b.length-1];if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus()}else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus()}}});
