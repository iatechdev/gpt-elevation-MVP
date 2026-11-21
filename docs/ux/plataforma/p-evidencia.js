/* /app/evidence, /new, /:id, /:id/edit · Evidencias con el modelo REAL (EvidencePages + FormFields):
   título, situación, responsabilidad, acciones (1 a 8), alternativas (0 a 5), objetivo, entregado, efecto observado (conocido o no),
   aprendizaje, autonomía y muestras (enlace o texto). Estados: borrador/confirmada, versiones, origen «hoja de vida», no editable si viene del chat,
   revisión antes de confirmar, guardado sin confirmar (reintento con el mismo requestId), eliminar con confirmación. */
copy({
 e2_t:'Tus evidencias',e2_intro:'Lo que hiciste, contado con tus palabras. Cada guardado crea una versión y puedes volver a verla.',e2_new:'Nueva evidencia',e2_ver:'Versión {n}',
 e2_draft:'Borrador',e2_conf:'Confirmada',e2_self:'Tu relato',e2_goal:'Objetivo',e2_deliv:'Qué entregaste',e2_eff:'Efecto observado',e2_none:'No lo indicaste',e2_unk:'No lo sé todavía',
 e2_detail:'Ver detalle',e2_edit:'Editar',e2_del:'Eliminar',e2_review:'Revisar y confirmar',e2_savedraft:'Guardar borrador',
 e2_origin:'Viene de tu hoja de vida, versión {v}',e2_needs:'Para revisar: la hoja de vida cambió',e2_bnr_t:'Tienes habilidades de tu hoja de vida por revisar',e2_bnr_b:'Elige las que quieras convertir en evidencia. Ninguna viene marcada y ninguna lleva nivel.',e2_bnr_cta:'Revisar habilidades',
 e2_added:'Agregamos {n} evidencias desde tu hoja de vida.',e2_added_h:'Quedan como borrador. Ábrelas, cuéntalas con tus palabras y confírmalas.',
 e2_empty:'Aún no tienes evidencias. Cuenta una escena en la conversación o escribe una aquí.',e2_chat:'Esta evidencia nació en la conversación. Se edita desde allí, no aquí.',
 e2_dd_t:'¿Eliminar esta evidencia?',e2_dd_p:'Se borra con todas sus versiones. Los niveles que registraste sobre ella quedan sin respaldo.',e2_dd_ok:'Eliminar evidencia',e2_dd_no:'Conservarla',e2_deleted:'Evidencia eliminada.',
 e2_hist:'Versiones anteriores',e2_cur:'Versión actual',e2_back:'Volver a tus evidencias',
 e2_priv:'Solo tú ves tus evidencias. Se guardan con la fuente de cada dato.',e2_newv:'Al guardar se crea una versión nueva. La anterior se conserva.',
 f_title:'Título',f_sit:'Situación',f_resp:'Tu responsabilidad',f_acts:'Acciones que hiciste',f_alts:'Alternativas que consideraste',f_goal:'Objetivo',f_deliv:'Qué entregaste',f_eff:'Efecto observado',f_learn:'Aprendizaje',f_aut:'Cuánta ayuda tuviste',f_smp:'Muestras',
 f_req:'obligatorio',f_opt:'opcional',f_lim:'Hasta {n} caracteres.',f_src:'Fuente: tu relato',f_add_a:'Agregar acción',f_rm_a:'Quitar acción {n}',f_add_l:'Agregar alternativa',f_rm_l:'Quitar alternativa {n}',
 f_known:'Sé qué pasó después',f_unknown:'Todavía no lo sé',f_aut_u:'Sin indicar',f_aut_1:'Lo entendí, no lo hice',f_aut_2:'Con ayuda',f_aut_3:'Por mi cuenta',f_aut_4:'Lo lideré',f_aut_h:'Nadie la comprueba: es lo que tú dices.',
 f_smp_h:'Un enlace o un fragmento que respalde lo que cuentas. No subas datos de otras personas.',f_smp_no:'Aún no agregaste muestras.',f_smp_add:'Agregar muestra',f_smp_url:'Enlace',f_smp_txt:'Texto',f_smp_rm:'Quitar muestra {n}',
 f_err:'Revisa los campos marcados.',f_err_f:'Falta completar este campo.',f_min:'Para guardar un borrador escribe al menos un título.',
 ed_new:'Nueva evidencia',ed_edit:'Editar evidencia',ed_unsaved:'Cambios sin guardar',
 rv_t:'Revisa antes de confirmar',rv_w:'Al confirmar, esta evidencia puede respaldar un nivel. Puedes editarla después y se crea una versión nueva.',rv_chk:'Revisé lo que escribí y es correcto.',rv_back:'Seguir editando',rv_ok:'Confirmar evidencia',
 sv_ing:'Guardando…',sv_unc:'No pudimos confirmar si se guardó',sv_unc_p:'Tu texto sigue aquí. Reintenta y no se duplica: usamos el mismo identificador.',sv_retry:'Reintentar',
 sv_conf:'Evidencia confirmada',sv_draft:'Borrador guardado',sv_next:'Registrar nivel en el mapa',sv_seen:'Ver detalle',
 s1_title:'Coordiné el cambio de turno',s1_goal:'Que el turno de la tarde supiera dónde íbamos.',s1_deliv:'Una nota de relevo con tres pendientes.',
 s2_title:'Reorganicé la entrega de un pedido atrasado',s2_goal:'Entregar a tiempo al cliente más grande.',s2_deliv:'Un nuevo orden de despacho.',
 s3_title:'Gestión de inventario',s3_quote:'Control de inventario semanal con hoja de cálculo.',
 routes:{evidencias:'Evidencias',evidencia_nueva:'Evidencia: nueva',evidencia_detalle:'Evidencia: detalle',evidencia_editar:'Evidencia: editar'}
},{
 e2_t:'Your evidence',e2_intro:'What you did, told in your own words. Every save creates a version and you can look at it again.',e2_new:'New evidence',e2_ver:'Version {n}',
 e2_draft:'Draft',e2_conf:'Confirmed',e2_self:'Your account',e2_goal:'Goal',e2_deliv:'What you delivered',e2_eff:'Observed effect',e2_none:'You did not say',e2_unk:'I do not know yet',
 e2_detail:'See detail',e2_edit:'Edit',e2_del:'Delete',e2_review:'Review and confirm',e2_savedraft:'Save draft',
 e2_origin:'From your résumé, version {v}',e2_needs:'To review: the résumé changed',e2_bnr_t:'You have résumé skills to review',e2_bnr_b:'Pick the ones you want to turn into evidence. None comes ticked and none carries a level.',e2_bnr_cta:'Review skills',
 e2_added:'We added {n} pieces of evidence from your résumé.',e2_added_h:'They stay as drafts. Open them, tell them in your own words and confirm them.',
 e2_empty:'You have no evidence yet. Tell a scene in the conversation or write one here.',e2_chat:'This evidence was born in the conversation. It is edited there, not here.',
 e2_dd_t:'Delete this evidence?',e2_dd_p:'It is removed with all its versions. Levels you recorded on it are left without backing.',e2_dd_ok:'Delete evidence',e2_dd_no:'Keep it',e2_deleted:'Evidence deleted.',
 e2_hist:'Earlier versions',e2_cur:'Current version',e2_back:'Back to your evidence',
 e2_priv:'Only you see your evidence. It is stored with the source of each item.',e2_newv:'Saving creates a new version. The previous one is kept.',
 f_title:'Title',f_sit:'Situation',f_resp:'Your responsibility',f_acts:'Actions you took',f_alts:'Alternatives you considered',f_goal:'Goal',f_deliv:'What you delivered',f_eff:'Observed effect',f_learn:'What you learned',f_aut:'How much help you had',f_smp:'Samples',
 f_req:'required',f_opt:'optional',f_lim:'Up to {n} characters.',f_src:'Source: your account',f_add_a:'Add action',f_rm_a:'Remove action {n}',f_add_l:'Add alternative',f_rm_l:'Remove alternative {n}',
 f_known:'I know what happened afterwards',f_unknown:'I do not know yet',f_aut_u:'Not stated',f_aut_1:'I understood it, I did not do it',f_aut_2:'With help',f_aut_3:'On my own',f_aut_4:'I led it',f_aut_h:'Nobody checks it: it is what you say.',
 f_smp_h:'A link or an excerpt that backs what you tell. Do not upload other people’s data.',f_smp_no:'You have not added samples yet.',f_smp_add:'Add sample',f_smp_url:'Link',f_smp_txt:'Text',f_smp_rm:'Remove sample {n}',
 f_err:'Check the marked fields.',f_err_f:'This field needs filling in.',f_min:'To save a draft write at least a title.',
 ed_new:'New evidence',ed_edit:'Edit evidence',ed_unsaved:'Unsaved changes',
 rv_t:'Review before confirming',rv_w:'Once confirmed, this evidence can back a level. You can edit it later and a new version is created.',rv_chk:'I reviewed what I wrote and it is correct.',rv_back:'Keep editing',rv_ok:'Confirm evidence',
 sv_ing:'Saving…',sv_unc:'We could not confirm it was saved',sv_unc_p:'Your text is still here. Retry and it is not duplicated: we use the same identifier.',sv_retry:'Try again',
 sv_conf:'Evidence confirmed',sv_draft:'Draft saved',sv_next:'Record level on the map',sv_seen:'See detail',
 s1_title:'I coordinated the shift handover',s1_goal:'So the afternoon shift knew where we stood.',s1_deliv:'A handover note with three pending items.',
 s2_title:'I reorganised the delivery of a late order',s2_goal:'Deliver on time to the biggest client.',s2_deliv:'A new dispatch order.',
 s3_title:'Inventory management',s3_quote:'Weekly inventory control with a spreadsheet.',
 routes:{evidencias:'Evidence',evidencia_nueva:'Evidence: new',evidencia_detalle:'Evidence: detail',evidencia_editar:'Evidence: edit'}
});
addRoutes('g_per',['evidencia_nueva','evidencia_detalle','evidencia_editar']);
var BLANK=function(){return{title:'',sit:'',resp:'',acts:[''],alts:[],goal:'',deliv:'',eff:'',effT:'',learn:'',aut:'',smp:[]}};
S.evd={list:[
 {id:1,seed:'s2',status:'c',v:2,chat:true,date:'2026-11-03',d:{title:'s2_title',goal:'s2_goal',deliv:'s2_deliv',eff:'known',effT:'Se entregó un día antes de lo previsto.'}},
 {id:2,seed:'s1',status:'d',v:1,chat:false,date:'2026-11-04',d:{title:'s1_title',goal:'s1_goal',deliv:'s1_deliv',eff:'unknown',effT:''}},
 {id:3,seed:'s3',status:'c',v:1,chat:false,date:'2026-11-01',origin:{v:2,needs:true,quote:'s3_quote'},d:{title:'s3_title',goal:'',deliv:'Informe semanal de existencias.',eff:'unknown',effT:''}}],
 sel:1,draft:null,editId:null,phase:'edit',chk:false,errs:[],dlg:null,added:0,seq:3};
function evT(e,k){var v=e.d[k];return e.seed&&e.d[k]&&/^s\d_/.test(v)?t(v):v}
function evDate(d){try{return new Date(d+'T12:00:00').toLocaleDateString(S.lang==='es'?'es-CO':'en',{day:'numeric',month:'short',year:'numeric'})}catch(x){return d}}
function evMeta(e){return'<div class="row" style="margin:.2rem 0"><span class="chip '+(e.status==='c'?'ok':'wait')+'">'+t(e.status==='c'?'e2_conf':'e2_draft')+'</span><span class="chip">'+t('e2_ver',{n:e.v})+'</span><span class="chip">'+esc(evDate(e.date))+'</span><span class="chip">'+t('e2_self')+'</span></div>'}
function evOrigin(e){if(!e.origin)return'';return'<p class="small" style="margin:.2rem 0"><span class="chip wait">'+t('e2_origin',{v:e.origin.v})+'</span>'+(e.origin.needs?' <span class="chip wait">'+t('e2_needs')+'</span>':'')+'</p><blockquote class="quote">'+esc(t(e.origin.quote))+'</blockquote>'}
function evBody(e,full){var d=e.d,eff=d.eff==='known'?esc(d.effT):d.eff==='unknown'?t('e2_unk'):t('e2_none');
 return'<p style="margin:.2rem 0"><b>'+t('e2_goal')+':</b> '+esc(evT(e,'goal')||t('e2_none'))+'</p><p style="margin:.2rem 0"><b>'+t('e2_deliv')+':</b> '+esc(evT(e,'deliv')||t('e2_none'))+'</p><p style="margin:.2rem 0"><b>'+t('e2_eff')+':</b> '+eff+'</p>'}
V.evidencias=function(){var d=S.evd,cards=d.list.map(function(e){return'<article class="card evc'+(e.origin&&e.origin.needs?' rev':'')+'"><h2 style="font-size:1.35rem">'+esc(evT(e,'title'))+'</h2>'+evMeta(e)+evOrigin(e)+evBody(e)+
  '<div class="row"><a class="lnk" style="text-decoration:none" href="#evidencia_detalle" data-act="evopen" data-v="'+e.id+'">'+t('e2_detail')+'</a>'+(e.chat?'':'<button class="btn ghost" data-act="evedit" data-v="'+e.id+'">'+t('e2_edit')+'</button>')+'<button class="btn ghost danger" data-act="evdel" data-v="'+e.id+'">'+t('e2_del')+'</button></div>'+
  (d.dlg===e.id?'<div class="review" role="alertdialog" aria-labelledby="dd'+e.id+'"><b id="dd'+e.id+'">'+t('e2_dd_t')+'</b><p style="margin:.3rem 0">'+t('e2_dd_p')+'</p><div class="row" style="margin:0"><button class="btn danger" id="ev-dok" data-act="evdok" data-v="'+e.id+'">'+t('e2_dd_ok')+'</button><button class="btn ghost" data-act="evdno">'+t('e2_dd_no')+'</button></div></div>':'')+'</article>'}).join('');
 return'<main><div style="padding:1.2rem 0 .4rem"><h1 class="s">'+t('e2_t')+'</h1><p class="muted" style="max-width:42rem;margin:.3rem 0">'+t('e2_intro')+'</p><p class="small muted" style="margin:0">'+t('e2_priv')+'</p><div class="row"><button class="btn" data-act="evnew">'+t('e2_new')+'</button></div></div>'+
 (d.added?'<div class="banner" role="status"><b>'+t('e2_added',{n:d.added})+'</b>'+t('e2_added_h')+'</div>':'')+
 '<section class="banner" aria-labelledby="bnr"><b id="bnr">'+t('e2_bnr_t')+'</b>'+t('e2_bnr_b')+'<div class="row"><a class="btn" href="#resumen_habilidades">'+t('e2_bnr_cta')+'</a></div></section>'+
 (cards?'<div class="gal" style="margin-top:.4rem">'+cards+'</div>':'<p class="muted">'+t('e2_empty')+'</p>')+'</main>'};
V.evidencia_detalle=function(){var d=S.evd,e=d.list.filter(function(x){return x.id===d.sel})[0];if(!e)return'<main><p class="muted" style="padding:1.2rem 0">'+t('e2_empty')+'</p></main>';
 var x=e.d;
 return'<main class="narrow"><p style="padding-top:1rem"><a href="#evidencias">'+t('e2_back')+'</a></p><h1 class="s" style="margin:.3rem 0">'+esc(evT(e,'title'))+'</h1>'+(e.chat?'<div class="banner" role="note">'+t('e2_chat')+'</div>':'<div class="row"><button class="btn" data-act="evedit" data-v="'+e.id+'">'+t('e2_edit')+'</button></div>')+
 '<article class="card" style="margin-top:1rem"><p class="tag">'+t('e2_cur')+'</p>'+evMeta(e)+evOrigin(e)+evBody(e)+'</article>'+
 (e.v>1?'<details style="margin-top:1rem"><summary>'+t('e2_hist')+'</summary><section class="card" style="margin-top:.6rem"><p class="tag">'+t('e2_ver',{n:e.v-1})+'</p><p class="muted small">'+t('e2_draft')+' · '+esc(evDate(e.date))+'</p></section></details>':'')+'</main>'};
function evFld(id,label,req,max,val,rows,src){var er=S.evd.errs.indexOf(id)>-1;return'<div class="fld"><label for="ef-'+id+'">'+label+' · '+t(req?'f_req':'f_opt')+'</label>'+(rows?'<textarea id="ef-'+id+'" rows="'+rows+'" maxlength="'+max+'" aria-invalid="'+er+'">'+esc(val)+'</textarea>':'<input type="text" id="ef-'+id+'" maxlength="'+max+'" value="'+esc(val)+'" aria-invalid="'+er+'">')+'<small>'+t('f_lim',{n:max})+(src?' '+t('f_src'):'')+'</small><p class="err" role="alert"'+(er?'':' hidden')+'>'+t('f_err_f')+'</p></div>'}
function evArr(key,label,req,max,lab,addK,rmK,mx){var d=S.evd.draft,er=S.evd.errs.indexOf(key)>-1;return'<fieldset class="fld arr"><legend>'+label+' · '+t(req?'f_req':'f_opt')+'</legend>'+d[key].map(function(v,i){return'<div class="arr1"><label class="sr" for="ea-'+key+i+'">'+label+' '+(i+1)+'</label><textarea id="ea-'+key+i+'" rows="2" maxlength="'+max+'" aria-invalid="'+er+'">'+esc(v)+'</textarea><button type="button" class="btn ghost" data-act="evarm" data-k="'+key+'" data-v="'+i+'">'+t(rmK,{n:i+1})+'</button></div>'}).join('')+'<p class="err" role="alert"'+(er?'':' hidden')+'>'+t('f_err_f')+'</p><button type="button" class="btn ghost" data-act="evaad" data-k="'+key+'"'+(d[key].length>=mx?' disabled':'')+'>'+t(addK)+'</button></fieldset>'}
function evForm(){var s=S.evd,d=s.draft,ef=s.errs.indexOf('eff')>-1;
 return'<form id="f-evn" novalidate>'+evFld('title',t('f_title'),1,120,d.title,0)+evFld('sit',t('f_sit'),1,1000,d.sit,3)+evFld('resp',t('f_resp'),1,1000,d.resp,3,1)+evArr('acts',t('f_acts'),1,1000,'','f_add_a','f_rm_a',8)+evArr('alts',t('f_alts'),0,500,'','f_add_l','f_rm_l',5)+evFld('goal',t('f_goal'),0,500,d.goal,3)+evFld('deliv',t('f_deliv'),1,1000,d.deliv,3,1)+
 '<fieldset class="fld"><legend>'+t('f_eff')+' · '+t('f_req')+'</legend><div class="opts"><label><input type="radio" name="eff" id="ef-effk" value="known"'+(d.eff==='known'?' checked':'')+'>'+t('f_known')+'</label><label><input type="radio" name="eff" id="ef-effu" value="unknown"'+(d.eff==='unknown'?' checked':'')+'>'+t('f_unknown')+'</label></div>'+(d.eff==='known'?'<label class="sr" for="ef-effT">'+t('f_eff')+'</label><textarea id="ef-effT" rows="3" maxlength="1000">'+esc(d.effT)+'</textarea><small>'+t('f_lim',{n:1000})+' '+t('f_src')+'</small>':'')+'<p class="err" role="alert"'+(ef?'':' hidden')+'>'+t('f_err_f')+'</p></fieldset>'+
 evFld('learn',t('f_learn'),0,1000,d.learn,3)+
 '<div class="fld"><label for="ef-aut">'+t('f_aut')+'</label><select id="ef-aut"><option value="">'+t('f_aut_u')+'</option>'+[1,2,3,4].map(function(i){return'<option value="'+i+'"'+(d.aut==i?' selected':'')+'>'+t('f_aut_'+i)+'</option>'}).join('')+'</select><small>'+t('f_aut_h')+'</small></div>'+
 '<fieldset class="fld"><legend>'+t('f_smp')+'</legend><p class="small muted" style="margin:0">'+t('f_smp_h')+'</p>'+(d.smp.length?d.smp.map(function(m,i){return'<div class="arr1"><label class="sr" for="es-'+i+'">'+t('f_smp')+' '+(i+1)+'</label><textarea id="es-'+i+'" rows="2" maxlength="500">'+esc(m)+'</textarea><button type="button" class="btn ghost" data-act="evsrm" data-v="'+i+'">'+t('f_smp_rm',{n:i+1})+'</button></div>'}).join(''):'<p class="muted small">'+t('f_smp_no')+'</p>')+'<button type="button" class="btn ghost" data-act="evsad"'+(d.smp.length>=5?' disabled':'')+'>'+t('f_smp_add')+'</button></fieldset>'+
 (s.errs.length?'<div class="banner bad" role="alert"><b>'+t('f_err')+'</b></div>':'')+
 '<p role="status" class="muted small">'+(evDirty()?t('ed_unsaved'):t('e2_priv'))+'</p><div class="row"><button type="button" class="btn ghost" data-act="evsd">'+t('e2_savedraft')+'</button><button class="btn" type="submit">'+t('e2_review')+'</button></div></form>'}
function evDirty(){var d=S.evd.draft,b=BLANK();return JSON.stringify(d)!==JSON.stringify(b)&&S.evd.phase==='edit'}
function evReviewBox(){var d=S.evd.draft;return'<div class="review" style="margin-top:0"><b>'+t('rv_t')+'</b><p style="margin:.3rem 0">'+t('rv_w')+'</p><p style="margin:.2rem 0"><b>'+t('f_title')+':</b> '+esc(d.title)+'</p><p style="margin:.2rem 0"><b>'+t('f_sit')+':</b> '+esc(d.sit)+'</p><p style="margin:.2rem 0"><b>'+t('f_resp')+':</b> '+esc(d.resp)+'</p><p style="margin:.2rem 0"><b>'+t('f_acts')+':</b> '+esc(d.acts.filter(Boolean).join(' / '))+'</p><p style="margin:.2rem 0"><b>'+t('f_deliv')+':</b> '+esc(d.deliv)+'</p></div>'}
V.evidencia_nueva=function(){var s=S.evd;if(!s.draft)s.draft=BLANK();var edit=s.editId!==null,ph=s.phase,body;
 if(ph==='edit')body=evForm();
 else if(ph==='review')body=evReviewBox()+'<label class="check"><input type="checkbox" id="ev-chk"'+(s.chk?' checked':'')+'><span>'+t('rv_chk')+'</span></label><div class="row"><button class="btn ghost" data-act="evback">'+t('rv_back')+'</button><button class="btn" id="ev-ok" data-act="evconf"'+(s.chk?'':' disabled')+'>'+t('rv_ok')+'</button></div>';
 else if(ph==='saving')body='<p role="status">'+t('sv_ing')+'</p>'+evReviewBox();
 else if(ph==='uncertain')body='<div class="banner bad" role="alert"><b>'+t('sv_unc')+'</b>'+t('sv_unc_p')+'<div class="row"><button class="btn" data-act="evretry">'+t('sv_retry')+'</button></div></div>'+evReviewBox();
 else body='<div role="status"><h2 style="font-size:1.6rem">'+t(s.savedAs==='c'?'sv_conf':'sv_draft')+'</h2></div><div class="row"><a class="btn" href="#inicio">'+t('sv_next')+'</a><a class="lnk" style="text-decoration:none" href="#evidencias">'+t('e2_back')+'</a></div>';
 return'<main class="narrow"><p style="padding-top:1rem"><a href="#evidencias">'+t('e2_back')+'</a></p><h1 class="s" style="margin:.3rem 0">'+t(edit?'ed_edit':'ed_new')+'</h1><p class="muted">'+t('e2_priv')+'</p>'+(edit?'<p class="small muted">'+t('e2_newv')+'</p>':'')+body+'</main>'};
V.evidencia_editar=V.evidencia_nueva;
function evSync(){var s=S.evd,d=s.draft;if(!d)return;['title','sit','resp','goal','deliv','learn'].forEach(function(k){var e=document.getElementById('ef-'+k);if(e)d[k]=e.value});
 d.acts.forEach(function(_,i){var e=document.getElementById('ea-acts'+i);if(e)d.acts[i]=e.value});d.alts.forEach(function(_,i){var e=document.getElementById('ea-alts'+i);if(e)d.alts[i]=e.value});d.smp.forEach(function(_,i){var e=document.getElementById('es-'+i);if(e)d.smp[i]=e.value});
 var et=document.getElementById('ef-effT');if(et)d.effT=et.value;var a=document.getElementById('ef-aut');if(a)d.aut=a.value}
function evGo(r){location.hash=r}
ACTS.evnew=function(){var s=S.evd;s.draft=BLANK();s.editId=null;s.phase='edit';s.chk=false;s.errs=[];evGo('evidencia_nueva')};
ACTS.evopen=function(b,v){S.evd.sel=+v;S.route='evidencia_detalle'};
ACTS.evedit=function(b,v){var s=S.evd,e=s.list.filter(function(x){return x.id===+v})[0];s.draft={title:evT(e,'title'),sit:'La situación que contaste antes.',resp:'Lo que te tocaba a ti.',acts:['Lo que hiciste primero.'],alts:[],goal:evT(e,'goal'),deliv:evT(e,'deliv'),eff:e.d.eff,effT:e.d.effT,learn:'',aut:'',smp:[]};s.editId=e.id;s.phase='edit';s.chk=false;s.errs=[];evGo('evidencia_editar')};
ACTS.evdel=function(b,v){S.evd.dlg=+v;render();var o=document.getElementById('ev-dok');if(o)o.focus()};ACTS.evdno=function(){S.evd.dlg=null;render()};
ACTS.evdok=function(b,v){var s=S.evd;s.list=s.list.filter(function(x){return x.id!==+v});s.dlg=null;render();toast(t('e2_deleted'))};
ACTS.evaad=function(b){evSync();var k=b.dataset.k,d=S.evd.draft;if(d[k].length<(k==='acts'?8:5))d[k].push('');render()};
ACTS.evarm=function(b){evSync();var d=S.evd.draft,k=b.dataset.k;d[k].splice(+b.dataset.v,1);if(k==='acts'&&!d.acts.length)d.acts=[''];render()};
ACTS.evsad=function(){evSync();S.evd.draft.smp.push('');render()};ACTS.evsrm=function(b,v){evSync();S.evd.draft.smp.splice(+v,1);render()};
ACTS.evsd=function(){evSync();var s=S.evd;if(!s.draft.title.trim()){s.errs=['title'];render();document.getElementById('ef-title').focus();return}s.errs=[];evCommit('d')};
function evValid(){var d=S.evd.draft,er=[];if(!d.title.trim())er.push('title');if(!d.sit.trim())er.push('sit');if(!d.resp.trim())er.push('resp');if(!d.acts.some(function(x){return x.trim()}))er.push('acts');if(!d.deliv.trim())er.push('deliv');if(!d.eff||(d.eff==='known'&&!d.effT.trim()))er.push('eff');return er}
SUBS['f-evn']=function(){evSync();var s=S.evd;s.errs=evValid();if(s.errs.length){render();var f=document.querySelector('[aria-invalid=true]');if(f)f.focus();return}s.phase='review';s.chk=false;render()};
ACTS.evback=function(){S.evd.phase='edit';render()};
CHG['ev-chk']=function(el){S.evd.chk=el.checked;var b=document.getElementById('ev-ok');if(b)b.disabled=!el.checked};
CHG['ef-effk']=function(){evSync();S.evd.draft.eff='known';render();document.getElementById('ef-effT').focus()};CHG['ef-effu']=function(){evSync();S.evd.draft.eff='unknown';render()};
function evCommit(kind){var s=S.evd;s.phase='saving';render();setTimeout(function(){if(S.mode!=='ok'){s.phase='uncertain';s.kind=kind;render();return}evSave(kind)},500)}
function evSave(kind){var s=S.evd,d=s.draft,item;
 if(s.editId!==null){item=s.list.filter(function(x){return x.id===s.editId})[0];item.v++;item.status=kind;item.seed=null;item.origin=item.origin;item.d={title:d.title,goal:d.goal,deliv:d.deliv,eff:d.eff,effT:d.effT}}
 else{item={id:++s.seq,status:kind,v:1,chat:false,date:new Date().toISOString().slice(0,10),d:{title:d.title,goal:d.goal,deliv:d.deliv,eff:d.eff,effT:d.effT}};s.list.unshift(item)}
 s.sel=item.id;s.savedAs=kind;s.phase='saved';render();toast(t(kind==='c'?'sv_conf':'sv_draft'))}
ACTS.evconf=function(){evCommit('c')};ACTS.evretry=function(){var s=S.evd;evCommit(s.kind||'c')};
document.getElementById('app').addEventListener('input',function(e){var id=e.target.id;if(/^(ef|ea|es)-/.test(id)){var s=S.evd;if(s.errs.length){s.errs=[]}}});
