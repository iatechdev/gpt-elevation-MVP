/* Familia administración (1/2): estructura, panel, métricas, guías de la IA y manifiesto ético.
   Código real: layouts/AdminLayout.tsx, components/AdminSidebar.tsx, pages/admin/AdminDashboard.tsx, AdminMetrics.tsx, AdminPrompts.tsx, pages/board/BoardManifest.tsx.
   Cifras, nombres, fechas y textos de guías son EJEMPLOS. Cambios propuestos respecto al código (ver README, decisiones 21–30):
   «prompts» pasa a «Guías de la IA»; las versiones propuestas muestran su texto (el servidor hoy no lo devuelve, así que quien aprueba lo hace a ciegas);
   aprobar, publicar y reactivar piden confirmación en un diálogo propio (hoy aprobar no la pide y reactivar usa window.confirm);
   el rojo queda solo para errores; emojis y estrellas se sustituyen por palabras; la gráfica de actividad tiene alternativa en tabla;
   el panel de alertas tiene su propio error con reintento (hoy lo traga). */
copy({
 ad_role_a:'Administración',ad_role_s:'Superadministración',ad_role_b:'Junta ética',ad_who:'Marcela (ejemplo)',ad_out:'Salir',
 ad_n_panel:'Panel',ad_n_ag:'Guías de la IA',ad_n_cont:'Contenido',ad_n_us:'Personas usuarias',ad_n_met:'Métricas',ad_n_cr:'Catálogo de rutas',ad_n_ks:'Catálogo de habilidades',ad_n_pi:'Piloto',ad_n_mf:'Manifiesto ético',ad_grp:'Junta',
 ad_noacc:'Tu rol no tiene acceso a esta pantalla.',ad_noacc_p:'Si crees que deberías verla, pídeselo a quien administra la plataforma.',ad_loadErr:'No se pudo cargar la información.',ad_ofm:'de 5',ad_nodata:'Sin datos',ad_cancel:'Cancelar',ad_close:'Cerrar',
 ad_p:'Prototipo, ver como:',ad_p_a:'Administración',ad_p_s:'Superadministración',ad_p_b:'Junta ética',
 ad_pt:'Panel de administración',ad_ps:'Resumen de la plataforma.',
 ad_s1:'Personas usuarias',ad_s2:'Personas activas',ad_s3:'Profesionales',ad_s4:'Sesiones (30 días)',ad_s5:'Activas esta semana',ad_s6:'Ánimo promedio',ad_s7:'Valoración promedio',
 ad_act:'Actividad de los últimos 30 días',ad_actAlt:'Sesiones por día: {n} en total, máximo {m} en un día.',ad_actTbl:'Ver como tabla',ad_actNone:'Aún no hay sesiones.',ad_day:'Día',ad_cnt:'Sesiones',
 ad_top:'Profesionales con más personas',ad_topNone:'Aún no hay profesionales.',ad_th1:'Profesional',ad_th2:'Personas',ad_th3:'Valoración',
 ad_al:'Avisos',ad_alErr:'No se pudieron cargar los avisos.',ad_alPend:'{n} guías de profesionales esperan revisión',ad_alPend1:'1 guía de profesional espera revisión',ad_alPendSub:'Esperan revisión ética.',ad_alReview:'Revisar',
 ad_alProf:'{n} profesionales con el perfil incompleto',ad_alProf1:'1 profesional con el perfil incompleto',ad_alProf0:'Todos los perfiles están completos.',ad_alMan:'Manifiesto ético {v}',ad_alManSub:'Vigente desde {d}',ad_alList:'Guías por revisar',ad_alAll:'Ver todas',
 ad_mt:'Métricas',ad_ms:'Indicadores de uso de la plataforma.',ad_m1:'Sesiones en 30 días',ad_m2:'Promedio por día',ad_m3:'Máximo en un día',ad_from:'Desde {d}',ad_to:'Hasta {d}',
 ad_p_pn1:'ver cargando',ad_p_pn2:'ver error de carga',ad_p_pn3:'ver avisos con error',ad_p_pn4:'ver sin datos',ad_p_pn5:'ver todo normal',
 ag_t:'Guías de la IA',ag_sub:'Instrucciones que orientan cómo conversa la IA. Cada cambio queda como una versión; la activa es la que se usa.',ag_new:'Crear guía nueva',
 ag_list:'Guías',ag_empty:'Aún no hay guías.',ag_pickh:'Elige una guía',ag_pickp:'Verás su versión activa y su historial.',ag_ver:'Versión {v}',ag_upd:'Actualizada por {a} · {d}',ag_pendN:'{n} en revisión',
 ag_st_active:'Activa',ag_st_approved:'Aprobada',ag_st_pending_review:'En revisión',ag_st_rejected:'Rechazada',ag_st_archived:'Archivada',
 ag_active:'Versión activa',ag_apby:'Aprobada por {a}',ag_show:'Ver texto activo',ag_hide:'Ocultar texto',ag_prop:'Proponer nueva versión',ag_pub:'Publicar nueva versión',
 ag_hist:'Historial de versiones',ag_hnone:'Aún no hay otras versiones.',ag_hErr:'No se pudo cargar el historial.',ag_by:'Propuesta por {a} · {d}',ag_read:'Leer texto',ag_unread:'Ocultar texto',ag_apr:'Aprobar',ag_rej:'Rechazar',ag_rejNote:'Nota de rechazo: {n}',ag_pendBanner:'{n} versión(es) esperan tu decisión para {k}.',
 ag_dprop:'Proponer nueva versión de {k}',ag_dpub:'Publicar nueva versión de {k}',ag_dnew:'Crear guía nueva',ag_rules:'Recuerda: sin diagnóstico, sin tratamiento y sin promesas de empleo.',
 ag_lkey:'Identificador',ag_hkey:'Solo minúsculas, números y guion bajo. No se puede cambiar después.',ag_ltxt:'Texto de la guía',ag_ct:'{n} caracteres · mínimo 10',
 ag_wprop:'Tu propuesta no se usará hasta que superadministración la apruebe.',ag_wpub:'Al publicar, esta versión se activa de inmediato y la IA empieza a usarla.',
 ag_bprop:'Enviar propuesta',ag_bpub:'Publicar y activar',ag_bnew:'Crear y activar',ag_busy:'Guardando…',
 ag_e_key:'Escribe un identificador válido: minúsculas, números y guion bajo, empezando por una letra.',ag_e_dup:'Ya existe una guía con ese identificador.',ag_e_txt:'Escribe al menos 10 caracteres.',ag_e_save:'No se pudo guardar. Tu texto sigue aquí; inténtalo de nuevo.',
 ag_dapr:'Aprobar la versión {v}',ag_aprP:'La versión {v} de {k} pasará a ser la activa y la IA empezará a usarla. La anterior queda archivada.',ag_aprb:'Aprobar y activar',
 ag_drej:'Rechazar la versión {v}',ag_rejL:'Motivo del rechazo',ag_rejH:'Quien la propuso lo verá.',ag_e_note:'Escribe el motivo del rechazo.',ag_rejb:'Confirmar rechazo',
 ag_ok_prop:'Propuesta enviada. Queda en revisión.',ag_ok_pub:'Nueva versión publicada y activa.',ag_ok_new:'Guía creada y activa.',ag_ok_apr:'Versión aprobada y activa.',ag_ok_rej:'Versión rechazada.',
 ag_p1:'ver cargando',ag_p2:'ver error de lista',ag_p3:'ver sin guías',ag_p4:'ver error del historial',ag_p5:'ver todo normal',
 ag_ex1:'Texto de ejemplo para el diseño. Acompañas con calidez y sin diagnosticar. Haces una pregunta a la vez. Si la persona nombra una crisis, la remites a ayuda humana y no sigues con el ejercicio.',
 ag_ex2:'Texto de ejemplo. Propuesta: además, ofreces cerrar cada conversación con un siguiente paso pequeño que la persona pueda elegir no hacer.',
 ag_ex3:'Texto de ejemplo. Pides un momento del día en que la persona se sintió con energía y lo reflejas con sus propias palabras.',
 mf_t:'Manifiesto ético',mf_sub:'Documento vinculante que guía el comportamiento de la IA de Elevation. Cada versión queda guardada.',mf_new:'Nueva versión',mf_active:'Versión activa',mf_actChip:'Activa',mf_hist:'Historial de versiones',mf_by:'Publicada por {a} · {d}',mf_read:'Leer',mf_unread:'Ocultar',mf_react:'Reactivar',mf_empty:'Aún no hay versiones del manifiesto.',mf_loadErr:'No se pudo cargar el historial.',
 mf_ft:'Publicar una nueva versión',mf_fnote:'Nota de versión (opcional)',mf_fnoteH:'Por ejemplo: ajustes tras la revisión del trimestre.',mf_ftxt:'Contenido del manifiesto',mf_fct:'{n} caracteres · mínimo 50',mf_e_txt:'El manifiesto debe tener al menos 50 caracteres.',mf_pubb:'Publicar y activar',
 mf_dpub:'Publicar y activar la nueva versión',mf_pubP:'La nueva versión se activa de inmediato y cambia cómo se comporta la IA para todas las personas. La versión actual queda en el historial y podrás reactivarla.',
 mf_dreact:'Reactivar la versión {v}',mf_reactP:'La versión {v} volverá a ser la activa y cambiará cómo se comporta la IA para todas las personas.',mf_reactb:'Reactivar',
 mf_ok_pub:'Manifiesto publicado y activo: {v}.',mf_ok_react:'Versión reactivada: {v}.',mf_e_pub:'No se pudo publicar el manifiesto. Tu texto sigue aquí.',mf_e_react:'No se pudo reactivar la versión.',
 mf_p1:'ver cargando',mf_p2:'ver error de carga',mf_p3:'ver vacío',mf_p4:'ver todo normal',
 mf_ex1:'Texto de ejemplo para el diseño. La IA acompaña, no diagnostica ni receta. La privacidad de la persona va primero. No promete empleo ni resultados. Ante una crisis, remite a ayuda humana.',
 mf_ex2:'Texto de ejemplo de una versión anterior. La IA acompaña y no diagnostica. La privacidad de la persona va primero.',
 mf_ex3:'Texto de ejemplo de la primera versión.',mf_note1:'Ajustes tras la revisión de octubre (ejemplo)',mf_note2:'Se añade el límite sobre promesas (ejemplo)',
 routes:{adm_panel:'Admin · panel',adm_metricas:'Admin · métricas',adm_prompts:'Admin · guías de la IA',junta_manifiesto:'Junta · manifiesto ético'}
},{
 ad_role_a:'Administration',ad_role_s:'Superadministration',ad_role_b:'Ethics board',ad_who:'Marcela (example)',ad_out:'Sign out',
 ad_n_panel:'Dashboard',ad_n_ag:'AI guides',ad_n_cont:'Content',ad_n_us:'Users',ad_n_met:'Metrics',ad_n_cr:'Route catalog',ad_n_ks:'Skills catalog',ad_n_pi:'Pilot',ad_n_mf:'Ethical manifest',ad_grp:'Board',
 ad_noacc:'Your role does not have access to this screen.',ad_noacc_p:'If you think you should see it, ask whoever administers the platform.',ad_loadErr:'The information could not be loaded.',ad_ofm:'out of 5',ad_nodata:'No data',ad_cancel:'Cancel',ad_close:'Close',
 ad_p:'Prototype, view as:',ad_p_a:'Administration',ad_p_s:'Superadministration',ad_p_b:'Ethics board',
 ad_pt:'Administration dashboard',ad_ps:'Platform overview.',
 ad_s1:'Users',ad_s2:'Active users',ad_s3:'Professionals',ad_s4:'Sessions (30 days)',ad_s5:'Active this week',ad_s6:'Average mood',ad_s7:'Average rating',
 ad_act:'Activity over the last 30 days',ad_actAlt:'Sessions per day: {n} in total, at most {m} in one day.',ad_actTbl:'View as table',ad_actNone:'There are no sessions yet.',ad_day:'Day',ad_cnt:'Sessions',
 ad_top:'Professionals with the most people',ad_topNone:'There are no professionals yet.',ad_th1:'Professional',ad_th2:'People',ad_th3:'Rating',
 ad_al:'Notices',ad_alErr:'Notices could not be loaded.',ad_alPend:'{n} professional guides await review',ad_alPend1:'1 professional guide awaits review',ad_alPendSub:'They await ethical review.',ad_alReview:'Review',
 ad_alProf:'{n} professionals with an incomplete profile',ad_alProf1:'1 professional with an incomplete profile',ad_alProf0:'All profiles are complete.',ad_alMan:'Ethical manifest {v}',ad_alManSub:'In force since {d}',ad_alList:'Guides to review',ad_alAll:'See all',
 ad_mt:'Metrics',ad_ms:'Platform usage indicators.',ad_m1:'Sessions in 30 days',ad_m2:'Daily average',ad_m3:'Maximum in one day',ad_from:'From {d}',ad_to:'To {d}',
 ad_p_pn1:'see loading',ad_p_pn2:'see load error',ad_p_pn3:'see notices error',ad_p_pn4:'see no data',ad_p_pn5:'see all normal',
 ag_t:'AI guides',ag_sub:'Instructions that guide how the AI converses. Every change is kept as a version; the active one is the one in use.',ag_new:'Create new guide',
 ag_list:'Guides',ag_empty:'There are no guides yet.',ag_pickh:'Choose a guide',ag_pickp:'You will see its active version and its history.',ag_ver:'Version {v}',ag_upd:'Updated by {a} · {d}',ag_pendN:'{n} under review',
 ag_st_active:'Active',ag_st_approved:'Approved',ag_st_pending_review:'Under review',ag_st_rejected:'Rejected',ag_st_archived:'Archived',
 ag_active:'Active version',ag_apby:'Approved by {a}',ag_show:'View active text',ag_hide:'Hide text',ag_prop:'Propose a new version',ag_pub:'Publish a new version',
 ag_hist:'Version history',ag_hnone:'There are no other versions yet.',ag_hErr:'The history could not be loaded.',ag_by:'Proposed by {a} · {d}',ag_read:'Read text',ag_unread:'Hide text',ag_apr:'Approve',ag_rej:'Reject',ag_rejNote:'Rejection note: {n}',ag_pendBanner:'{n} version(s) await your decision for {k}.',
 ag_dprop:'Propose a new version of {k}',ag_dpub:'Publish a new version of {k}',ag_dnew:'Create new guide',ag_rules:'Remember: no diagnosis, no treatment and no job promises.',
 ag_lkey:'Identifier',ag_hkey:'Lowercase letters, numbers and underscore only. It cannot be changed later.',ag_ltxt:'Guide text',ag_ct:'{n} characters · minimum 10',
 ag_wprop:'Your proposal will not be used until superadministration approves it.',ag_wpub:'When you publish, this version becomes active immediately and the AI starts using it.',
 ag_bprop:'Send proposal',ag_bpub:'Publish and activate',ag_bnew:'Create and activate',ag_busy:'Saving…',
 ag_e_key:'Enter a valid identifier: lowercase letters, numbers and underscore, starting with a letter.',ag_e_dup:'A guide with that identifier already exists.',ag_e_txt:'Write at least 10 characters.',ag_e_save:'Could not save. Your text is still here; try again.',
 ag_dapr:'Approve version {v}',ag_aprP:'Version {v} of {k} will become the active one and the AI will start using it. The previous one is archived.',ag_aprb:'Approve and activate',
 ag_drej:'Reject version {v}',ag_rejL:'Reason for rejection',ag_rejH:'Whoever proposed it will see it.',ag_e_note:'Write the reason for the rejection.',ag_rejb:'Confirm rejection',
 ag_ok_prop:'Proposal sent. It is now under review.',ag_ok_pub:'New version published and active.',ag_ok_new:'Guide created and active.',ag_ok_apr:'Version approved and active.',ag_ok_rej:'Version rejected.',
 ag_p1:'see loading',ag_p2:'see list error',ag_p3:'see no guides',ag_p4:'see history error',ag_p5:'see all normal',
 ag_ex1:'Example text for the design. You accompany with warmth and without diagnosing. You ask one question at a time. If the person mentions a crisis, you refer them to human help and do not continue the exercise.',
 ag_ex2:'Example text. Proposal: also offer to close each conversation with one small next step the person may choose not to do.',
 ag_ex3:'Example text. You ask for a moment of the day when the person felt energetic and reflect it back in their own words.',
 mf_t:'Ethical manifest',mf_sub:'Binding document that guides how Elevation’s AI behaves. Every version is kept.',mf_new:'New version',mf_active:'Active version',mf_actChip:'Active',mf_hist:'Version history',mf_by:'Published by {a} · {d}',mf_read:'Read',mf_unread:'Hide',mf_react:'Reactivate',mf_empty:'There are no manifest versions yet.',mf_loadErr:'The history could not be loaded.',
 mf_ft:'Publish a new version',mf_fnote:'Version note (optional)',mf_fnoteH:'For example: adjustments after the quarterly review.',mf_ftxt:'Manifest content',mf_fct:'{n} characters · minimum 50',mf_e_txt:'The manifest must have at least 50 characters.',mf_pubb:'Publish and activate',
 mf_dpub:'Publish and activate the new version',mf_pubP:'The new version becomes active immediately and changes how the AI behaves for everyone. The current version stays in the history and you can reactivate it.',
 mf_dreact:'Reactivate version {v}',mf_reactP:'Version {v} will become the active one again and change how the AI behaves for everyone.',mf_reactb:'Reactivate',
 mf_ok_pub:'Manifest published and active: {v}.',mf_ok_react:'Version reactivated: {v}.',mf_e_pub:'The manifest could not be published. Your text is still here.',mf_e_react:'The version could not be reactivated.',
 mf_p1:'see loading',mf_p2:'see load error',mf_p3:'see empty',mf_p4:'see all normal',
 mf_ex1:'Example text for the design. The AI accompanies; it does not diagnose or prescribe. The person’s privacy comes first. It does not promise jobs or results. In a crisis, it refers to human help.',
 mf_ex2:'Example text of an earlier version. The AI accompanies and does not diagnose. The person’s privacy comes first.',
 mf_ex3:'Example text of the first version.',mf_note1:'Adjustments after the October review (example)',mf_note2:'Adds the limit on promises (example)',
 routes:{adm_panel:'Admin · dashboard',adm_metricas:'Admin · metrics',adm_prompts:'Admin · AI guides',junta_manifiesto:'Board · ethical manifest'}
});
addRoutes('g_adm',['adm_panel','adm_metricas','adm_prompts','junta_manifiesto']);
SEC.adm_rutas=['adm_rutas_borrador','adm_rutas_item'];SEC.adm_habilidades=['adm_habilidades_borrador','adm_habilidad'];
/* ---------- estructura ---------- */
S.ad={role:'s'};
var ADR=/^(adm_|junta_)/;
window.admHeader=function(){if(!ADR.test(S.route))return'';var r=S.ad.role;
 return'<header class="top"><span style="display:flex;align-items:baseline;gap:.7rem"><a class="brand" href="#adm_panel" aria-label="Elevation">Elevation<i>.</i></a><span class="chip">'+t(r==='s'?'ad_role_s':r==='b'?'ad_role_b':'ad_role_a')+'</span></span><nav class="main" aria-label="'+t('ad_role_a')+'"><details class="um"><summary><span class="who">'+t('ad_who')+'</span></summary><div class="umm"><a href="#portada">'+t('ad_out')+'</a></div></details></nav></header>'};
function adm(h){var r=S.ad.role,it=[['adm_panel','ad_n_panel'],['adm_prompts','ad_n_ag'],['adm_contenido','ad_n_cont'],['adm_usuarios','ad_n_us','s'],['adm_metricas','ad_n_met'],['adm_rutas','ad_n_cr'],['adm_habilidades','ad_n_ks'],['adm_piloto','ad_n_pi']];
 var a=function(x){return'<a href="#'+x[0]+'"'+(on(x[0])?' aria-current="page"':'')+'>'+t(x[1])+'</a>'};
 if(r==='b')return'<main class="narrow" id="ad-main" tabindex="-1">'+h+'</main>';
 return'<div class="admshell"><nav class="admnav" aria-label="'+t('ad_role_a')+'">'+it.filter(function(x){return!x[2]||r==='s'}).map(a).join('')+(r==='s'?'<span class="tag grp">'+t('ad_grp')+'</span>'+a(['junta_manifiesto','ad_n_mf']):'')+'</nav><main id="ad-main" tabindex="-1">'+h+'</main></div>'}
function adProto(items){return bjProto('ad_p',[['adrole','a','ad_p_a'],['adrole','s','ad_p_s'],['adrole','b','ad_p_b']])+(items?bjProto('pf_p',items):'')}
function adGate(){var r=S.ad.role,rt=S.route;
 if((r==='a'&&(rt==='adm_usuarios'||rt==='junta_manifiesto'))||(r==='b'&&rt!=='junta_manifiesto')){var to=r==='b'?['junta_manifiesto','ad_n_mf']:['adm_panel','ad_n_panel'];
  return adm('<div class="banner bad" role="alert"><b>'+t('ad_noacc')+'</b>'+t('ad_noacc_p')+'<div class="row"><a class="btn ghost" href="#'+to[0]+'">'+t(to[1])+'</a></div></div>'+adProto())}
 return''}
function adOk(v,msg){return pfSt(v+'-ms',t(msg),false)}
function adPh(ph,key){if(ph==='load')return'<div role="status" id="'+key+'-st" tabindex="-1" style="padding:2rem 0"><div class="pulse" aria-hidden="true"></div><p>'+t('pf_loading')+'</p></div>';
 if(ph==='err')return'<div class="banner bad" role="alert" id="'+key+'-st" tabindex="-1"><b>'+t('ad_loadErr')+'</b><div class="row"><button class="btn" data-act="adretry" data-v="'+key+'">'+t('pf_retry')+'</button></div></div>';return''}
function adHead(key,title,sub,extra){return'<div style="padding:.2rem 0 .4rem"><div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:baseline"><h1 class="s" id="'+key+'-h" tabindex="-1">'+title+'</h1>'+(extra||'')+'</div>'+(sub?'<p class="muted" style="margin:.2rem 0 0;max-width:42rem">'+sub+'</p>':'')+pfTop()+'</div>'}
function adCt(id,key,n){return'<p class="small muted" id="'+id+'" style="margin:.2rem 0 0">'+t(key,{n:n})+'</p>'}
ACTS.adrole=function(b,v){S.ad.role=v;var r=S.route;if(v==='b'&&r!=='junta_manifiesto')location.hash='#junta_manifiesto';else render();pfFoc('ad-main')};
ACTS.adretry=function(b,v){var o=S[v];o.ph='load';render();pfFoc(v+'-st');setTimeout(function(){o.ph=S.mode==='ok'?'ok':'err';render();pfFoc(o.ph==='ok'?v+'-h':v+'-st')},600)};
/* v = «estado.campo.valor», por ejemplo «ag.ph.err» */
ACTS.adsim=function(b,v){var p=v.split('.'),o=S[p[0]];if(p[1]==='reset'){o.ph='ok';o.al='ok';o.empty=false}else o[p[1]]=p[2];o.dlg=null;render();pfFoc(document.getElementById(p[0]+'-st')?p[0]+'-st':p[0]+'-h')};
var ADC={},ADV={};
document.addEventListener('input',function(e){var id=e.target.id,m=ADC[id];if(ADV[id])ADV[id](e.target.value);if(m){var el=document.getElementById(m[0]);if(el)el.textContent=t(m[1],{n:e.target.value.length})}});
document.addEventListener('keydown',function(e){var d=document.querySelector('.dlg');if(!d||!/^(adm_|junta_|restablecer|profesionales|precios)/.test(S.route))return;
 if(e.key==='Escape'){var x=d.querySelector('[data-esc]');if(x&&!x.disabled){e.preventDefault();x.click()}return}
 if(e.key==='Tab'){var b=[].slice.call(d.querySelectorAll('button:not([disabled]),textarea,input:not([disabled]),select,a[href]'));if(!b.length)return;var f=b[0],l=b[b.length-1];if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus()}else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus()}}});
/* ============ PANEL Y MÉTRICAS ============ */
S.dp={ph:'ok',al:'ok',empty:false};
var ADPROS=[{n:'Lucía (ejemplo)',p:3,r:4.6},{n:'Andrés (ejemplo)',p:2,r:null}];
function adDays(){var c=[0,1,0,0,2,1,0,0,0,1,0,2,0,0,1,0,0,0,3,1,0,0,1,0,0,2,0,1,0,0],a=[],b=new Date('2026-11-07T12:00:00');
 for(var i=29;i>=0;i--){var d=new Date(b);d.setDate(b.getDate()-i);a.push({d:d.toISOString().slice(0,10),n:S.dp.empty?0:c[29-i]})}return a}
function adStats(days){var tot=days.reduce(function(s,x){return s+x.n},0),mx=Math.max.apply(null,days.map(function(x){return x.n}));return{tot:tot,max:mx,avg:tot/days.length}}
function adBars(days,tall){var st=adStats(days),mx=Math.max(st.max,1);
 if(!st.tot)return'<p class="muted" role="status">'+t('ad_actNone')+'</p>';
 return'<div class="bars" style="height:'+(tall?'10':'6.5')+'rem" role="img" aria-label="'+t('ad_actAlt',{n:st.tot,m:st.max})+'">'+days.map(function(x){return'<i style="height:'+(x.n?Math.max(x.n/mx*100,10):2)+'%"></i>'}).join('')+'</div>'+
 '<div class="axis small muted"><span>'+pfD(days[0].d)+'</span><span>'+pfD(days[29].d)+'</span></div>'+
 '<details style="margin-top:.6rem"><summary class="lnk" style="display:inline-block">'+t('ad_actTbl')+'</summary><div class="tblw"><table class="tbl"><thead><tr><th scope="col">'+t('ad_day')+'</th><th scope="col">'+t('ad_cnt')+'</th></tr></thead><tbody>'+days.map(function(x){return'<tr><td>'+pfD(x.d)+'</td><td>'+x.n+'</td></tr>'}).join('')+'</tbody></table></div></details>'}
function adTop(){if(S.dp.empty)return'<p class="muted" role="status">'+t('ad_topNone')+'</p>';
 return'<div class="tblw"><table class="tbl"><thead><tr><th scope="col">'+t('ad_th1')+'</th><th scope="col">'+t('ad_th2')+'</th><th scope="col">'+t('ad_th3')+'</th></tr></thead><tbody>'+ADPROS.map(function(p){return'<tr><td>'+p.n+'</td><td>'+p.p+'</td><td>'+(p.r==null?'<span aria-label="'+t('ad_nodata')+'">—</span>':pfNum(p.r)+' '+t('ad_ofm'))+'</td></tr>'}).join('')+'</tbody></table></div>'}
function adStat(l,v){return'<div class="stat"><dt>'+l+'</dt><dd>'+v+'</dd></div>'}
V.adm_panel=function(){var gt=adGate();if(gt)return gt;var d=S.dp,h=adHead('dp',t('ad_pt'),t('ad_ps')),ph=adPh(d.ph,'dp');
 var px=adProto([['adsim','dp.ph.load','ad_p_pn1'],['adsim','dp.ph.err','ad_p_pn2'],['adsim','dp.al.err','ad_p_pn3'],['adsim','dp.empty.true','ad_p_pn4'],['adsim','dp.reset','ad_p_pn5']]);
 if(ph)return adm(h+ph+px);
 var days=adDays(),st=adStats(days),e=d.empty;
 h+='<dl class="stats">'+adStat(t('ad_s1'),e?0:6)+adStat(t('ad_s2'),e?0:5)+adStat(t('ad_s3'),e?0:2)+adStat(t('ad_s4'),st.tot)+adStat(t('ad_s5'),e?0:4)+
  adStat(t('ad_s6'),e?'<span aria-label="'+t('ad_nodata')+'">—</span>':pfNum(3.8)+' <small>'+t('ad_ofm')+'</small>')+adStat(t('ad_s7'),e?'<span aria-label="'+t('ad_nodata')+'">—</span>':pfNum(4.5)+' <small>'+t('ad_ofm')+'</small>')+'</dl>';
 h+='<div class="pfcols"><div><section class="card" aria-labelledby="dp-a"><h2 id="dp-a" style="font-size:1.4rem">'+t('ad_act')+'</h2>'+adBars(days)+'</section><section class="card" style="margin-top:1rem" aria-labelledby="dp-t"><h2 id="dp-t" style="font-size:1.4rem">'+t('ad_top')+'</h2>'+adTop()+'</section></div>';
 h+='<aside aria-labelledby="dp-al"><h2 id="dp-al" style="font-size:1.4rem;margin-top:0">'+t('ad_al')+'</h2>';
 if(d.al==='err')h+='<div class="banner bad" role="alert" id="dp-ale" tabindex="-1"><b>'+t('ad_alErr')+'</b><div class="row"><button class="btn" data-act="adalretry">'+t('pf_retry')+'</button></div></div>';
 else{var pend=e?[]:[{who:'Lucía (ejemplo)',v:2,d:'2026-11-04'}];
  h+='<ul class="stackl"><li class="card"><b>'+(pend.length===1?t('ad_alPend1'):t('ad_alPend',{n:pend.length}))+'</b><p class="small muted" style="margin:.2rem 0 .5rem">'+t('ad_alPendSub')+'</p>'+(pend.length?'<a class="btn ghost" href="#adm_prompts">'+t('ad_alReview')+'</a>':'')+'</li>'+
  '<li class="card"><b>'+(e?t('ad_alProf0'):t('ad_alProf1'))+'</b></li><li class="card"><b>'+t('ad_alMan',{v:'v1.2'})+'</b><p class="small muted" style="margin:.2rem 0 0">'+t('ad_alManSub',{d:pfD('2026-10-02')})+'</p></li></ul>';
  if(pend.length)h+='<h3 style="font-size:1.1rem;margin:1.2rem 0 .3rem">'+t('ad_alList')+'</h3><ul class="stackl">'+pend.map(function(p){return'<li class="item" style="padding:.5rem 0"><b>'+p.who+'</b><span class="small muted">'+t('ag_ver',{v:p.v})+' · '+pfD(p.d)+'</span></li>'}).join('')+'</ul><a class="lnk" href="#adm_prompts" style="text-decoration:none">'+t('ad_alAll')+'</a>'}
 return adm(h+'</aside></div>'+px)};
ACTS.adalretry=function(){S.dp.al='ok';render();pfFoc('dp-h')};
V.adm_metricas=function(){var gt=adGate();if(gt)return gt;var d=S.dp,h=adHead('dp',t('ad_mt'),t('ad_ms')),ph=adPh(d.ph,'dp');
 var px=adProto([['adsim','dp.ph.load','ad_p_pn1'],['adsim','dp.ph.err','ad_p_pn2'],['adsim','dp.empty.true','ad_p_pn4'],['adsim','dp.reset','ad_p_pn5']]);
 if(ph)return adm(h+ph+px);var days=adDays(),st=adStats(days);
 h+='<dl class="stats">'+adStat(t('ad_m1'),st.tot)+adStat(t('ad_m2'),pfNum(Math.round(st.avg*10)/10))+adStat(t('ad_m3'),st.max)+'</dl>';
 h+='<section class="card" aria-labelledby="dp-a"><h2 id="dp-a" style="font-size:1.4rem">'+t('ad_act')+'</h2>'+adBars(days,true)+'</section><section class="card" style="margin-top:1rem" aria-labelledby="dp-t"><h2 id="dp-t" style="font-size:1.4rem">'+t('ad_top')+'</h2>'+adTop()+'</section>';
 return adm(h+px)};
/* ============ GUÍAS DE LA IA ============ */
function agMk(){return[
 {k:'elevation_system_prompt',v:3,txt:'ag_ex1',by:'Marcela (ejemplo)',at:'2026-10-20T15:00:00-05:00',ap:'Marcela (ejemplo)',vs:[
  {v:3,st:'active',prop:'Marcela (ejemplo)',at:'2026-10-20T15:00:00-05:00',txt:'ag_ex1'},{v:2,st:'archived',prop:'Marcela (ejemplo)',at:'2026-10-02T10:00:00-05:00',txt:'ag_ex3'},{v:1,st:'rejected',prop:'Lucía (ejemplo)',at:'2026-09-21T09:00:00-05:00',txt:'ag_ex2',note:'El tono no coincide con el manifiesto (ejemplo).'}]},
 {k:'checkin_prompt',v:1,txt:'ag_ex3',by:'Marcela (ejemplo)',at:'2026-10-05T11:00:00-05:00',ap:'Marcela (ejemplo)',vs:[{v:1,st:'active',prop:'Marcela (ejemplo)',at:'2026-10-05T11:00:00-05:00',txt:'ag_ex3'}]},
 {k:'guia_lucia',v:1,txt:'ag_ex3',by:'Lucía (ejemplo)',at:'2026-10-28T16:00:00-05:00',ap:'Marcela (ejemplo)',vs:[{v:2,st:'pending_review',prop:'Lucía (ejemplo)',at:'2026-11-04T09:30:00-05:00',txt:'ag_ex2'},{v:1,st:'active',prop:'Lucía (ejemplo)',at:'2026-10-28T16:00:00-05:00',txt:'ag_ex3'}]}]}
S.ag={ph:'ok',vl:'ok',gs:agMk(),sel:null,show:false,rd:null,dlg:null,vn:null,back:'',txt:'',key:'',note:'',busy:false,err:'',msg:''};
function agG(){return S.ag.gs.filter(function(g){return g.k===S.ag.sel})[0]}
function agT(o){return o.live!=null?o.live:t(o.txt)}
function agPend(g){return g.vs.filter(function(x){return x.st==='pending_review'})}
function agChip(st){return'<span class="chip '+(st==='active'?'ok':st==='pending_review'?'wait':'')+'">'+t('ag_st_'+st)+'</span>'}
V.adm_prompts=function(){var gt=adGate();if(gt)return gt;var a=S.ag,su=S.ad.role==='s',
 h=adHead('ag',t('ag_t'),t('ag_sub'),su&&a.ph==='ok'&&a.gs.length?'<button class="btn ghost" id="ag-nb" data-act="agdlg" data-v="new">'+t('ag_new')+'</button>':''),ph=adPh(a.ph,'ag'),
 px=adProto([['adsim','ag.ph.load','ag_p1'],['adsim','ag.ph.err','ag_p2'],['agsim','empty','ag_p3'],['adsim','ag.vl.err','ag_p4'],['agsim','ok','ag_p5']]);
 if(ph)return adm(h+ph+px);
 if(!a.gs.length)return adm(h+'<p role="status" style="padding:1.4rem 0">'+t('ag_empty')+'</p>'+(su?'<div class="row"><button class="btn" id="ag-nb" data-act="agdlg" data-v="new">'+t('ag_new')+'</button></div>':'')+(a.dlg?agDlg():'')+px);
 if(a.msg)h+=adOk('ag',a.msg);
 h+='<div class="pfcols" style="grid-template-columns:minmax(0,1fr) minmax(0,1.6fr)"><section aria-labelledby="ag-l"><h2 id="ag-l" style="font-size:1.4rem;margin-top:0">'+t('ag_list')+'</h2><ul class="stackl">'+a.gs.map(function(g){var pn=agPend(g).length;
  return'<li><button class="gbtn" data-act="agpick" data-v="'+g.k+'" aria-pressed="'+(a.sel===g.k)+'"><code>'+g.k+'</code><span class="small muted">'+t('ag_ver',{v:g.v})+' · '+t('ag_upd',{a:g.by,d:pfD(g.at)})+'</span>'+(pn&&su?'<span class="chip wait">'+t('ag_pendN',{n:pn})+'</span>':'')+'</button></li>'}).join('')+'</ul></section>';
 var g=agG();
 if(!g)h+='<section class="card" aria-live="polite"><p class="tag">'+t('ag_pickh')+'</p><p>'+t('ag_pickp')+'</p></section>';
 else{var pe=agPend(g);
  h+='<section aria-labelledby="ag-d">';
  if(su&&pe.length)h+='<div class="banner" role="status"><b>'+t('ag_pendBanner',{n:pe.length,k:g.k})+'</b></div>';
  h+='<div class="card"><h2 id="ag-d" tabindex="-1" style="font-size:1.4rem;margin-top:0"><code>'+g.k+'</code></h2><p style="margin:0">'+t('ag_active')+': <b>'+t('ag_ver',{v:g.v})+'</b> '+agChip('active')+'</p><p class="small muted" style="margin:.2rem 0 0">'+t('ag_apby',{a:g.ap})+'</p>'+
   '<div class="row"><button class="btn ghost" id="ag-sh" data-act="agshow" aria-expanded="'+a.show+'" aria-controls="ag-tx">'+t(a.show?'ag_hide':'ag_show')+'</button><button class="btn" id="ag-pb" data-act="agdlg" data-v="'+(su?'pub':'prop')+'">'+t(su?'ag_pub':'ag_prop')+'</button></div>'+(a.show?'<p id="ag-tx" class="prose" style="margin:.6rem 0 0">'+esc(agT(g))+'</p>':'')+'</div>';
  h+='<h3 style="font-size:1.2rem;margin:1.4rem 0 .3rem">'+t('ag_hist')+'</h3>';
  if(a.vl==='err')h+='<div class="banner bad" role="alert" id="ag-vst" tabindex="-1"><b>'+t('ag_hErr')+'</b><div class="row"><button class="btn" data-act="agvretry">'+t('pf_retry')+'</button></div></div>';
  else if(g.vs.length<2)h+='<p class="muted">'+t('ag_hnone')+'</p>';
  else h+='<ul class="stackl">'+g.vs.map(function(x){var rd=a.rd===x.v;
   return'<li class="item"><div class="top"><b>'+t('ag_ver',{v:x.v})+'</b>'+agChip(x.st)+'</div><p class="small muted" style="margin:0">'+t('ag_by',{a:x.prop,d:pfD(x.at)})+'</p>'+(x.note?'<p class="small" style="margin:0">'+t('ag_rejNote',{n:esc(x.note)})+'</p>':'')+
   '<div class="row" style="margin:.2rem 0 0">'+(su?'<button class="btn ghost" data-act="agread" data-v="'+x.v+'" aria-expanded="'+rd+'" aria-controls="ag-r'+x.v+'">'+t(rd?'ag_unread':'ag_read')+'</button>':'')+
   (su&&x.st==='pending_review'?'<button class="btn" data-act="agdlg" data-v="apr" data-n="'+x.v+'">'+t('ag_apr')+'</button><button class="btn ghost" data-act="agdlg" data-v="rej" data-n="'+x.v+'">'+t('ag_rej')+'</button>':'')+'</div>'+(rd?'<p id="ag-r'+x.v+'" class="prose small" style="margin:.4rem 0 0">'+esc(agT(x))+'</p>':'')+'</li>'}).join('')+'</ul>';
  h+='</section>'}
 h+='</div>'+(a.dlg?agDlg():'');return adm(h+px)};
function agDlg(){var a=S.ag,g=agG(),d=a.dlg,sav=a.busy?' disabled':'',b='';
 var x='<button class="btn ghost" id="ag-dx" data-esc data-act="agx"'+sav+'>'+t('ad_cancel')+'</button>';
 var er=a.err?'<p class="pferr" role="alert" id="ag-er" tabindex="-1">'+t(a.err)+'</p>':'';
 var ta='<div class="fld"><label for="ag-txt">'+t('ag_ltxt')+'</label><textarea id="ag-txt" rows="8"'+(a.err==='ag_e_txt'?' class="bad" aria-invalid="true" aria-describedby="ag-er"':'')+sav+'>'+esc(a.txt)+'</textarea>'+adCt('ag-ct','ag_ct',a.txt.length)+'</div><p class="small muted" style="margin:.4rem 0">'+t('ag_rules')+'</p>';
 ADC['ag-txt']=['ag-ct','ag_ct'];ADV['ag-txt']=function(v){S.ag.txt=v};
 if(d==='prop'||d==='pub')return pfDlg('ag-d',t(d==='pub'?'ag_dpub':'ag_dprop',{k:g.k}),'<p class="banner" style="margin:0 0 .8rem">'+t(d==='pub'?'ag_wpub':'ag_wprop')+'</p>'+ta+er+'<div class="row">'+x+'<button class="btn" data-act="agok"'+sav+'>'+(a.busy?t('ag_busy'):t(d==='pub'?'ag_bpub':'ag_bprop'))+'</button></div>');
 if(d==='new'){ADV['ag-key']=function(v){S.ag.key=v};
  return pfDlg('ag-d',t('ag_dnew'),'<div class="fld"><label for="ag-key">'+t('ag_lkey')+'</label><input id="ag-key" type="text" autocomplete="off" spellcheck="false" value="'+esc(a.key)+'"'+(a.err==='ag_e_key'||a.err==='ag_e_dup'?' class="bad" aria-invalid="true" aria-describedby="ag-er"':'')+sav+'><small>'+t('ag_hkey')+'</small></div>'+ta+er+'<div class="row">'+x+'<button class="btn" data-act="agok"'+sav+'>'+(a.busy?t('ag_busy'):t('ag_bnew'))+'</button></div>')}
 if(d==='apr')return pfDlg('ag-d',t('ag_dapr',{v:a.vn}),'<p>'+t('ag_aprP',{v:a.vn,k:g.k})+'</p>'+er+'<div class="row">'+x+'<button class="btn" data-act="agok"'+sav+'>'+(a.busy?t('ag_busy'):t('ag_aprb'))+'</button></div>');
 ADV['ag-note']=function(v){S.ag.note=v};
 return pfDlg('ag-d',t('ag_drej',{v:a.vn}),'<div class="fld"><label for="ag-note">'+t('ag_rejL')+'</label><textarea id="ag-note" rows="4"'+(a.err==='ag_e_note'?' class="bad" aria-invalid="true" aria-describedby="ag-er"':'')+sav+'>'+esc(a.note)+'</textarea><small>'+t('ag_rejH')+'</small></div>'+er+'<div class="row">'+x+'<button class="btn danger" data-act="agok"'+sav+'>'+(a.busy?t('ag_busy'):t('ag_rejb'))+'</button></div>')}
ACTS.agsim=function(b,v){var a=S.ag;a.dlg=null;a.msg='';a.vl='ok';a.ph='ok';a.gs=v==='empty'?[]:agMk();a.sel=null;render();pfFoc('ag-h')};
ACTS.agvretry=function(){S.ag.vl='ok';render();pfFoc('ag-d')};
ACTS.agpick=function(b,v){var a=S.ag;a.sel=v;a.show=false;a.rd=null;a.msg='';render();pfFoc('ag-d')};
ACTS.agshow=function(){S.ag.show=!S.ag.show;render();pfFoc('ag-sh')};
ACTS.agread=function(b,v){var a=S.ag;a.rd=a.rd===+v?null:+v;render();var e=document.querySelector('[data-act="agread"][data-v="'+v+'"]');if(e)e.focus()};
ACTS.agdlg=function(b,v){var a=S.ag,g=agG();a.dlg=v;a.err='';a.busy=false;a.back=b.id||'';a.vn=b.getAttribute('data-n')?+b.getAttribute('data-n'):null;a.key='';a.note='';a.txt=(v==='prop'||v==='pub')&&g?agT(g):'';
 if(!a.back&&a.vn)a.back='ag-d';render();pfFoc(v==='rej'?'ag-note':v==='new'?'ag-key':v==='apr'?'ag-dx':'ag-txt')};
ACTS.agx=function(){var a=S.ag;if(a.busy)return;var bk=a.back;a.dlg=null;a.err='';render();pfFoc(bk||'ag-d')};
ACTS.agok=function(){var a=S.ag,g=agG(),d=a.dlg;if(a.busy)return;a.err='';
 if(d==='new'){if(!/^[a-z][a-z0-9_]{1,47}$/.test(a.key))a.err='ag_e_key';else if(a.gs.some(function(x){return x.k===a.key}))a.err='ag_e_dup';else if(a.txt.trim().length<10)a.err='ag_e_txt'}
 else if(d==='prop'||d==='pub'){if(a.txt.trim().length<10)a.err='ag_e_txt'}
 else if(d==='rej'&&!a.note.trim())a.err='ag_e_note';
 if(a.err){render();pfFoc(a.err==='ag_e_key'||a.err==='ag_e_dup'?'ag-key':a.err==='ag_e_note'?'ag-note':'ag-txt');return}
 a.busy=true;render();setTimeout(function(){a.busy=false;
  if(S.mode!=='ok'){a.err='ag_e_save';render();pfFoc('ag-er');return}
  var now=new Date().toISOString(),me=t('ad_who'),keep='ag-d',nx=g?Math.max.apply(null,g.vs.map(function(x){return x.v}))+1:1;
  if(d==='prop'){g.vs.unshift({v:nx,st:'pending_review',prop:me,at:now,txt:'ag_ex2',live:a.txt});a.msg='ag_ok_prop'}
  else if(d==='pub'||d==='new'){if(d==='new'){g={k:a.key,v:1,txt:'ag_ex3',by:me,at:now,ap:me,vs:[]};a.gs.push(g);a.sel=g.k;nx=1}
   g.vs.forEach(function(x){if(x.st==='active')x.st='archived'});g.vs.unshift({v:nx,st:'active',prop:me,at:now,txt:g.txt,live:a.txt});g.live=a.txt;g.v=nx;g.by=me;g.at=now;g.ap=me;a.msg=d==='new'?'ag_ok_new':'ag_ok_pub'}
  else if(d==='apr'){g.vs.forEach(function(x){if(x.st==='active')x.st='archived'});var vv=g.vs.filter(function(x){return x.v===a.vn})[0];vv.st='active';g.v=vv.v;g.txt=vv.txt;g.live=vv.live;g.ap=me;a.msg='ag_ok_apr'}
  else{var r=g.vs.filter(function(x){return x.v===a.vn})[0];r.st='rejected';r.note=a.note.trim();a.msg='ag_ok_rej'}
  a.dlg=null;render();pfFoc('ag-ms')},600)};
/* ============ MANIFIESTO ÉTICO ============ */
function mfMk(){return[{v:'v1.2',act:true,note:'mf_note1',by:'Junta (ejemplo)',at:'2026-10-02',txt:'mf_ex1'},{v:'v1.1',act:false,note:'mf_note2',by:'Junta (ejemplo)',at:'2026-07-15',txt:'mf_ex2'},{v:'v1.0',act:false,note:'',by:'Junta (ejemplo)',at:'2026-04-02',txt:'mf_ex3'}]}
S.mf={ph:'ok',vs:mfMk(),open:null,form:false,txt:'',note:'',dlg:null,busy:false,err:'',msg:''};
V.junta_manifiesto=function(){var gt=adGate();if(gt)return gt;var m=S.mf,h=adHead('mf',t('mf_t'),t('mf_sub'),m.ph==='ok'?'<button class="btn" id="mf-nb" data-act="mfform" aria-expanded="'+m.form+'" aria-controls="mf-form">'+t('mf_new')+'</button>':''),ph=adPh(m.ph,'mf'),
 px=adProto([['adsim','mf.ph.load','mf_p1'],['adsim','mf.ph.err','mf_p2'],['mfsim','empty','mf_p3'],['mfsim','ok','mf_p4']]);
 if(ph)return adm(h+ph+px);
 if(m.msg)h+=adOk('mf',m.msg);
 if(m.form){ADC['mf-txt']=['mf-ct','mf_fct'];ADV['mf-txt']=function(v){S.mf.txt=v};ADV['mf-note']=function(v){S.mf.note=v};
  h+='<section class="card" id="mf-form" aria-labelledby="mf-ft"><h2 id="mf-ft" style="font-size:1.4rem;margin-top:0">'+t('mf_ft')+'</h2><div class="fld"><label for="mf-note">'+t('mf_fnote')+'</label><input id="mf-note" type="text" maxlength="200" value="'+esc(m.note)+'"><small>'+t('mf_fnoteH')+'</small></div>'+
  '<div class="fld"><label for="mf-txt">'+t('mf_ftxt')+'</label><textarea id="mf-txt" rows="10"'+(m.err==='mf_e_txt'?' class="bad" aria-invalid="true" aria-describedby="mf-er"':'')+'>'+esc(m.txt)+'</textarea>'+adCt('mf-ct','mf_fct',m.txt.length)+'</div>'+(m.err?'<p class="pferr" role="alert" id="mf-er" tabindex="-1">'+t(m.err)+'</p>':'')+
  '<div class="row"><button class="btn ghost" data-act="mfform">'+t('ad_cancel')+'</button><button class="btn" id="mf-pb" data-act="mfpub">'+t('mf_pubb')+'</button></div></section>'}
 if(!m.vs.length)h+='<p role="status" style="padding:1.4rem 0">'+t('mf_empty')+'</p>';
 else{var ac=m.vs.filter(function(x){return x.act})[0];
  if(ac)h+='<section class="card" aria-labelledby="mf-a"><p class="tag">'+t('mf_active')+'</p><h2 id="mf-a" style="font-size:1.6rem;margin:.1rem 0">'+ac.v+' <span class="chip ok">'+t('mf_actChip')+'</span></h2><p class="small muted" style="margin:0">'+t('mf_by',{a:ac.by,d:pfD(ac.at)})+'</p><p class="prose" style="margin:.7rem 0 0">'+esc(t(ac.txt))+'</p></section>';
  h+='<h2 style="font-size:1.4rem;margin:1.6rem 0 .2rem">'+t('mf_hist')+'</h2><ul class="stackl">'+m.vs.map(function(x){var o=m.open===x.v;
   return'<li class="item"><div class="top"><b>'+x.v+'</b>'+(x.act?'<span class="chip ok">'+t('mf_actChip')+'</span>':'')+'</div><p class="small muted" style="margin:0">'+t('mf_by',{a:x.by,d:pfD(x.at)})+(x.note?' · '+esc(t(x.note)):'')+'</p><div class="row" style="margin:.2rem 0 0"><button class="btn ghost" data-act="mfread" data-v="'+x.v+'" aria-expanded="'+o+'" aria-controls="mf-r-'+x.v.replace('.','_')+'">'+t(o?'mf_unread':'mf_read')+'</button>'+(x.act?'':'<button class="btn ghost" data-act="mfdlg" data-v="react" data-n="'+x.v+'">'+t('mf_react')+'</button>')+'</div>'+(o?'<p id="mf-r-'+x.v.replace('.','_')+'" class="prose" style="margin:.4rem 0 0">'+esc(t(x.txt))+'</p>':'')+'</li>'}).join('')+'</ul>'}
 if(m.dlg){var sav=m.busy?' disabled':'',er=m.err&&m.dlg?'<p class="pferr" role="alert" id="mf-er2" tabindex="-1">'+t(m.err)+'</p>':'';
  h+=pfDlg('mf-d',m.dlg==='pub'?t('mf_dpub'):t('mf_dreact',{v:m.vn}),'<p>'+(m.dlg==='pub'?t('mf_pubP'):t('mf_reactP',{v:m.vn}))+'</p>'+er+'<div class="row"><button class="btn ghost" id="mf-dx" data-esc data-act="mfx"'+sav+'>'+t('ad_cancel')+'</button><button class="btn" data-act="mfok"'+sav+'>'+(m.busy?t('ag_busy'):t(m.dlg==='pub'?'mf_pubb':'mf_reactb'))+'</button></div>')}
 return adm(h+px)};
ACTS.mfsim=function(b,v){var m=S.mf;m.ph='ok';m.dlg=null;m.msg='';m.vs=v==='empty'?[]:mfMk();render();pfFoc('mf-h')};
ACTS.mfform=function(){var m=S.mf;m.form=!m.form;m.err='';m.txt=m.form?m.txt:'';render();pfFoc(m.form?'mf-note':'mf-nb')};
ACTS.mfread=function(b,v){var m=S.mf;m.open=m.open===v?null:v;render();var e=document.querySelector('[data-act="mfread"][data-v="'+v+'"]');if(e)e.focus()};
ACTS.mfpub=function(){var m=S.mf;m.err='';if(m.txt.trim().length<50){m.err='mf_e_txt';render();pfFoc('mf-er');return}m.dlg='pub';m.back='mf-pb';render();pfFoc('mf-dx')};
ACTS.mfdlg=function(b,v){var m=S.mf;m.dlg=v;m.vn=b.getAttribute('data-n');m.err='';m.back='';render();pfFoc('mf-dx')};
ACTS.mfx=function(){var m=S.mf;if(m.busy)return;m.dlg=null;m.err='';render();pfFoc(m.back||'mf-h')};
ACTS.mfok=function(){var m=S.mf;if(m.busy)return;m.busy=true;m.err='';render();setTimeout(function(){m.busy=false;
 if(S.mode!=='ok'){m.err=m.dlg==='pub'?'mf_e_pub':'mf_e_react';render();pfFoc('mf-er2');return}
 if(m.dlg==='pub'){m.vs.forEach(function(x){x.act=false});var nv='v1.'+(m.vs.length+1);m.vs.unshift({v:nv,act:true,note:'',by:t('ad_who'),at:new Date().toISOString().slice(0,10),txt:'mf_ex1'});m.msg=t('mf_ok_pub',{v:nv});m.form=false;m.txt='';m.note=''}
 else{m.vs.forEach(function(x){x.act=x.v===m.vn});m.msg=t('mf_ok_react',{v:m.vn})}
 m.dlg=null;render();pfFoc('mf-ms')},600)};
