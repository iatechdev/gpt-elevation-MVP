/* /app/space/tools «Mis herramientas», /app/exercises «Ejercicios opcionales» (ES-12) y /app/compass «Brújula profesional» (ES-13).
   Los textos de ejercicios y Brújula son los reales (exercises/copy.ts, shared/companion-exercises.json, compass/copy.ts); las descripciones de las tarjetas de «Mis herramientas»,
   la etiqueta «Categoría», la lectura de «vence» y las personas/fechas de las versiones son PROPUESTAS o EJEMPLOS marcados.
   Regla del servidor que aquí se simula: un texto con «salud», «health» o «@» devuelve «no se puede compartir». El tiempo de vigencia de la vista previa (10 min) es un ejemplo: lo define el servidor. */
copy({
 nav_tools:'Mis herramientas',hr_t:'Mis herramientas',hr_intro:'Lo que usas para entender tu recorrido profesional. Todo lo que cruza hacia tu perfil lo decides tú.',hr_open:'Abrir',hr_prep:'En preparación',
 hr_empty:'Las opciones profesionales aún no están disponibles aquí. Puedes volver a Mi espacio.',hr_home:'Volver a Mi espacio',hr_load:'Cargando tus herramientas…',hr_err:'No pudimos cargar tus herramientas.',
 hr_compass:'Brújula',hr_compass_p:'Escribe y autoriza, texto por texto, lo que quieres que cuente en tu recorrido profesional.',
 hr_evidence:'Mis evidencias',hr_evidence_p:'Situaciones reales en las que actuaste, con lo que hiciste y lo que aprendiste.',
 hr_map:'Mapa de competencias',hr_map_p:'Tu relieve de capacidades: solo sube donde hay respaldo.',
 hr_catalog:'Catálogo',hr_catalog_p:'Explora fichas ocupacionales, fuentes y recursos. No son recomendaciones personalizadas.',
 hr_ex:'Ejercicios opcionales',hr_ex_p:'Preguntas breves para pensar, de 3 a 5 minutos. Las notas no se guardan.',hr_ex_open:'Ver ejercicios',
 hr_p:'Prototipo:',hr_p1:'ver una herramienta en preparación',hr_p2:'ver ninguna disponible',hr_p3:'ver cargando',hr_p4:'ver error de carga',hr_p0:'ver todas',
 ex_t:'Ejercicios opcionales',ex_intro:'Puedes elegir uno, omitirlo o cerrar cuando quieras.',ex_time:'Tiempo orientativo: 3–5 minutos, a tu ritmo.',ex_choose:'Elegir',ex_skip:'Omitir',ex_back:'Volver',
 ex_notes:'Notas opcionales',ex_private:'Estas notas no se guardan ni se comparten.',ex_clip:'Se copiarán al portapapeles de este dispositivo.',ex_copy:'Copiar mis notas',
 ex_copying:'Copiando…',ex_copied:'Copiado al portapapeles',ex_copy_error:'No pudimos copiar. Puedes seleccionar tus notas y copiarlas manualmente.',
 ex_close:'Cerrar ejercicio',ex_return:'Volver al ejercicio',ex_discard:'Cerrar sin guardar',ex_leave:'Las notas se perderán al cerrar.',
 ex_closed:'Lo dejamos aquí. Puedes volver cuando quieras.',ex_unavailable:'Los ejercicios aún no están disponibles.',ex_review:'Contenido en revisión. No habilitado para el piloto.',
 ex_q:'Pregunta',
 ex_reflection_t:'Una situación que quiero comprender',ex_reflection_p:'Elegir qué parte de una situación quieres explorar, sin tener que explicarlo todo.',ex_reflection_q:'¿Qué parte de una situación reciente te gustaría comprender mejor?',ex_reflection_h:'Puedes elegir una situación cotidiana y compartir solo lo que desees.',
 ex_values_t:'Lo que quiero cuidar en mi próxima etapa',ex_values_p:'Identificar algo que valoras, sin ordenarlo ni convertirlo en una puntuación.',ex_values_q:'¿Qué valor es importante para ti en tu próxima etapa?',ex_values_h:'Puedes elegir una palabra o una idea; no necesitas justificarla.',
 ex_contribution_t:'Reconocer mi contribución',ex_contribution_p:'Distinguir tu acción del resultado conocido o desconocido.',ex_contribution_q:'¿Qué hiciste tú en una situación de la que te gustaría conservar un aprendizaje?',ex_contribution_h:'Puedes describir una acción, aunque no conozcas el resultado.',
 ex_p:'Prototipo:',ex_p1:'ver contenido en revisión',ex_p2:'ver «no disponible»',ex_p0:'ver normal',
 cp_t:'Brújula profesional',cp_intro:'Tú eliges qué texto autorizas para el recorrido profesional.',cp_privacy:'No necesitas compartir experiencias íntimas.',cp_caution:'No incluyas información de salud ni datos de otras personas.',
 cp_motivations:'Qué me motiva',cp_values:'Qué valoro en el trabajo',cp_interests:'Intereses profesionales',cp_energy_gives:'Lo que me da energía en el trabajo',cp_energy_drains:'Lo que me resta energía en el trabajo',cp_desired_conditions:'Condiciones de trabajo deseadas',cp_constraints:'Restricciones profesionales',
 cp_current:'Contexto actual',cp_empty:'Sin contexto profesional autorizado',cp_new:'Nuevo contexto directo',cp_cat_l:'Categoría',cp_category:'Selecciona una categoría',cp_text:'Texto que quiero autorizar',
 cp_select:'Incluir en la autorización',cp_reject:'Rechazar este campo',cp_add:'Añadir campo',cp_limit:'Hasta 12 campos, 3 por categoría y 500 caracteres por texto.',
 cp_unconfirmed:'Aún no confirmado',cp_preview:'Ver exactamente qué autorizo',cp_authorize:'He revisado estos campos y autorizo su uso profesional.',
 cp_confirm:'Confirmar autorización',cp_edit:'Seguir editando',cp_renew:'Renovar vista previa',cp_skip_transfer:'Continuar sin transferir',cp_no_changes:'Continuar sin cambios',
 cp_unchanged:'La autorización existente permanece hasta que la retires.',cp_replaces:'Esta autorización reemplaza la versión activa completa. Los campos no seleccionados no estarán en la nueva versión.',
 cp_withdraw:'Retirar contexto vigente',cp_withdraw_confirm:'Retirar contexto',cp_withdraw_help:'Retira el contexto activo en ese momento. Los permisos para otros usos se gestionan por separado.',
 cp_cancel:'Cancelar',cp_history:'Ver historial',cp_version:'Versión',cp_active:'Activa',cp_superseded:'Sustituida',cp_revoked:'Retirada',cp_needs_review:'Pendiente de revisar',
 cp_source_changed:'El origen de este contexto cambió. Revísalo antes de volver a usarlo.',cp_derivatives:'No está disponible el detalle de los resultados afectados.',
 cp_confirmed:'Autorización confirmada',cp_withdrawn:'Contexto retirado del uso profesional',cp_loading:'Cargando tu contexto…',cp_previewing:'Preparando vista previa…',cp_confirming:'Confirmando…',cp_withdrawing:'Retirando contexto…',
 cp_expires:'Vence',cp_expired:'La vista previa venció. Revísala de nuevo antes de confirmar.',cp_error:'No pudimos completar la operación. Tus cambios siguen en esta pantalla.',cp_load_error:'No pudimos cargar tu contexto.',
 cp_uncertain:'No pudimos verificar esta confirmación. Revisa el contexto vigente antes de crear otra versión.',cp_withdrawal_uncertain:'No pudimos verificar la retirada. Consulta el contexto vigente antes de decidir otra acción.',
 cp_not_shareable:'Este texto no se puede compartir. Reescríbelo o déjalo fuera.',cp_session:'Tu sesión venció. Inicia sesión para continuar.',cp_forbidden:'No tienes permiso para realizar esta acción.',
 cp_leave:'Si sales, perderás los cambios sin confirmar.',cp_retry:'Reintentar',cp_back:'Volver al inicio',cp_invalid:'Revisa la selección, las categorías y los límites indicados.',cp_login:'Iniciar sesión',
 cp_ex:'Ejemplo',cp_when:'Autorizada el {d}',cp_fields_n:'{n} campos',cp_pending:'Las versiones guardadas son de solo lectura hasta completar la conservación de sus orígenes.',
 cp_p:'Prototipo:',cp_p1:'ver con contexto activo',cp_p2:'ver «pendiente de revisar»',cp_p3:'ver vista previa vencida',cp_p4:'ver error de carga',cp_p5:'ver sesión vencida',cp_p0:'ver sin contexto',
 routes:{herramientas:'Mis herramientas',ejercicios:'Ejercicios opcionales',brujula:'Brújula profesional'}
},{
 nav_tools:'My tools',hr_t:'My tools',hr_intro:'What you use to understand your career path. What crosses to your profile is always your decision.',hr_open:'Open',hr_prep:'In preparation',
 hr_empty:'Career options are not available here yet. You can return to My space.',hr_home:'Back to My space',hr_load:'Loading your tools…',hr_err:'We could not load your tools.',
 hr_compass:'Compass',hr_compass_p:'Write and authorize, text by text, what you want to count in your career path.',
 hr_evidence:'My evidence',hr_evidence_p:'Real situations where you acted, with what you did and what you learned.',
 hr_map:'Skills map',hr_map_p:'Your relief of capabilities: it only rises where there is support.',
 hr_catalog:'Catalog',hr_catalog_p:'Explore occupational profiles, sources and resources. These are not personalized recommendations.',
 hr_ex:'Optional exercises',hr_ex_p:'Short questions to think with, 3 to 5 minutes. Notes are not saved.',hr_ex_open:'See exercises',
 hr_p:'Prototype:',hr_p1:'see a tool in preparation',hr_p2:'see none available',hr_p3:'see loading',hr_p4:'see load error',hr_p0:'see all',
 ex_t:'Optional exercises',ex_intro:'You can choose one, skip it or close whenever you want.',ex_time:'Suggested time: 3–5 minutes, at your own pace.',ex_choose:'Choose',ex_skip:'Skip',ex_back:'Back',
 ex_notes:'Optional notes',ex_private:'These notes are not saved or shared.',ex_clip:'They will be copied to this device’s clipboard.',ex_copy:'Copy my notes',
 ex_copying:'Copying…',ex_copied:'Copied to clipboard',ex_copy_error:'We could not copy. You can select your notes and copy them manually.',
 ex_close:'Close exercise',ex_return:'Back to exercise',ex_discard:'Close without saving',ex_leave:'Closing will discard your notes.',
 ex_closed:'We can stop here. You can return whenever you want.',ex_unavailable:'Exercises are not available yet.',ex_review:'Content under review. Not enabled for the pilot.',
 ex_q:'Question',
 ex_reflection_t:'A situation I want to understand',ex_reflection_p:'Choose which part of a situation to explore, without having to explain everything.',ex_reflection_q:'Which part of a recent situation would you like to understand better?',ex_reflection_h:'You can choose an everyday situation and share only what you want.',
 ex_values_t:'What I want to preserve in my next stage',ex_values_p:'Identify something you value, without ranking or scoring it.',ex_values_q:'What value matters to you in your next stage?',ex_values_h:'You can choose a word or an idea; you do not need to justify it.',
 ex_contribution_t:'Recognizing my contribution',ex_contribution_p:'Distinguish your action from a known or unknown outcome.',ex_contribution_q:'Think of a situation you want to learn from: what did you do?',ex_contribution_h:'You can describe an action even if you do not know the outcome.',
 ex_p:'Prototype:',ex_p1:'see content under review',ex_p2:'see “unavailable”',ex_p0:'see normal',
 cp_t:'Career compass',cp_intro:'You choose which text you authorize for your career journey.',cp_privacy:'You do not need to share intimate experiences.',cp_caution:'Do not include health information or other people’s data.',
 cp_motivations:'What motivates me',cp_values:'What I value at work',cp_interests:'Career interests',cp_energy_gives:'What energizes me at work',cp_energy_drains:'What drains my energy at work',cp_desired_conditions:'Preferred working conditions',cp_constraints:'Career constraints',
 cp_current:'Current context',cp_empty:'No authorized career context',cp_new:'New direct context',cp_cat_l:'Category',cp_category:'Choose a category',cp_text:'Text I want to authorize',
 cp_select:'Include in the authorization',cp_reject:'Reject this field',cp_add:'Add field',cp_limit:'Up to 12 fields, 3 per category and 500 characters per text.',
 cp_unconfirmed:'Not confirmed yet',cp_preview:'See exactly what I authorize',cp_authorize:'I have reviewed these fields and authorize their professional use.',
 cp_confirm:'Confirm authorization',cp_edit:'Keep editing',cp_renew:'Renew preview',cp_skip_transfer:'Continue without transferring',cp_no_changes:'Continue without changes',
 cp_unchanged:'Your existing authorization remains until you withdraw it.',cp_replaces:'This authorization replaces the entire active version. Unselected fields will not be in the new version.',
 cp_withdraw:'Withdraw current context',cp_withdraw_confirm:'Withdraw context',cp_withdraw_help:'This withdraws the context active at that moment. Permissions for other uses are managed separately.',
 cp_cancel:'Cancel',cp_history:'View history',cp_version:'Version',cp_active:'Active',cp_superseded:'Superseded',cp_revoked:'Withdrawn',cp_needs_review:'Needs review',
 cp_source_changed:'The source of this context changed. Review it before using it again.',cp_derivatives:'Details of affected results are not available.',
 cp_confirmed:'Authorization confirmed',cp_withdrawn:'Context withdrawn from professional use',cp_loading:'Loading your context…',cp_previewing:'Preparing preview…',cp_confirming:'Confirming…',cp_withdrawing:'Withdrawing context…',
 cp_expires:'Expires',cp_expired:'The preview expired. Review it again before confirming.',cp_error:'We could not complete the operation. Your changes are still on this screen.',cp_load_error:'We could not load your context.',
 cp_uncertain:'We could not verify this confirmation. Check the current context before creating another version.',cp_withdrawal_uncertain:'We could not verify the withdrawal. Check the current context before deciding on another action.',
 cp_not_shareable:'This text cannot be shared. Rewrite it or leave it out.',cp_session:'Your session expired. Sign in to continue.',cp_forbidden:'You do not have permission to perform this action.',
 cp_leave:'If you leave, you will lose unconfirmed changes.',cp_retry:'Retry',cp_back:'Back to dashboard',cp_invalid:'Check the selection, categories and displayed limits.',cp_login:'Sign in',
 cp_ex:'Example',cp_when:'Authorized on {d}',cp_fields_n:'{n} fields',cp_pending:'Saved versions are read-only until their origin-preservation contract is completed.',
 cp_p:'Prototype:',cp_p1:'see with an active context',cp_p2:'see “needs review”',cp_p3:'see expired preview',cp_p4:'see load error',cp_p5:'see expired session',cp_p0:'see without context',
 routes:{herramientas:'My tools',ejercicios:'Optional exercises',brujula:'Career compass'}
});
addRoutes('g_per',['herramientas','ejercicios','brujula']);
SEC.herramientas=['ejercicios','brujula'];
function bjFoc(id){setTimeout(function(){var e=document.getElementById(id);if(e)e.focus()},0)}
function bjProto(lbl,items){return'<p class="small muted" style="margin:1.4rem 0">'+t(lbl)+' '+items.map(function(i){return'<button class="lnk" data-act="'+i[0]+'" data-v="'+i[1]+'">'+t(i[2])+'</button>'}).join(' · ')+'</p>'}
/* ---------- Mis herramientas ---------- */
S.hr={mode:'all'};
V.herramientas=function(){var m=S.hr.mode;
 var opts=[['compass','brujula'],['evidence','evidencias'],['map','inicio'],['catalog','catalogo']];
 var h='<main class="narrow"><div style="padding:1.2rem 0 .6rem"><h1 class="s">'+t('hr_t')+'</h1><p class="muted" style="max-width:38rem">'+t('hr_intro')+'</p></div>';
 if(m==='load')h+='<div role="status" style="padding:2rem 0"><div class="pulse" aria-hidden="true"></div><p>'+t('hr_load')+'</p></div>';
 else if(m==='err')h+='<div class="banner bad" role="alert"><b>'+t('hr_err')+'</b><div class="row"><button class="btn" data-act="hrsim" data-v="all">'+t('cp_retry')+'</button></div></div>';
 else{
  var avail=function(k){return m==='all'||(m==='part'&&k!=='compass')};
  var none=!opts.some(function(o){return avail(o[0])});
  if(none)h+='<p role="status">'+t('hr_empty')+'</p><div class="row"><a class="btn ghost" href="#inicio">'+t('hr_home')+'</a></div>';
  h+='<div class="two">'+opts.map(function(o){var k=o[0],on_=avail(k);
   return'<section class="card" aria-labelledby="hr-'+k+'"><h2 id="hr-'+k+'" style="font-size:1.4rem">'+t('hr_'+k)+'</h2>'+(on_?'<p>'+t('hr_'+k+'_p')+'</p><div class="row"><a class="btn" href="#'+o[1]+'" aria-describedby="hr-'+k+'">'+t('hr_open')+'</a></div>':'<p><span class="chip">'+t('hr_prep')+'</span></p>')+'</section>'}).join('')+'</div>';
  h+='<section class="card" aria-labelledby="hr-ex" style="margin-top:1rem"><h2 id="hr-ex" style="font-size:1.4rem">'+t('hr_ex')+'</h2><p>'+t('hr_ex_p')+'</p><div class="row"><a class="btn ghost" href="#ejercicios">'+t('hr_ex_open')+'</a></div></section>'}
 return h+bjProto('hr_p',[['hrsim','all','hr_p0'],['hrsim','part','hr_p1'],['hrsim','none','hr_p2'],['hrsim','load','hr_p3'],['hrsim','err','hr_p4']])+'</main>'};
ACTS.hrsim=function(b,v){S.hr.mode=v;render()};
/* ---------- Ejercicios opcionales ---------- */
var EXK=['reflection','values','contribution'];
S.ex={ph:'list',key:null,notes:'',status:'',dlg:false,busy:false,review:false};
V.ejercicios=function(){var x=S.ex;
 var h='<main class="narrow"><div style="padding:1.2rem 0 .6rem"><div class="row" style="margin:0 0 .8rem"><button class="btn ghost" data-act="exback"'+(x.busy?' disabled':'')+'>← '+t('ex_back')+'</button></div><h1 class="s">'+t('ex_t')+'</h1></div>';
 if(x.ph==='off')return h+'<p role="status">'+t('ex_unavailable')+'</p>'+bjProto('ex_p',[['exsim','list','ex_p0'],['exsim','review','ex_p1']])+'</main>';
 if(x.review)h+='<p class="banner" role="note"><b>'+t('ex_review')+'</b></p>';
 h+='<p style="max-width:38rem">'+t('ex_intro')+'</p><p role="status" aria-live="polite" id="ex-st" style="min-height:1.4em">'+(x.status?t('ex_'+x.status):'')+'</p>';
 if(x.key){var k=x.key;
  h+='<section class="card" aria-labelledby="ex-h"><h2 id="ex-h" style="font-size:1.5rem">'+t('ex_'+k+'_t')+'</h2><p>'+t('ex_'+k+'_p')+'</p><p class="small muted">'+t('ex_time')+'</p>'+
   '<p class="tag" style="margin-top:1.2rem">'+t('ex_q')+'</p><h3 id="ex-q" tabindex="-1" class="nm" style="font-size:1.35rem;margin:.2rem 0 .4rem">'+t('ex_'+k+'_q')+'</h3><p class="muted">'+t('ex_'+k+'_h')+'</p>'+
   '<div class="fld"><label for="ex-notes">'+t('ex_notes')+'</label><textarea id="ex-notes" rows="9" aria-describedby="ex-priv ex-clip"'+(x.busy?' disabled':'')+'>'+esc(x.notes)+'</textarea><small id="ex-priv">'+t('ex_private')+'</small><small id="ex-clip">'+t('ex_clip')+'</small></div>'+
   '<div class="row"><button class="btn ghost" id="ex-copy" data-act="excopy"'+(!x.notes||x.busy?' disabled':'')+'>'+(x.busy?t('ex_copying'):t('ex_copy'))+'</button><button class="btn" data-act="exclose"'+(x.busy?' disabled':'')+'>'+t('ex_close')+'</button></div></section>'}
 else{
  h+='<div class="stack">'+EXK.map(function(k){return'<article class="card" aria-labelledby="exc-'+k+'"><h2 id="exc-'+k+'" style="font-size:1.4rem">'+t('ex_'+k+'_t')+'</h2><p>'+t('ex_'+k+'_p')+'</p><p class="small muted">'+t('ex_time')+'</p><div class="row"><button class="btn" data-act="exchoose" data-v="'+k+'" aria-describedby="exc-'+k+'">'+t('ex_choose')+'</button></div></article>'}).join('')+'</div><div class="row"><button class="btn ghost" data-act="exskip">'+t('ex_skip')+'</button></div>'}
 h+=bjProto('ex_p',[['exsim','list','ex_p0'],['exsim','review','ex_p1'],['exsim','off','ex_p2']])+'</main>';
 if(x.dlg)h+='<div class="scrim"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="exd-t" aria-describedby="exd-p"><h2 id="exd-t" style="font-size:1.4rem">'+t('ex_leave')+'</h2><p id="exd-p">'+t('ex_clip')+'</p><p role="status" aria-live="polite" id="exd-st">'+(x.status==='copy_error'||x.status==='copied'||x.status==='copying'?t('ex_'+x.status):'')+'</p>'+
  '<div class="row"><button class="btn ghost" id="exd-x" data-act="exdx"'+(x.busy?' disabled':'')+'>'+t('ex_return')+'</button><button class="btn ghost" data-act="excopy"'+(x.busy?' disabled':'')+'>'+(x.busy?t('ex_copying'):t('ex_copy'))+'</button><button class="btn danger" data-act="exdok"'+(x.busy?' disabled':'')+'>'+t('ex_discard')+'</button></div></div></div>';
 return h};
ACTS.exsim=function(b,v){var x=S.ex;x.key=null;x.notes='';x.dlg=false;x.status='';if(v==='off'){x.ph='off';x.review=false}else{x.ph='list';x.review=v==='review'}render()};
ACTS.exchoose=function(b,v){var x=S.ex;x.key=v;x.status='';render();bjFoc('ex-q')};
ACTS.exback=function(){exLeave('origin')};
ACTS.exskip=function(){exLeave('origin')};
ACTS.exclose=function(){exLeave('list')};
var exTarget=null;
function exLeave(w){var x=S.ex;if(x.busy)return;if(x.notes){exTarget=w;x.dlg=true;render();bjFoc('exd-x')}else exFinish(w)}
function exFinish(w){var x=S.ex;x.dlg=false;x.notes='';x.key=null;x.status='closed';exTarget=null;if(w==='origin'){x.status='';location.hash='inicio'}else{render();bjFoc('exc-'+EXK[0])}}
ACTS.exdx=function(){var x=S.ex;x.dlg=false;exTarget=null;render();bjFoc('ex-notes')};
ACTS.exdok=function(){exFinish(exTarget||'list')};
ACTS.excopy=function(){var x=S.ex;if(x.busy||!x.notes)return;x.busy=true;x.status='copying';render();bjFoc(x.dlg?'exd-x':'ex-copy');
 setTimeout(function(){x.busy=false;if(S.mode!=='ok')x.status='copy_error';else{x.status='copied';try{navigator.clipboard.writeText(x.notes).catch(function(){})}catch(e){}}render();bjFoc(x.dlg?'exd-x':'ex-copy')},400)};
document.addEventListener('input',function(e){if(e.target.id==='ex-notes'){var x=S.ex;x.notes=e.target.value;x.status='';var c=document.getElementById('ex-copy');if(c&&!x.busy)c.disabled=!x.notes;var s=document.getElementById('ex-st');if(s)s.textContent=''}});
/* ---------- Brújula profesional ---------- */
var CPK=['motivations','values','interests','energy_gives','energy_drains','desired_conditions','constraints'],cpSeq=0;
function cpBlank(){return{id:'r'+(++cpSeq),key:'',text:'',sel:false}}
function cpEx(){return{active:{v:2,when:'2026-10-26T15:20:00',needs:false,fields:[{key:'motivations',text:'Me motiva ver el resultado de lo que armo.'},{key:'desired_conditions',text:'Equipos pequeños con objetivos claros.'},{key:'energy_drains',text:'Las reuniones largas sin objetivo.'}]},
  versions:[{v:1,when:'2026-10-19T10:05:00',st:'superseded',fields:[{key:'motivations',text:'Me motiva ver el resultado de lo que armo.'}]}]}}
S.cp={ph:'ok',active:null,versions:[],rows:[cpBlank()],review:null,auth:false,busy:'',notice:'',failed:false,invalid:[],dlg:false,ver:2};
function cpMsg(k,f){var c=S.cp;c.notice=k;c.failed=!!f}
function cpEdit(){var c=S.cp;c.review=null;c.auth=false;c.invalid=[];cpMsg('',false)}
function cpFmt(iso){return new Date(iso).toLocaleDateString(S.lang==='es'?'es-CO':'en',{day:'numeric',month:'short',year:'numeric'})}
function cpFields(list){return'<dl class="dl">'+list.map(function(f){return'<dt>'+t('cp_'+f.key)+'</dt><dd>'+esc(f.text)+'</dd>'}).join('')+'</dl>'}
function cpRow(r,i){var bad=S.cp.invalid.indexOf(r.id)>-1,b=S.cp.busy?' disabled':'';
 return'<fieldset class="fld cprow"><legend>'+(i+1)+' · '+t('cp_unconfirmed')+'</legend>'+
  '<label for="cp-c-'+r.id+'">'+t('cp_cat_l')+'</label><select id="cp-c-'+r.id+'" aria-invalid="'+bad+'"'+b+'><option value="">'+t('cp_category')+'</option>'+CPK.map(function(k){return'<option value="'+k+'"'+(r.key===k?' selected':'')+'>'+t('cp_'+k)+'</option>'}).join('')+'</select>'+
  '<label for="cp-t-'+r.id+'">'+t('cp_text')+'</label><textarea id="cp-t-'+r.id+'" rows="4" maxlength="500" aria-invalid="'+bad+'" aria-describedby="cp-n-'+r.id+'"'+b+'>'+esc(r.text)+'</textarea><small id="cp-n-'+r.id+'">'+r.text.length+'/500</small>'+
  '<label class="check"><input type="checkbox" id="cp-s-'+r.id+'"'+(r.sel?' checked':'')+b+'><span>'+t('cp_select')+'</span></label>'+
  (bad?'<p class="err" role="alert">'+t(S.cp.notice==='not_shareable'?'cp_not_shareable':'cp_invalid')+'</p>':'')+
  '<div class="row"><button type="button" class="btn ghost" data-act="cprm" data-v="'+r.id+'"'+b+'>'+t('cp_reject')+'</button></div></fieldset>'}
V.brujula=function(){var c=S.cp,busy=c.busy,exp=c.review&&c.review.exp<=Date.now();
 var h='<main class="narrow"><div style="padding:1.2rem 0 .6rem"><div class="row" style="margin:0 0 .8rem"><button class="btn ghost" data-act="cpback"'+(busy?' disabled':'')+'>← '+t('cp_back')+'</button></div><h1 class="s" id="cp-h" tabindex="-1">'+t('cp_t')+'</h1><p style="max-width:38rem">'+t('cp_intro')+'</p><p class="muted" style="max-width:38rem">'+t('cp_privacy')+' '+t('cp_caution')+'</p></div>';
 h+='<div id="cp-note" tabindex="-1" role="'+(c.failed?'alert':'status')+'" aria-live="polite">'+(c.notice?'<div class="banner'+(c.failed?' bad':'')+'"><b>'+t('cp_'+c.notice)+'</b></div>':'')+'</div>';
 if(busy&&c.ph!=='ok')busy='';
 if(c.ph==='load')return h+'<div role="status" style="padding:2rem 0"><div class="pulse" aria-hidden="true"></div><p>'+t('cp_loading')+'</p></div>'+cpProto()+'</main>';
 if(c.ph==='session')return h+'<div class="row"><a class="btn" href="#entrar">'+t('cp_login')+'</a></div>'+cpProto()+'</main>';
 if(c.ph==='err')return h+'<div class="row"><button class="btn" data-act="cpretry">'+t('cp_retry')+'</button></div>'+cpProto()+'</main>';
 if(busy)h+='<p role="status">'+t('cp_'+busy)+'</p>';
 var a=c.active;
 h+='<div class="stack"><section class="card" aria-labelledby="cp-cur"><h2 id="cp-cur" style="font-size:1.4rem">'+t('cp_current')+'</h2>';
 if(a){h+='<p><span class="chip ok">'+t('cp_active')+'</span> '+t('cp_version')+' '+a.v+' · '+t('cp_when',{d:cpFmt(a.when)})+(a.ex?' <span class="chip">'+t('cp_ex')+'</span>':'')+'</p>'+cpFields(a.fields)+(a.needs?'<div class="banner"><b>'+t('cp_needs_review')+'</b>'+t('cp_source_changed')+'</div>':'')+'<div class="row"><button class="btn ghost danger" id="cp-wd" data-act="cpwd"'+(busy?' disabled':'')+'>'+t('cp_withdraw')+'</button></div>'}
 else h+='<p>'+t('cp_empty')+'</p>';
 h+='<p class="small muted">'+t('cp_derivatives')+'</p></section>';
 h+='<details class="card"><summary>'+t('cp_history')+' ('+(c.versions.length+(a?1:0))+')</summary>'+(a?cpHist(a,'active'):'')+c.versions.map(function(v){return cpHist(v,v.st)}).join('')+'</details>';
 h+='<section class="card" aria-labelledby="cp-new"><h2 id="cp-new" style="font-size:1.4rem">'+t('cp_new')+'</h2><p class="muted">'+t('cp_limit')+'</p>'+(a?'<p class="banner">'+t('cp_replaces')+'</p>':'');
 if(!c.review){h+='<form id="f-cp" novalidate>'+c.rows.map(cpRow).join('')+'<div class="row"><button type="button" class="btn ghost" id="cp-add" data-act="cpadd"'+(c.rows.length>=12||busy?' disabled':'')+'>'+t('cp_add')+'</button><button class="btn" id="cp-prev"'+(busy?' disabled':'')+'>'+t('cp_preview')+'</button></div></form>'}
 else{var r=c.review;
  h+='<section aria-labelledby="cp-pv"><h3 id="cp-pv" style="font-size:1.2rem">'+t('cp_preview')+'</h3>'+cpFields(r.fields)+'<p>'+t('cp_expires')+': <time>'+new Date(r.exp).toLocaleTimeString(S.lang==='es'?'es-CO':'en',{hour:'2-digit',minute:'2-digit'})+'</time></p>'+
   (exp?'<p class="err" role="alert">'+t('cp_expired')+'</p>':'')+
   '<div class="fld"><label class="check"><input type="checkbox" id="cp-auth"'+(c.auth?' checked':'')+(busy||exp?' disabled':'')+'><span>'+t('cp_authorize')+'</span></label></div>'+
   '<div class="row"><button class="btn ghost" id="cp-edit" data-act="cpedit"'+(busy?' disabled':'')+'>'+t('cp_edit')+'</button>'+(exp?'<button class="btn" data-act="cprenew">'+t('cp_renew')+'</button>':'<button class="btn" id="cp-conf" data-act="cpconf"'+(!c.auth||busy?' disabled':'')+'>'+t('cp_confirm')+'</button>')+'</div></section>'}
 h+='</section>';
 h+=(a?'<p class="muted">'+t('cp_unchanged')+'</p>':'')+'<div class="row"><a class="btn ghost" href="#inicio"'+(busy?' aria-disabled="true"':'')+'>'+t(a?'cp_no_changes':'cp_skip_transfer')+'</a></div></div>'+cpProto()+'</main>';
 if(c.dlg)h+='<div class="scrim"><div class="dlg" role="dialog" aria-modal="true" aria-labelledby="cpd-t" aria-describedby="cpd-p"><h2 id="cpd-t" style="font-size:1.4rem">'+t('cp_withdraw_confirm')+'</h2><p id="cpd-p">'+t('cp_withdraw_help')+'</p><div class="row"><button class="btn ghost" id="cpd-x" data-act="cpdx">'+t('cp_cancel')+'</button><button class="btn danger" data-act="cpdok">'+t('cp_withdraw_confirm')+'</button></div></div></div>';
 return h};
function cpHist(v,st){return'<article style="border-top:1px solid var(--line);padding:.6rem 0"><h3 style="font-size:1.05rem">'+t('cp_version')+' '+v.v+' · '+t('cp_'+(st==='active'?'active':st==='superseded'?'superseded':'revoked'))+'</h3><time>'+cpFmt(v.when)+'</time>'+cpFields(v.fields)+'</article>'}
function cpProto(){return bjProto('cp_p',[['cpsim','none','cp_p0'],['cpsim','active','cp_p1'],['cpsim','needs','cp_p2'],['cpsim','expired','cp_p3'],['cpsim','err','cp_p4'],['cpsim','session','cp_p5']])}
ACTS.cpsim=function(b,v){var c=S.cp;c.review=null;c.auth=false;c.invalid=[];c.dlg=false;c.busy='';cpMsg('',false);c.ph='ok';
 if(v==='none'){c.active=null;c.versions=[];c.rows=[cpBlank()]}
 else if(v==='active'||v==='needs'){var e=cpEx();e.active.ex=true;e.active.needs=v==='needs';c.active=e.active;c.versions=e.versions}
 else if(v==='expired'){c.rows=[{id:'rx',key:'values',text:'Valoro que mi equipo sepa en qué punto estamos.',sel:true}];c.review={fields:[{key:'values',text:'Valoro que mi equipo sepa en qué punto estamos.'}],exp:Date.now()-1000}}
 else if(v==='err'){c.ph='err';cpMsg('load_error',true)}else if(v==='session'){c.ph='session';cpMsg('session',true)}
 render()};
ACTS.cpretry=function(){var c=S.cp;c.ph='load';cpMsg('',false);render();setTimeout(function(){c.ph=S.mode==='ok'?'ok':'err';if(c.ph==='err')cpMsg('load_error',true);render();bjFoc(c.ph==='ok'?'cp-h':'cp-note')},600)};
ACTS.cpback=function(){var c=S.cp;if(c.busy)return;var dirty=c.rows.some(function(r){return r.text||r.sel||r.key});if(dirty&&!window.confirm(t('cp_leave')))return;location.hash='inicio'};
ACTS.cpadd=function(){var c=S.cp;cpEdit();var r=cpBlank();c.rows.push(r);render();bjFoc('cp-c-'+r.id)};
ACTS.cprm=function(b,v){var c=S.cp;cpEdit();c.rows=c.rows.filter(function(r){return r.id!==v});render();bjFoc('cp-add')};
ACTS.cpedit=function(){cpEdit();render();bjFoc('cp-prev')};
ACTS.cprenew=function(){cpPreview()};
ACTS.cpwd=function(){S.cp.dlg=true;render();bjFoc('cpd-x')};
ACTS.cpdx=function(){S.cp.dlg=false;render();bjFoc('cp-wd')};
SUBS['f-cp']=function(){cpPreview()};
function cpPreview(){var c=S.cp;if(c.busy)return;var sel=c.rows.filter(function(r){return r.sel}),bad=[],per={};
 sel.forEach(function(r){if(!r.key||!r.text.trim())bad.push(r.id);else{per[r.key]=(per[r.key]||0)+1;if(per[r.key]>3)bad.push(r.id)}});
 if(!sel.length||sel.length>12||bad.length){c.invalid=bad;cpMsg('invalid',true);render();bjFoc(bad.length?'cp-t-'+bad[0]:'cp-note');return}
 c.busy='previewing';c.invalid=[];cpMsg('',false);c.review=null;c.auth=false;render();
 setTimeout(function(){c.busy='';
  if(S.mode!=='ok'){cpMsg('error',true);render();bjFoc('cp-note');return}
  var ns=sel.filter(function(r){return /salud|health|@/i.test(r.text)});
  if(ns.length){c.invalid=[ns[0].id];cpMsg('not_shareable',true);render();bjFoc('cp-t-'+ns[0].id);return}
  c.review={fields:sel.map(function(r){return{key:r.key,text:r.text.trim()}}),exp:Date.now()+10*60000};cpMsg('unconfirmed',false);render();bjFoc('cp-pv');
  var rv=c.review;setTimeout(function(){if(c.review===rv&&S.route==='brujula')render()},10*60000+50)},600)}
ACTS.cpconf=function(){var c=S.cp;if(c.busy||!c.review||!c.auth||c.review.exp<=Date.now())return;var rv=c.review;c.busy='confirming';render();
 setTimeout(function(){c.busy='';c.review=null;c.auth=false;
  if(S.mode!=='ok'){cpMsg('uncertain',true);render();bjFoc('cp-note');return}
  if(c.active){c.versions.unshift({v:c.active.v,when:c.active.when,st:'superseded',fields:c.active.fields})}
  c.ver+=1;c.active={v:c.ver,when:new Date().toISOString(),needs:false,fields:rv.fields};c.rows=[cpBlank()];cpMsg('confirmed',false);render();bjFoc('cp-note')},700)};
ACTS.cpdok=function(){var c=S.cp;c.dlg=false;c.busy='withdrawing';render();
 setTimeout(function(){c.busy='';
  if(S.mode!=='ok'){cpMsg('withdrawal_uncertain',true);render();bjFoc('cp-note');return}
  c.versions.unshift({v:c.active.v,when:c.active.when,st:'revoked',fields:c.active.fields});c.active=null;cpMsg('withdrawn',false);render();bjFoc('cp-note')},700)};
function cpRowOf(el,p){var m=el.id.indexOf(p)===0?el.id.slice(p.length):null;if(!m)return null;return S.cp.rows.filter(function(r){return r.id===m})[0]||null}
document.addEventListener('input',function(e){if(S.route!=='brujula')return;var r=cpRowOf(e.target,'cp-t-');if(!r)return;r.text=e.target.value;var n=document.getElementById('cp-n-'+r.id);if(n)n.textContent=r.text.length+'/500';
 if(S.cp.notice||S.cp.invalid.length){S.cp.invalid=[];cpMsg('',false);var nt=document.getElementById('cp-note');if(nt)nt.innerHTML='';e.target.setAttribute('aria-invalid','false')}});
document.addEventListener('change',function(e){if(S.route!=='brujula')return;var el=e.target,r;
 if((r=cpRowOf(el,'cp-c-'))){r.key=el.value;cpEdit();render();bjFoc(el.id)}
 else if((r=cpRowOf(el,'cp-s-'))){r.sel=el.checked;cpEdit();render();bjFoc(el.id)}
 else if(el.id==='cp-auth'){S.cp.auth=el.checked;var b=document.getElementById('cp-conf');if(b)b.disabled=!el.checked||!!S.cp.busy}});
document.addEventListener('keydown',function(e){var dlg=(S.route==='ejercicios'&&S.ex.dlg&&!S.ex.busy&&'ex')||(S.route==='brujula'&&S.cp.dlg&&'cp');if(!dlg)return;
 if(e.key==='Escape'){if(dlg==='ex')ACTS.exdx();else ACTS.cpdx();return}
 if(e.key==='Tab'){var b=[].slice.call(document.querySelectorAll('.dlg button:not([disabled])'));if(!b.length)return;var f=b[0],l=b[b.length-1];if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus()}else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus()}}});
