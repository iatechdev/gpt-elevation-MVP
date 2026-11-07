/* /app/skill-map y /app/dashboard · «Mapa» completo (ES-29, ES-86, ES-116, ES-117).
   Añade al mapa de relieve lo que la pantalla real ya hace: vista de lista por territorios, autoevaluación y revisión humana por separado,
   confianza, criterios del catálogo, registrar / cambiar / retirar el nivel, análisis con IA en tres pasos, revocar todo y actualizar.
   Decisión de diseño pendiente de PO: el radar se reemplaza por el relieve y un resumen («puntos más fuertes» y «un punto donde mejorar»).
   Los territorios son los reales del código; los criterios de nivel, las justificaciones y las propuestas de la IA son EJEMPLOS. */
copy({
 mp_by:'Registrado por ti con {k}.',mp_h:'Tu mapa de capacidades',mp_intro:'Territorios laborales donde tus capacidades tienen impacto. Solo cruza lo que tú autorizas.',
 mp_read:'El nivel no certifica: muestra qué evidencia hay hoy. Lo que aún no evaluaste queda plano, no en cero.',
 mp_cat:'Versión del catálogo: {v}',mp_views:'Vista del mapa',mp_v1:'Relieve',mp_v2:'Lista',mp_v3:'Radar',mp_rad_alt:'Radar de capacidades: un eje por capacidad, del nivel 1 al 4. Los niveles están también en la tabla de abajo.',mp_rad_p:'Cada eje es una capacidad y el anillo exterior es el nivel 4. Una capacidad sin punto no tiene nivel con evidencia: no es un cero.',mp_rad_gap:'{n} capacidades sin nivel todavía. Se unen solo los puntos vecinos que sí tienen nivel.',mp_rad_no:'Sin nivel',mp_rad_tb:'Ver los niveles como tabla',mp_rad_c:'Capacidad',mp_rad_l:'Nivel',
 mp_ai:'Analizar mi evidencia con IA',mp_ref:'Actualizar mapa',mp_rev:'Revocar todos',mp_loading:'Cargando tu mapa…',mp_upd:'Mapa actualizado.',
 mp_e_load:'No pudimos cargar tu mapa.',mp_e_unav:'Tu mapa aún no está disponible.',mp_retry:'Reintentar',
 mp_s_t:'Tus puntos más fuertes',mp_s_few:'Tus puntos más fuertes (por ahora)',mp_s_only:'Por ahora solo hay evidencia suficiente para {n} capacidades; no se rellena con otras.',
 mp_imp:'Un punto donde puedes mejorar',mp_to:'Para pasar al nivel {n}:',mp_top:'Ya tienes el nivel máximo en tus capacidades con nivel: no hay un siguiente nivel que proponer.',
 mp_se_t:'Todavía no hay evidencia suficiente',mp_se_p:'Un nivel necesita evidencia que tú confirmaste. Cuando la tengas, aquí verás tus puntos más fuertes y un criterio para subir de nivel.',
 mp_g_t:'Todavía no hay nivel en ninguna capacidad',mp_g_p:'Un nivel necesita evidencia: algo que hiciste, con su situación, tu parte y lo que entregaste. Mientras no la haya, el mapa muestra «Sin evidencia vigente»; no es un déficit.',
 mp_g1:'Empieza en «Evidencias» y cuenta una experiencia real.',mp_g2:'Confírmala: solo lo que tú confirmas cuenta.',mp_g3:'Vuelve aquí y pulsa «Registrar mi nivel» en una capacidad.',mp_g_cta:'Ir a Evidencias',
 mp_leg:'Leyenda',mp_l1:'Con evidencia',mp_l2:'Sin evidencia vigente',
 mp_detail:'Capacidad',mp_type:'Transversal',mp_terr:'Territorios: {l}',mp_unas:'Sin territorio asignado',mp_unas_p:'Todavía no se ha definido a qué territorio pertenece cada una de estas capacidades.',
 mp_st_ev:'Con evidencia',mp_st_rev:'Conviene revisar',mp_st_stale:'Desactualizado',mp_st_none:'Sin evidencia vigente',
 mp_self:'Autoevaluación',mp_review:'Revisión humana',mp_norev:'Sin revisión humana',mp_init:'Inicial',
 mp_evn:'Evidencias referenciadas: {n}',mp_conf:'Confianza del respaldo: {c}',mp_c_low:'Baja',mp_c_med:'Media',mp_c_hi:'Alta',
 mp_cw3:'Pocas evidencias vigentes y de una sola situación.',mp_cw6:'Una sola evidencia vigente.',mp_cwx:'Pocas evidencias vigentes.',
 mp_why_t:'Justificación',mp_why_none:'Sin justificación disponible',mp_why3:'Cuentas lo ocurrido antes de que te lo pidan y el turno siguiente sabe en qué punto está todo.',mp_why6:'Armaste un plan de contingencia cuando falló el proveedor.',
 mp_ai_tag:'Propuesta por la IA y confirmada por ti',mp_f6:'Armé el plan de contingencia cuando falló el proveedor.',
 mp_stale_h:'La evidencia que respaldaba este resultado ya no está vigente.',
 mp_rev_why:'Tu nivel difiere en dos o más de la autonomía que declaraste en la evidencia. Es una regla automática: no la revisa una persona.',
 mp_next:'Siguiente paso',mp_n_empty:'Confirma evidencias profesionales para disponer de un nivel.',mp_n_cur:'Consulta los criterios y reúne nuevas evidencias si quieres revisar tu nivel.',mp_n_stale:'Este resultado necesita una nueva evaluación con evidencia vigente.',mp_n_rev:'Revisa si tu evidencia respalda este nivel; puedes cambiar el nivel o agregar evidencia.',
 mp_reg:'Registrar mi nivel',mp_chg:'Cambiar mi nivel',mp_ret:'Retirar mi nivel',mp_ai1:'Pedir propuesta de la IA para esta capacidad',
 mp_rub:'Ver criterios del catálogo vigente · {v}',mp_rub_ex:'Criterios de ejemplo: los reales salen del catálogo.',mp_lvn:'Nivel {n}: ',
 mp_r1:'Lo hice con indicaciones claras y revisión de otra persona.',mp_r2:'Lo hice por mi cuenta en situaciones conocidas.',mp_r3:'Lo hice en situaciones nuevas y expliqué cómo decidí.',mp_r4:'Lo hice en situaciones complejas y ayudé a otras personas a hacerlo.',
 mp_rg_h:'Registrar mi nivel',mp_rg_i:'Tu nivel es tu valoración, respaldada por tu evidencia: no certifica. Solo cuenta lo que tú confirmas.',
 mp_rg_1:'1 · Elige la evidencia que respalda tu nivel (de 1 a 8)',mp_rg_2:'2 · ¿Qué nivel describe mejor lo que hiciste?',mp_rg_3:'3 · Una nota (opcional, hasta 500 caracteres)',
 mp_rg_w:'Si más adelante editas o borras la evidencia que citas, tu nivel dejará de mostrarse hasta que lo registres de nuevo.',
 mp_rg_save:'Guardar mi nivel',mp_rg_ing:'Guardando…',mp_x:'Cancelar',mp_rg_ev:'Confirmada · {d}',
 mp_rg_none_t:'Primero necesitas una evidencia confirmada',mp_rg_none_p:'Un nivel se apoya en algo que hiciste: su situación, tu parte y lo que entregaste. Cuéntalo en «Evidencias» y confírmalo.',mp_rg_see:'Ir a Evidencias',
 mp_rg_inv:'Elige de 1 a 8 evidencias confirmadas y un nivel.',mp_rg_unc:'No pudimos confirmar el resultado. Recarga para ver el estado real antes de reintentar.',mp_saved:'Nivel guardado.',mp_retired:'Nivel retirado.',
 mp_rt_t:'¿Retirar tu nivel?',mp_rt_p:'Tu nivel se retira y la capacidad vuelve a «Sin evaluar». Tu evidencia no se borra.',mp_rt_ok:'Sí, retirar',
 mp_rv_t:'¿Revocar todos los permisos?',mp_rv_p:'Se retirará tu permiso para el recorrido profesional: lo que habías autorizado dejará de cruzar. Puedes autorizar de nuevo más adelante.',
 mp_rv_ok:'Sí, revocar',mp_rv_ing:'Revocando…',mp_rv_done:'Listo: ya no cruza nada hacia el recorrido profesional.',mp_rv_err:'No pudimos revocar. Inténtalo de nuevo.',mp_rv_none:'No hay nada autorizado para el recorrido profesional.',
 mp_rv_scope:'Hoy el permiso se revoca para todas las capacidades a la vez; el permiso por capacidad aún no está disponible.',
 mp_ex_note:'Ejemplo de contenido',mp_proto:'Prototipo:',mp_p_noev:'ver cuando no hay evidencia confirmada',mp_p_exp:'ver cuando la propuesta venció',mp_p_chg:'ver cuando una evidencia cambió',mp_p_back:'volver al flujo normal',
 ai_h:'Analizar mi evidencia con IA',ai_steps:'Pasos',ai_s1:'Elegir capacidades',ai_s2:'Analizar',ai_s3:'Revisar',
 ai_p:'La IA lee solo las evidencias que ya confirmaste y propone un nivel por capacidad, con su razón. Tú decides. Lo que no tenga evidencia no cambia.',
 ai_pick:'Elige hasta {m} capacidades para analizar',ai_sel:'{n} seleccionadas de {m}',ai_sel1:'1 seleccionada de {m}',
 ai_priv:'La IA solo ve tus evidencias confirmadas y la rúbrica del catálogo. No ve tu diario, tu ánimo ni tus conversaciones. El texto de tus evidencias se envía al proveedor de IA como en la conversación. Cada análisis usa tu cupo de análisis.',
 ai_go:'Analizar',ai_ing:'Analizando tu evidencia… puede tardar unos segundos.',
 ai_rt:'Propuestas de la IA',ai_rp:'Revisa cada una. Puedes aceptarla, bajarla de nivel, dejarla sin evaluar o no guardarla. No puedes subirla.',
 ai_tag:'Propuesta de la IA · tú decides',ai_lvp:'Nivel propuesto',ai_crit:'Criterio de ese nivel',ai_why:'Razón de la IA',ai_cit:'Evidencia citada',ai_crule:'La calcula el sistema con reglas; no la decide la IA.',
 ai_wcap:'La IA vio más, pero la autonomía que declaraste en esa evidencia es menor: el nivel se limitó a {n}.',ai_wnone:'No declaraste autonomía en la evidencia citada, así que el nivel no tiene tope. Revisa que la evidencia lo respalde.',
 ai_nt:'La evidencia aún no alcanza para un nivel',ai_np:'La IA no propone un nivel aquí. Solo puedes no guardar.',ai_npc:'La IA no propone un nivel aquí. Puedes no guardar o retirar tu nivel actual.',
 ai_do:'¿Qué hago con esta propuesta?',ai_acc:'Aceptar nivel {n}',ai_dn:'Bajar a nivel {n}',ai_un:'Dejar sin evaluar (retira mi nivel actual, si lo hay)',ai_rt1:'Retirar mi nivel actual',ai_sk:'No guardar',
 ai_exp:'Esta propuesta vence en 10 minutos.',ai_sv:'Se guardarán {n} y no se tocará el resto.',ai_sv0:'No se guardará nada por ahora.',ai_save:'Guardar las aceptadas',ai_saving:'Guardando…',
 ai_dt:'Guardado',ai_dp:'Guardaste {n} capacidades como «propuestas por la IA y confirmadas por ti». El relieve ya las muestra.',ai_dp1:'Guardaste 1 capacidad como «propuesta por la IA y confirmada por ti». El relieve ya la muestra.',ai_dp0:'No guardaste ningún cambio. Tu mapa sigue igual.',
 ai_help:'«Conviene revisar» aparece cuando el nivel que guardaste difiere en dos o más de la autonomía que declaraste en la evidencia. No lo decide una persona ni la IA: es una regla.',
 ai_see:'Ver el mapa',ai_again:'Analizar otras',ai_close:'Cerrar',ai_ne_t:'Primero necesitas una evidencia confirmada',ai_ne_p:'La IA solo propone a partir de evidencias que tú confirmaste. Cuenta una situación real y confírmala.',
 ai_e_budget:'Llegaste al límite de análisis de este periodo. Podrás volver a intentarlo más adelante.',ai_e_prov:'No se pudo completar el análisis. No se guardó nada. Inténtalo de nuevo.',
 ai_e_exp:'La propuesta venció (10 minutos). Pide una nueva; no se guardó nada.',ai_e_chg:'Una de tus evidencias cambió mientras revisabas. No se guardó nada: pide una propuesta nueva.',
 ai_e_unc:'No hubo respuesta. Puede que no se haya guardado: inténtalo de nuevo, no se duplicará.',ai_retry:'Intentar de nuevo',ai_new:'Pedir una propuesta nueva',
 ai_w3:'Cuentas lo ocurrido antes de que te lo pidan.',ai_w5:'Reordenas la entrega cuando cambia la situación.',ai_w7:'Avisas a tu equipo para que todos sepan cómo van.',
 routes:{inicio:'Mapa'}
},{
 mp_by:'Recorded by you with {k}.',mp_h:'Your skills map',mp_intro:'Work territories where your skills have impact. Only what you authorize crosses.',
 mp_read:'The level does not certify: it shows what evidence exists today. What you have not assessed yet stays flat, not at zero.',
 mp_cat:'Catalog version: {v}',mp_views:'Map view',mp_v1:'Relief',mp_v2:'List',mp_v3:'Radar',mp_rad_alt:'Capability radar: one axis per capability, from level 1 to 4. The levels are also in the table below.',mp_rad_p:'Each axis is a capability and the outer ring is level 4. A capability with no point has no level backed by evidence: it is not a zero.',mp_rad_gap:'{n} capabilities have no level yet. Only neighbouring points that do have a level are joined.',mp_rad_no:'No level',mp_rad_tb:'See the levels as a table',mp_rad_c:'Capability',mp_rad_l:'Level',
 mp_ai:'Analyze my evidence with AI',mp_ref:'Refresh map',mp_rev:'Revoke all',mp_loading:'Loading your map…',mp_upd:'Map updated.',
 mp_e_load:'We could not load your map.',mp_e_unav:'Your map is not available yet.',mp_retry:'Retry',
 mp_s_t:'Your strongest points',mp_s_few:'Your strongest points (so far)',mp_s_only:'So far there is enough evidence for only {n} skills; it is not filled in with others.',
 mp_imp:'One point where you can improve',mp_to:'To reach level {n}:',mp_top:'You already have the top level in your skills that have a level: there is no next level to suggest.',
 mp_se_t:'There is not enough evidence yet',mp_se_p:'A level needs evidence you confirmed. Once you have it, you will see your strongest points here and a criterion to move up a level.',
 mp_g_t:'No skill has a level yet',mp_g_p:'A level needs evidence: something you did, with its situation, your part and what you delivered. Until there is some, the map shows “No current evidence”; it is not a deficit.',
 mp_g1:'Start in “Evidence” and tell a real experience.',mp_g2:'Confirm it: only what you confirm counts.',mp_g3:'Come back here and press “Record my level” on a skill.',mp_g_cta:'Go to Evidence',
 mp_leg:'Legend',mp_l1:'With evidence',mp_l2:'No current evidence',
 mp_detail:'Skill',mp_type:'Transversal',mp_terr:'Territories: {l}',mp_unas:'No territory assigned',mp_unas_p:'It has not been defined yet which territory each of these skills belongs to.',
 mp_st_ev:'With evidence',mp_st_rev:'Worth reviewing',mp_st_stale:'Out of date',mp_st_none:'No current evidence',
 mp_self:'Self-assessment',mp_review:'Human review',mp_norev:'No human review',mp_init:'Initial',
 mp_evn:'Evidence referenced: {n}',mp_conf:'Confidence of the support: {c}',mp_c_low:'Low',mp_c_med:'Medium',mp_c_hi:'High',
 mp_cw3:'Few current pieces of evidence, all from one situation.',mp_cw6:'Only one current piece of evidence.',mp_cwx:'Few current pieces of evidence.',
 mp_why_t:'Rationale',mp_why_none:'No rationale available',mp_why3:'You explain what happened before you are asked, and the next shift knows where everything stands.',mp_why6:'You built a contingency plan when the supplier failed.',
 mp_ai_tag:'Proposed by the AI and confirmed by you',mp_f6:'I built the contingency plan when the supplier failed.',
 mp_stale_h:'The evidence that backed this result is no longer current.',
 mp_rev_why:'Your level differs by two or more from the autonomy you declared in the evidence. It is an automatic rule: a person does not review it.',
 mp_next:'Next step',mp_n_empty:'Confirm professional evidence to have a level.',mp_n_cur:'Check the criteria and gather new evidence if you want to review your level.',mp_n_stale:'This result needs a new assessment with current evidence.',mp_n_rev:'Check whether your evidence supports this level; you can change the level or add evidence.',
 mp_reg:'Record my level',mp_chg:'Change my level',mp_ret:'Withdraw my level',mp_ai1:'Ask the AI for a proposal for this skill',
 mp_rub:'See the criteria of the current catalog · {v}',mp_rub_ex:'Sample criteria: the real ones come from the catalog.',mp_lvn:'Level {n}: ',
 mp_r1:'I did it with clear instructions and another person’s review.',mp_r2:'I did it on my own in familiar situations.',mp_r3:'I did it in new situations and explained how I decided.',mp_r4:'I did it in complex situations and helped others do it.',
 mp_rg_h:'Record my level',mp_rg_i:'Your level is your own assessment, backed by your evidence: it does not certify. Only what you confirm counts.',
 mp_rg_1:'1 · Choose the evidence that backs your level (1 to 8)',mp_rg_2:'2 · Which level best describes what you did?',mp_rg_3:'3 · A note (optional, up to 500 characters)',
 mp_rg_w:'If you later edit or delete the evidence you cite, your level will stop showing until you record it again.',
 mp_rg_save:'Save my level',mp_rg_ing:'Saving…',mp_x:'Cancel',mp_rg_ev:'Confirmed · {d}',
 mp_rg_none_t:'First you need a confirmed piece of evidence',mp_rg_none_p:'A level rests on something you did: its situation, your part and what you delivered. Tell it in “Evidence” and confirm it.',mp_rg_see:'Go to Evidence',
 mp_rg_inv:'Choose 1 to 8 confirmed pieces of evidence and a level.',mp_rg_unc:'We could not confirm the result. Reload to see the real state before trying again.',mp_saved:'Level saved.',mp_retired:'Level withdrawn.',
 mp_rt_t:'Withdraw your level?',mp_rt_p:'Your level is withdrawn and the skill goes back to “Not assessed”. Your evidence is not deleted.',mp_rt_ok:'Yes, withdraw',
 mp_rv_t:'Revoke all permissions?',mp_rv_p:'Your permission for the professional path will be withdrawn: what you had authorized will stop crossing. You can authorize again later.',
 mp_rv_ok:'Yes, revoke',mp_rv_ing:'Revoking…',mp_rv_done:'Done: nothing crosses to the professional path anymore.',mp_rv_err:'We could not revoke. Try again.',mp_rv_none:'Nothing is authorized for the professional path.',
 mp_rv_scope:'Today the permission is revoked for all skills at once; per-skill permission is not available yet.',
 mp_ex_note:'Sample content',mp_proto:'Prototype:',mp_p_noev:'see when there is no confirmed evidence',mp_p_exp:'see when the proposal expired',mp_p_chg:'see when a piece of evidence changed',mp_p_back:'back to the normal flow',
 ai_h:'Analyze my evidence with AI',ai_steps:'Steps',ai_s1:'Choose skills',ai_s2:'Analyze',ai_s3:'Review',
 ai_p:'The AI reads only the evidence you already confirmed and proposes one level per skill, with its reason. You decide. What has no evidence does not change.',
 ai_pick:'Choose up to {m} skills to analyze',ai_sel:'{n} selected of {m}',ai_sel1:'1 selected of {m}',
 ai_priv:'The AI only sees your confirmed evidence and the catalog rubric. It does not see your diary, your mood or your conversations. The text of your evidence is sent to the AI provider as in the conversation. Each analysis uses your analysis quota.',
 ai_go:'Analyze',ai_ing:'Analyzing your evidence… it may take a few seconds.',
 ai_rt:'AI proposals',ai_rp:'Review each one. You can accept it, lower its level, leave it not assessed or not save it. You cannot raise it.',
 ai_tag:'AI proposal · you decide',ai_lvp:'Proposed level',ai_crit:'Criterion of that level',ai_why:'The AI’s reason',ai_cit:'Cited evidence',ai_crule:'The system calculates it with rules; the AI does not decide it.',
 ai_wcap:'The AI saw more, but the autonomy you declared in that evidence is lower: the level was capped at {n}.',ai_wnone:'You did not declare autonomy in the cited evidence, so the level has no cap. Check that the evidence supports it.',
 ai_nt:'The evidence is not enough for a level yet',ai_np:'The AI does not propose a level here. You can only not save.',ai_npc:'The AI does not propose a level here. You can not save, or withdraw your current level.',
 ai_do:'What do I do with this proposal?',ai_acc:'Accept level {n}',ai_dn:'Lower to level {n}',ai_un:'Leave not assessed (withdraws my current level, if any)',ai_rt1:'Withdraw my current level',ai_sk:'Do not save',
 ai_exp:'This proposal expires in 10 minutes.',ai_sv:'{n} will be saved and the rest will not be touched.',ai_sv0:'Nothing will be saved for now.',ai_save:'Save the accepted ones',ai_saving:'Saving…',
 ai_dt:'Saved',ai_dp:'You saved {n} skills as “proposed by the AI and confirmed by you”. The relief already shows them.',ai_dp1:'You saved 1 skill as “proposed by the AI and confirmed by you”. The relief already shows it.',ai_dp0:'You saved no changes. Your map stays the same.',
 ai_help:'“Worth reviewing” appears when the level you saved differs by two or more from the autonomy you declared in the evidence. Neither a person nor the AI decides it: it is a rule.',
 ai_see:'See the map',ai_again:'Analyze others',ai_close:'Close',ai_ne_t:'First you need a confirmed piece of evidence',ai_ne_p:'The AI only proposes from evidence you confirmed. Tell a real situation and confirm it.',
 ai_e_budget:'You reached the analysis limit for this period. You can try again later.',ai_e_prov:'The analysis could not be completed. Nothing was saved. Try again.',
 ai_e_exp:'The proposal expired (10 minutes). Ask for a new one; nothing was saved.',ai_e_chg:'One of your pieces of evidence changed while you were reviewing. Nothing was saved: ask for a new proposal.',
 ai_e_unc:'There was no response. It may not have been saved: try again, it will not be duplicated.',ai_retry:'Try again',ai_new:'Ask for a new proposal',
 ai_w3:'You explain what happened before you are asked.',ai_w5:'You reorder the delivery when the situation changes.',ai_w7:'You tell your team so everyone knows where things stand.',
 routes:{inicio:'Map'}
});
/* territorios reales del código (frontend/src/skill-map/territories.ts) */
var TERR=[{id:'dir',es:'Dirección & Liderazgo',en:'Leadership & Management',r:'Director General · COO · Head of'},{id:'con',es:'Consultoría Estratégica',en:'Strategy Consulting',r:'Strategy Consultant · Change Manager'},{id:'com',es:'Comunicación Ejecutiva',en:'Executive Communication',r:'Chief of Staff · PR Director · Portavoz'},{id:'ing',es:'Ingeniería & Sistemas',en:'Engineering & Systems',r:'Solutions Architect · Tech Lead · CTO'},{id:'inn',es:'Innovación & Producto',en:'Innovation & Product',r:'Product Manager · CPO · Innovation Lead'}];
var MD={0:{t:['ing','inn'],stale:true},1:{t:['con']},2:{t:[]},3:{t:['com','dir'],conf:'low',cw:'mp_cw3',why:'mp_why3'},4:{t:['dir']},5:{t:['dir','con']},6:{t:['con','inn'],conf:'low',cw:'mp_cw6',why:'mp_why6',rv:true},7:{t:['dir']}};
var AIP={3:{lv:2,warn:'cap',cap:2,q:'fr1',conf:'med',w:'ai_w3'},5:{lv:2,warn:'',q:'q1',conf:'low',w:'ai_w5'},7:{lv:1,warn:'none',q:'q2',conf:'low',w:'ai_w7'}};
P[6].lv=3;P[6].fr=['mp_f6'];P[6].h=P[6].th=.75;
var EXEV=[{k:'fr1',d:'12/10'},{k:'fr2',d:'14/10'},{k:'mp_f6',d:'20/10'}];
S.mp={view:'rel',dlg:null,dlgId:null,busy:null,note:'',err:null,loading:false,reg:null,ai:null,bridge:'granted',noev:false,cat:3};
addRoutes('g_per',['inicio']);
function mpStat(i){var p=P[i],md=MD[i];return p.lv?(md.rv?'rev':'ev'):(md.stale?'stale':'none')}
function mpStatT(s){return t({ev:'mp_st_ev',rev:'mp_st_rev',stale:'mp_st_stale',none:'mp_st_none'}[s])}
function mpTerrs(i){return MD[i].t.map(function(x){return TERR.filter(function(g){return g.id===x})[0][S.lang]}).join(' · ')}
function mpFoc(id){setTimeout(function(){var e=document.getElementById(id);if(e)e.focus()},0)}
function mpScroll(id){setTimeout(function(){var e=document.getElementById(id);if(e)e.scrollIntoView({block:'nearest'})},0)}
function mpConf(c){return t(c==='hi'?'mp_c_hi':c==='med'?'mp_c_med':'mp_c_low')}
function mpAnyLevel(){return P.some(function(p){return p.lv})}
/* ---------- piezas ---------- */
function mpGuide(){return'<section class="card tint" aria-labelledby="gdt" style="margin:1rem 0"><h2 id="gdt" style="font-size:1.4rem">'+t('mp_g_t')+'</h2><p>'+t('mp_g_p')+'</p><ol class="small" style="padding-left:1.2rem;margin:.4rem 0"><li>'+t('mp_g1')+'</li><li>'+t('mp_g2')+'</li><li>'+t('mp_g3')+'</li></ol><div class="row"><a class="btn" href="#evidencias">'+t('mp_g_cta')+'</a></div></section>'}
function mpSummary(){var w=P.filter(function(p){return p.lv}).sort(function(a,b){return b.lv-a.lv}).slice(0,3);
  if(!w.length)return'<section class="card" aria-labelledby="sst" style="margin:1rem 0"><h2 id="sst" style="font-size:1.4rem">'+t('mp_se_t')+'</h2><p style="margin:.3rem 0 0">'+t('mp_se_p')+'</p></section>';
  var low=P.filter(function(p){return p.lv&&p.lv<4}).sort(function(a,b){return a.lv-b.lv})[0];
  return'<div class="sum"><section class="card" aria-labelledby="sst"><h2 id="sst" style="font-size:1.25rem">'+t(w.length<3?'mp_s_few':'mp_s_t')+'</h2><ul class="sl">'+w.map(function(p){return'<li><span class="nm2">'+esc(capName(p.id))+'</span>'+ticks(p.lv)+'</li>'}).join('')+'</ul>'+(w.length<3?'<p class="small muted" style="margin:.4rem 0 0">'+t('mp_s_only',{n:w.length})+'</p>':'')+'</section>'+
   '<section class="card" aria-labelledby="sit"><h2 id="sit" style="font-size:1.25rem">'+t('mp_imp')+'</h2>'+(low?'<p class="nm2" style="margin:.5rem 0 .2rem">'+esc(capName(low.id))+'</p><p class="small" style="margin:0"><b>'+t('mp_to',{n:low.lv+1})+'</b> '+t('mp_r'+(low.lv+1))+'</p><p class="small muted" style="margin:.3rem 0 0">'+t('mp_rub_ex')+'</p>':'<p style="margin:.5rem 0 0">'+t('mp_top')+'</p>')+'</section></div>'}
function mpList(){var m='';
  TERR.forEach(function(g){var ids=[0,1,2,3,4,5,6,7].filter(function(i){return MD[i].t.indexOf(g.id)>-1});
    m+='<section class="card tr" aria-labelledby="tg-'+g.id+'"><h3 id="tg-'+g.id+'">'+g[S.lang]+'</h3><p class="small muted" style="margin:.1rem 0 .4rem">'+g.r+'</p>'+(ids.length?'<ul class="pk">'+ids.map(mpItem).join('')+'</ul>':'<p class="small muted" style="margin:0">'+t('mp_st_none')+'</p>')+'</section>'});
  var un=[0,1,2,3,4,5,6,7].filter(function(i){return !MD[i].t.length});
  if(un.length)m+='<section class="card tr" aria-labelledby="tg-un"><h3 id="tg-un">'+t('mp_unas')+'</h3><p class="small muted" style="margin:.1rem 0 .4rem">'+t('mp_unas_p')+'</p><ul class="pk">'+un.map(mpItem).join('')+'</ul></section>';
  return'<div class="trs">'+m+'</div>'}
function mpItem(i){var s=mpStat(i),p=P[i];return'<li><button type="button" class="pickb" data-act="pick" data-v="'+i+'" aria-pressed="'+(S.selId===i)+'"><i class="dotm'+(p.lv?' f':'')+'" aria-hidden="true"></i><span><b class="nm2">'+esc(capName(i))+'</b><span class="small muted">'+mpStatT(s)+(p.lv?' · '+t('lv_of',{n:p.lv}):'')+'</span></span></button></li>'}
function mpRelief(){return'<div class="mapbox" id="mb"><canvas id="c-home" aria-hidden="true"></canvas>'+P.map(function(p){var st=p.lv?'s':(p.q&&!p.no&&!p.ok?'p':'n'),lab=capName(p.id)+': '+(p.lv?t('lv_of',{n:p.lv}):(p.q&&!p.no&&!p.ok?t('hint_chip'):mpStatT(mpStat(p.id))));
   return'<button type="button" class="place'+(p.x>.55?' r':'')+'" data-act="pick" data-v="'+p.id+'" style="left:'+(p.x*100)+'%;top:'+(p.y*100)+'%" aria-pressed="'+(S.selId===p.id)+'" aria-label="'+esc(lab)+'"><i class="sym '+st+'"></i><span class="lb">'+esc(capName(p.id))+'</span></button>'}).join('')+'</div>'+
   '<ul class="lg" aria-label="'+t('mp_leg')+'"><li><i class="dotm f" aria-hidden="true"></i>'+t('mp_l1')+'</li><li><i class="dotm" aria-hidden="true"></i>'+t('mp_l2')+'</li></ul>'+
   '<div class="title-block"><span><b>'+t('map_src')+'</b>'+t('map_src_v')+'</span><span><b>'+t('map_rev')+'</b>'+t('map_rev_v')+'</span><span><b>'+t('map_sc')+'</b>'+t('map_sc_v')+'</span></div>'}
/* ---------- radar (vista adicional; decisión 1 resuelta) ---------- */
function mpRadar(){var n=P.length,cx=250,cy=200,R=120,LR=134,pts=[],lab='';
  function pt(i,r){var a=-Math.PI/2+i*2*Math.PI/n;return[cx+r*Math.cos(a),cy+r*Math.sin(a)]}
  var g='';[1,2,3,4].forEach(function(l){var d=P.map(function(p,i){var q=pt(i,R*l/4);return(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)}).join('')+'Z';g+='<path d="'+d+'" class="rg'+(l===4?' out':'')+'"/>'});
  P.forEach(function(p,i){var q=pt(i,R);g+='<line x1="'+cx+'" y1="'+cy+'" x2="'+q[0].toFixed(1)+'" y2="'+q[1].toFixed(1)+'" class="rx"/>'});
  [1,2,3,4].forEach(function(l){g+='<text x="'+(cx+4)+'" y="'+(cy-R*l/4-3)+'" class="rt">'+l+'</text>'});
  var all=P.every(function(p){return p.lv}),d='',dots='';
  P.forEach(function(p,i){var j=(i+1)%n;if(p.lv){var a=pt(i,R*p.lv/4);dots+='<circle cx="'+a[0].toFixed(1)+'" cy="'+a[1].toFixed(1)+'" r="5" class="rd"/>';if(P[j].lv&&(all||j>i)){var b=pt(j,R*P[j].lv/4);d+='M'+a[0].toFixed(1)+' '+a[1].toFixed(1)+'L'+b[0].toFixed(1)+' '+b[1].toFixed(1)}}});
  var shape=all?'<path d="'+P.map(function(p,i){var q=pt(i,R*p.lv/4);return(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)}).join('')+'Z" class="rf"/>':'';
  P.forEach(function(p,i){var q=pt(i,LR),st=p.lv?t('lv_of',{n:p.lv}):t('mp_rad_no'),co=Math.cos(-Math.PI/2+i*2*Math.PI/n),si=Math.sin(-Math.PI/2+i*2*Math.PI/n),
      tx=co>.3?'0':co<-.3?'-100%':'-50%',ty=Math.abs(co)>.3?'-50%':(si<0?'-100%':'0'),ta=co>.3?'left':co<-.3?'right':'center';
    lab+='<button type="button" class="rax" data-act="pick" data-v="'+p.id+'" style="left:'+(q[0]/5)+'%;top:'+(q[1]/4)+'%;transform:translate('+tx+','+ty+');text-align:'+ta+'" aria-pressed="'+(S.selId===p.id)+'"><b>'+esc(capName(p.id))+'</b><span>'+st+'</span></button>'});
  var nolv=P.filter(function(p){return !p.lv}).length;
  return'<div class="radar" id="rd"><svg viewBox="0 0 500 400" role="img" aria-label="'+t('mp_rad_alt')+'">'+g+shape+'<path d="'+d+'" class="rl"/>'+dots+'</svg>'+lab+'</div>'+
   '<p class="small muted" style="margin:.5rem 0">'+t('mp_rad_p')+'</p>'+(nolv?'<p class="small" style="margin:.2rem 0">'+t('mp_rad_gap',{n:nolv})+'</p>':'')+
   '<details class="rub"><summary>'+t('mp_rad_tb')+'</summary><table class="tbl"><thead><tr><th scope="col">'+t('mp_rad_c')+'</th><th scope="col">'+t('mp_rad_l')+'</th></tr></thead><tbody>'+P.map(function(p){return'<tr><th scope="row">'+esc(capName(p.id))+'</th><td>'+(p.lv?t('lv_of',{n:p.lv}):t('mp_rad_no'))+'</td></tr>'}).join('')+'</tbody></table></details>'}
function mpUnassigned(){var un=[0,1,2,3,4,5,6,7].filter(function(i){return !MD[i].t.length});if(!un.length)return'';
  return'<section class="card tr" aria-labelledby="tg-un" style="margin-top:1rem"><h3 id="tg-un">'+t('mp_unas')+'</h3><p class="small muted" style="margin:.1rem 0 .4rem">'+t('mp_unas_p')+'</p><ul class="pk">'+un.map(mpItem).join('')+'</ul></section>'}
/* ---------- detalle ---------- */
function mpTrack(i){var p=P[i],md=MD[i],s=mpStat(i),h='<section class="trk" aria-labelledby="tk-s"><h3 id="tk-s">'+t('mp_self')+'</h3>';
  if(p.lv){h+='<div class="rowx"><span>'+t('lv_of',{n:p.lv})+'</span>'+ticks(p.lv)+'</div><p class="small" style="margin:0">'+(md.ai?'<span class="chip ok">'+t('mp_ai_tag')+'</span>':t('mp_by',{k:(p.fr.length+(S.lang==='es'?(p.fr.length===1?' frase':' frases'):(p.fr.length===1?' phrase':' phrases')))}))+'</p><ul>'+p.fr.map(function(f){return'<li>'+esc(t(f))+'</li>'}).join('')+'</ul>'+
    '<p class="small" style="margin:.2rem 0">'+t('mp_evn',{n:p.fr.length})+'</p><p class="small" style="margin:.2rem 0">'+t('mp_conf',{c:mpConf(md.conf||'low')})+' <span class="muted">'+t(md.cw||'mp_cwx')+'</span></p><p class="small muted" style="margin:.1rem 0 .4rem">'+t('ai_crule')+'</p>'+
    '<h4 class="h4">'+t('mp_why_t')+'</h4><p class="small" style="margin:0 0 .4rem">'+(md.why?esc(t(md.why)):t('mp_why_none'))+'</p>';
    if(s==='rev')h+='<p class="note-b" data-testid="review-why">'+t('mp_rev_why')+'</p>'}
  else{h+='<p style="margin:.2rem 0"><b>'+t('mp_st_none')+'</b></p>';if(s==='stale')h+='<p class="note-b">'+t('mp_stale_h')+'</p>'}
  var nx=s==='stale'?'mp_n_stale':s==='rev'?'mp_n_rev':p.lv?'mp_n_cur':'mp_n_empty';
  h+='<p class="small" style="margin:.4rem 0 0"><b>'+t('mp_next')+':</b> '+t(nx)+'</p></section><section class="trk" aria-labelledby="tk-r"><h3 id="tk-r">'+t('mp_review')+'</h3><p class="small" style="margin:0">'+t('mp_norev')+'</p></section>';return h}
function mpRub(i){return'<details class="rub"><summary>'+t('mp_rub',{v:S.mp.cat})+'</summary><ol class="small">'+[1,2,3,4].map(function(n){return'<li><b>'+t('mp_lvn',{n:n})+'</b>'+t('mp_r'+n)+'</li>'}).join('')+'</ol><p class="small muted" style="margin:0">'+t('mp_rub_ex')+'</p></details>'}
function mpDetail(){var m=S.mp,i=S.selId,p=P[i];
  if(i===null||!p)return'<p class="tag">'+t('pick')+'</p><p class="nm">'+t('pick_h')+'</p><p style="margin:.6rem 0 0">'+t('pick_p')+'</p>';
  if(m.reg&&m.reg.id===i)return mpRegForm(i);
  var md=MD[i],s=mpStat(i),tr=mpTerrs(i),hint=(p.q&&!p.no&&!p.ok&&!p.lv)||(p.ok&&!p.lv);
  var h='<p class="tag">'+t('mp_detail')+'</p><h2 class="nm" id="dt" tabindex="-1">'+esc(capName(i))+'</h2><p class="small muted" style="margin:.3rem 0 .4rem">'+t('mp_type')+' · '+(tr?t('mp_terr',{l:tr}):t('mp_unas'))+'</p><p style="margin:0 0 .6rem"><span class="chip'+(s==='ev'?' ok':s==='rev'?' wait':'')+'">'+mpStatT(s)+'</span></p>';
  if(p.q&&!p.no&&!p.ok&&!p.lv)h+='<div class="pista"><p class="chip wait">'+t('hint_chip')+'</p><p>'+t('hint_base',{q:t(p.q)})+'</p><div class="row"><button class="lnk" data-act="ok">'+t('yes')+'</button><button class="lnk" data-act="nope">'+t('no')+'</button></div></div>';
  else if(p.ok&&!p.lv)h+='<p class="chip">'+t('noted')+'</p><p>'+t('noted_p')+'</p><fieldset class="fld" style="border:0;padding:0;margin:0"><legend>'+t('lv_lab')+'</legend><div class="opts">'+[1,2,3,4].map(function(n){return'<label><input type="radio" name="lv" value="'+n+'">'+n+'</label>'}).join('')+'</div></fieldset><p class="err" id="lve" role="alert" hidden>'+t('lv_pick')+'</p><div class="row"><button class="btn" data-act="save">'+t('lv_save')+'</button></div><p class="muted small">'+t('lv_help')+'</p>';
  h+=mpTrack(i);
  h+='<div class="row">'+(p.lv?'<button class="btn ghost" id="b-chg" data-act="mpreg">'+t('mp_chg')+'</button><button class="btn ghost" data-act="mpret" id="b-ret">'+t('mp_ret')+'</button>':(hint?'':'<button class="btn" id="b-reg" data-act="mpreg">'+t('mp_reg')+'</button>'))+'<button class="btn ghost" data-act="mpai" data-v="'+i+'">'+t('mp_ai1')+'</button></div>';
  if(p.lv)h+='<p class="muted small" style="margin:.2rem 0">'+t('lv_note')+'</p>';
  return h+mpRub(i)}
function mpRegForm(i){var r=S.mp.reg,p=P[i];
  if(S.mp.noev)return'<h2 class="nm" id="rg-h" tabindex="-1">'+t('mp_rg_none_t')+'</h2><p>'+t('mp_rg_none_p')+'</p><div class="row"><a class="btn" href="#evidencias">'+t('mp_rg_see')+'</a><button class="btn ghost" data-act="mprgx">'+t('mp_x')+'</button></div><p class="small muted">'+t('mp_proto')+' <button class="lnk" data-act="mpnoev">'+t('mp_p_back')+'</button></p>';
  return'<form id="f-rg" novalidate aria-labelledby="rg-h"><h2 class="nm" id="rg-h" tabindex="-1">'+t('mp_rg_h')+'</h2><p class="small" style="margin:.4rem 0">'+t('mp_rg_i')+'</p>'+
   '<fieldset class="fld pa"><legend>'+t('mp_rg_1')+'</legend>'+EXEV.map(function(e,k){return'<label class="check"><input type="checkbox" id="rg-e'+k+'" '+(r.ev[k]?'checked':'')+'><span><q class="qq">'+esc(t(e.k))+'</q> <span class="small muted">'+t('mp_rg_ev',{d:e.d})+' <span class="chip">'+t('ex')+'</span></span></span></label>'}).join('')+'</fieldset>'+
   '<fieldset class="fld pa"><legend>'+t('mp_rg_2')+'</legend><div class="rl">'+[1,2,3,4].map(function(n){return'<label class="check"><input type="radio" name="rglv" id="rg-l'+n+'" value="'+n+'" '+(r.lv===n?'checked':'')+'><span><b>'+t('mp_lvn',{n:n})+'</b>'+t('mp_r'+n)+'</span></label>'}).join('')+'</div><p class="small muted" style="margin:.2rem 0 0">'+t('mp_rub_ex')+'</p></fieldset>'+
   '<div class="fld"><label for="rg-n">'+t('mp_rg_3')+'</label><textarea id="rg-n" maxlength="500">'+esc(r.note||'')+'</textarea></div><p class="small muted">'+t('mp_rg_w')+'</p><p class="small muted">'+t('mp_proto')+' <button class="lnk" type="button" data-act="mpnoev">'+t('mp_p_noev')+'</button></p>'+
   '<p class="err" id="rg-err" role="alert" '+(r.err?'':'hidden')+'>'+(r.err==='unc'?t('mp_rg_unc'):t('mp_rg_inv'))+'</p>'+
   '<div class="row"><button class="btn" type="submit" '+(r.busy?'disabled':'')+'>'+(r.busy?t('mp_rg_ing'):t('mp_rg_save'))+'</button><button class="btn ghost" type="button" data-act="mprgx" '+(r.busy?'disabled':'')+'>'+t('mp_x')+'</button></div></form>'}
/* ---------- análisis con IA ---------- */
function mpAi(){var a=S.mp.ai;if(!a)return'';
  var st=a.step>3?3:a.step;
  var steps='<ol class="stepper" aria-label="'+t('ai_steps')+'">'+[1,2,3].map(function(n){return'<li'+(n<st||a.step>3?' class="d"':'')+(n===st&&a.step<=3?' aria-current="step"':'')+'>'+n+' · '+t('ai_s'+n)+'</li>'}).join('')+'</ol>';
  var h='<section class="card aip" id="ai-box" aria-labelledby="ai-h"><div class="row" style="justify-content:space-between;margin:0"><h2 id="ai-h" tabindex="-1" style="font-size:1.5rem">'+t('ai_h')+'</h2><button class="btn ghost" data-act="mpaix">'+t('ai_close')+'</button></div>'+steps;
  var errs={budget:'ai_e_budget',prov:'ai_e_prov',exp:'ai_e_exp',chg:'ai_e_chg',unc:'ai_e_unc'};
  if(a.err)h+='<div class="banner bad" role="alert"><b>'+t(errs[a.err])+'</b>'+((a.err==='exp'||a.err==='chg')?'<div class="row"><button class="btn" data-act="mpainew">'+t('ai_new')+'</button></div>':(a.err==='prov'?'<div class="row"><button class="btn" data-act="mpaigo">'+t('ai_retry')+'</button></div>':''))+'</div>';
  if(S.mp.noev)return h+'<h3>'+t('ai_ne_t')+'</h3><p>'+t('ai_ne_p')+'</p><div class="row"><a class="btn" href="#evidencias">'+t('mp_rg_see')+'</a></div><p class="small muted">'+t('mp_proto')+' <button class="lnk" data-act="mpnoev">'+t('mp_p_back')+'</button></p></section>';
  if(a.step===1){var n=a.sel.length;
    h+='<p>'+t('ai_p')+'</p><fieldset class="fld pa"><legend>'+t('ai_pick',{m:8})+'</legend><div class="aick">'+[0,1,2,3,4,5,6,7].map(function(i){return'<label class="check"><input type="checkbox" id="ai-k'+i+'" '+(a.sel.indexOf(i)>-1?'checked':'')+'><span>'+esc(capName(i))+(P[i].lv?' <span class="small muted">· '+t('lv_of',{n:P[i].lv})+'</span>':'')+'</span></label>'}).join('')+'</div></fieldset>'+
     '<p class="small" role="status" aria-live="polite" id="ai-n">'+(n===1?t('ai_sel1',{m:8}):t('ai_sel',{n:n,m:8}))+'</p><p class="small muted">'+t('ai_priv')+'</p><div class="row"><button class="btn" data-act="mpaigo" id="ai-go" '+(n?'':'disabled')+'>'+t('ai_go')+'</button></div><p class="small muted">'+t('mp_proto')+' <button class="lnk" data-act="mpnoev">'+t('mp_p_noev')+'</button></p>'}
  else if(a.step===2)h+='<div class="pulse" role="img" aria-label="'+t('ai_ing')+'"></div><p role="status">'+t('ai_ing')+'</p>';
  else if(a.step===3){var cnt=0;a.sel.forEach(function(i){if(mpDec(i))cnt++});
    h+='<h3 style="margin-bottom:.2rem">'+t('ai_rt')+' <span class="chip">'+t('mp_ex_note')+'</span></h3><p class="small" style="margin:0 0 .6rem">'+t('ai_rp')+'</p><p class="small muted">'+t('ai_exp')+'</p>'+a.sel.filter(function(i){return AIP[i]||P[i].lv}).map(mpProp).join('')+mpNoProp(a.sel.filter(function(i){return !AIP[i]&&!P[i].lv}))+
     '<p class="small" role="status" aria-live="polite" style="margin:.8rem 0 0">'+(cnt?t('ai_sv',{n:cnt}):t('ai_sv0'))+'</p><div class="row"><button class="btn" data-act="mpaisv" '+(cnt&&!a.saving?'':'disabled')+'>'+(a.saving?t('ai_saving'):t('ai_save'))+'</button><button class="btn ghost" data-act="mpaix" '+(a.saving?'disabled':'')+'>'+t('ai_close')+'</button></div>'+
     '<p class="small muted" style="margin-top:.8rem">'+t('mp_proto')+' <button class="lnk" data-act="mpsim" data-v="exp">'+t('mp_p_exp')+'</button> · <button class="lnk" data-act="mpsim" data-v="chg">'+t('mp_p_chg')+'</button></p>'}
  else h+='<h3 id="ai-dt" tabindex="-1">'+t('ai_dt')+'</h3><p role="status">'+(a.saved?t(a.saved===1?'ai_dp1':'ai_dp',{n:a.saved}):t('ai_dp0'))+'</p><p class="small muted">'+t('ai_help')+'</p><div class="row"><button class="btn" data-act="mpaiok">'+t('ai_see')+'</button><button class="btn ghost" data-act="mpainew">'+t('ai_again')+'</button></div>';
  return h+'</section>'}
function mpNoProp(ids){if(!ids.length)return'';return'<article class="arr1 prop" aria-labelledby="pp-none" style="padding:.9rem 1rem"><h4 id="pp-none" style="margin:0"><b>'+t('ai_nt')+'</b></h4><p class="small" style="margin:.2rem 0">'+ids.map(function(i){return esc(capName(i))}).join(' · ')+'</p><p class="small muted" style="margin:0">'+t('ai_np')+'</p></article>'}
function mpDec(i){var d=S.mp.ai.dec[i];return d&&d!=='skip'?d:null}
function mpProp(i){var a=S.mp.ai,pr=AIP[i],p=P[i],d=a.dec[i]||'skip',h='<article class="arr1 prop" aria-labelledby="pp'+i+'" style="padding:.9rem 1rem"><p class="tag" style="margin:0">'+t('ai_tag')+'</p><h4 class="nm2" id="pp'+i+'" style="font-size:1.5rem;margin:.2rem 0">'+esc(capName(i))+'</h4>';
  if(!pr){h+='<p><b>'+t('ai_nt')+'</b></p><p class="small" style="margin:0">'+t(p.lv?'ai_npc':'ai_np')+'</p><fieldset class="fld pa"><legend>'+t('ai_do')+'</legend>'+mpRad(i,'skip',t('ai_sk'),d)+(p.lv?mpRad(i,'un',t('ai_rt1'),d):'')+'</fieldset></article>';return h}
  h+='<div class="rowx"><span>'+t('ai_lvp')+': <b>'+pr.lv+'</b></span>'+ticks(pr.lv)+'</div><p class="small" style="margin:.1rem 0"><b>'+t('ai_crit')+':</b> '+t('mp_r'+pr.lv)+'</p><p class="small" style="margin:.1rem 0"><b>'+t('ai_why')+':</b> '+t(pr.w)+'</p><p class="small" style="margin:.1rem 0"><b>'+t('ai_cit')+':</b> <q class="qq">'+esc(t(pr.q))+'</q></p><p class="small" style="margin:.1rem 0"><b>'+t('mp_conf',{c:mpConf(pr.conf)})+'</b> <span class="muted">'+t('ai_crule')+'</span></p>';
  if(pr.warn==='cap')h+='<p class="note-b">'+t('ai_wcap',{n:pr.cap})+'</p>';if(pr.warn==='none')h+='<p class="note-b">'+t('ai_wnone')+'</p>';
  h+='<fieldset class="fld pa"><legend>'+t('ai_do')+'</legend>'+mpRad(i,'acc',t('ai_acc',{n:pr.lv}),d);
  for(var k=pr.lv-1;k>=1;k--)h+=mpRad(i,'dn'+k,t('ai_dn',{n:k}),d);
  return h+mpRad(i,'un',t('ai_un'),d)+mpRad(i,'skip',t('ai_sk'),d)+'</fieldset></article>'}
function mpRad(i,v,lab,cur){return'<label class="check"><input type="radio" name="aid'+i+'" id="aid'+i+'_'+v+'" value="'+v+'" '+(cur===v?'checked':'')+'><span>'+lab+'</span></label>'}
/* ---------- vista ---------- */
V.inicio=function(){var m=S.mp,h='';
  var rvOff=m.bridge!=='granted',msg=m.note==='done'?t('mp_rv_done'):m.note==='err'?t('mp_rv_err'):m.note==='upd'?t('mp_upd'):m.note==='saved'?t('mp_saved'):m.note==='retired'?t('mp_retired'):(rvOff?t('mp_rv_none'):'');
  h+='<main><div class="mph"><p class="tag">'+t('map_sheet')+' <span class="chip">'+t('ex')+'</span></p><h1 class="s" id="mt" tabindex="-1" style="margin:.2rem 0 .3rem">'+t('mp_h')+'</h1><p style="margin:0;max-width:42rem;font-size:1.1rem">'+t('mp_intro')+'</p><p class="muted small" style="margin:.4rem 0 0;max-width:42rem">'+t('mp_read')+'</p></div>';
  h+='<div class="mtools"><div class="seg" role="group" aria-label="'+t('mp_views')+'"><button type="button" aria-pressed="'+(m.view==='rel')+'" data-act="mpview" data-v="rel">'+t('mp_v1')+'</button><button type="button" aria-pressed="'+(m.view==='list')+'" data-act="mpview" data-v="list">'+t('mp_v2')+'</button><button type="button" aria-pressed="'+(m.view==='rad')+'" data-act="mpview" data-v="rad">'+t('mp_v3')+'</button></div>'+
   '<div class="row" style="margin:0"><button class="btn ghost" data-act="mpai" data-v="all">'+t('mp_ai')+'</button><button class="btn ghost" id="b-rv" data-act="mprv" '+(rvOff||m.busy==='rv'?'disabled':'')+'>'+t('mp_rev')+'</button><button class="btn ghost" data-act="mpref" '+(m.loading?'disabled':'')+'>'+t('mp_ref')+'</button></div></div>';
  h+='<p class="small muted" role="status" style="margin:.2rem 0">'+t('mp_cat',{v:m.cat})+' <span class="chip">'+t('ex')+'</span></p><p class="sps'+(m.note==='err'?' bad':'')+'" role="status" aria-live="polite">'+msg+'</p>';
  if(m.loading)return h+'<div class="pulse" role="img" aria-label="'+t('mp_loading')+'"></div><p role="status">'+t('mp_loading')+'</p></main>'+mpDialogs();
  if(m.err)return h+'<div class="banner bad" role="alert" id="mp-err" tabindex="-1"><b>'+t(m.err==='load'?'mp_e_load':'mp_e_unav')+'</b><div class="row"><button class="btn" data-act="mpref">'+t('mp_retry')+'</button></div></div></main>';
  if(!mpAnyLevel())h+=mpGuide();
  h+=mpSummary();
  h+='<div class="sheet"><section aria-label="'+t('mp_views')+'">'+(m.view==='rel'?mpRelief():m.view==='rad'?mpRadar():mpList())+(m.view==='rel'?mpUnassigned():'')+'</section><aside class="field" aria-live="polite" aria-label="'+t('mp_detail')+'">'+mpDetail()+'</aside></div>';
  h+=mpAi();
  h+='<p class="small muted" style="margin:1rem 0 1.5rem">'+t('mp_rv_scope')+'</p></main>'+mpDialogs();return h};
function mpDialogs(){var m=S.mp;if(!m.dlg)return'';var rv=m.dlg==='rv',b=m.busy;
  return'<div class="scrim"><div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlt" aria-describedby="dlp"><h2 id="dlt" style="font-size:1.4rem">'+t(rv?'mp_rv_t':'mp_rt_t')+'</h2><p id="dlp">'+t(rv?'mp_rv_p':'mp_rt_p')+'</p><div class="row"><button class="btn ghost" id="dlg-x" data-act="mpdx" '+(b?'disabled':'')+'>'+t('mp_x')+'</button><button class="btn danger" id="dlg-ok" data-act="mpdok" '+(b?'disabled':'')+'>'+(b?t('mp_rv_ing'):t(rv?'mp_rv_ok':'mp_rt_ok'))+'</button></div></div></div>'}
/* ---------- acciones ---------- */
ACTS.mpview=function(b,v){S.mp.view=v;render()};
ACTS.mpref=function(){var m=S.mp;m.loading=true;m.err=null;m.note='';render();setTimeout(function(){m.loading=false;if(S.mode==='offline')m.err='load';else if(S.mode==='limit')m.err='unav';else m.note='upd';render();if(m.err)mpFoc('mp-err')},600)};
ACTS.mprv=function(){S.mp.dlg='rv';S.mp.note='';render();mpFoc('dlg-x')};
ACTS.mpret=function(){S.mp.dlg='rt';S.mp.dlgId=S.selId;render();mpFoc('dlg-x')};
ACTS.mpdx=function(){var m=S.mp,rv=m.dlg==='rv';m.dlg=null;render();mpFoc(rv?'b-rv':'b-ret')};
ACTS.mpdok=function(){var m=S.mp;if(m.dlg==='rt'){var p=P[m.dlgId];p.lv=0;p.fr=[];p.ok=false;m.dlg=null;m.note='retired';render();raise(p,0);mpFoc('dt');return}
  m.busy='rv';render();setTimeout(function(){m.busy=null;m.dlg=null;if(S.mode==='ok'){m.bridge='revoked';m.note='done'}else m.note='err';render();mpFoc('mt')},700)};
ACTS.mpreg=function(){var p=P[S.selId],m=S.mp;m.reg={id:S.selId,ev:{},lv:p.lv||null,note:'',err:null,busy:false};render();mpFoc('rg-h');if(window.innerWidth<900)mpScroll('rg-h')};
ACTS.mprgx=function(){var i=S.mp.reg?S.mp.reg.id:S.selId;S.mp.reg=null;render();mpFoc(P[i].lv?'b-chg':'b-reg')};
ACTS.mpnoev=function(){S.mp.noev=!S.mp.noev;render()};
SUBS['f-rg']=function(){var r=S.mp.reg,i=r.id,p=P[i],ev=[],lv=0;
  EXEV.forEach(function(e,k){var c=document.getElementById('rg-e'+k);r.ev[k]=c.checked;if(c.checked)ev.push(e.k)});
  [1,2,3,4].forEach(function(n){var c=document.getElementById('rg-l'+n);if(c.checked)lv=n});r.lv=lv||null;r.note=document.getElementById('rg-n').value;
  if(!ev.length||!lv){r.err='inv';render();mpFoc('rg-err');return}
  r.busy=true;r.err=null;render();setTimeout(function(){r.busy=false;
    if(S.mode!=='ok'){r.err='unc';render();mpFoc('rg-err');return}
    p.lv=lv;p.fr=ev;p.ok=false;MD[i].ai=false;MD[i].rv=false;MD[i].conf=ev.length>1?'med':'low';MD[i].cw=ev.length>1?'mp_cwx':'mp_cw6';MD[i].why=null;S.mp.reg=null;S.mp.note='saved';render();raise(p,lv*.25);mpFoc('dt')},600)};
/* IA */
ACTS.mpai=function(b,v){var m=S.mp;m.reg=null;m.ai={step:1,sel:v==='all'?[0,1,2,3,4,5,6,7]:[+v],err:null,dec:{},saved:0,saving:false};render();mpFoc('ai-h');mpScroll('ai-box')};
ACTS.mpaix=function(){S.mp.ai=null;render()};
ACTS.mpainew=function(){var a=S.mp.ai;a.step=1;a.err=null;a.dec={};render();mpFoc('ai-h')};
ACTS.mpaiok=function(){S.mp.ai=null;render();window.scrollTo(0,0);mpFoc('mt')};
ACTS.mpaigo=function(){var a=S.mp.ai;a.step=2;a.err=null;render();mpFoc('ai-h');setTimeout(function(){
  if(S.mode==='limit'){a.step=1;a.err='budget'}else if(S.mode==='offline'){a.step=1;a.err='prov'}else{a.step=3;a.dec={}}render();mpFoc('ai-h')},900)};
ACTS.mpaisv=function(){var a=S.mp.ai;a.saving=true;a.err=null;render();setTimeout(function(){a.saving=false;
  if(S.mode!=='ok'){a.err='unc';render();return}
  var n=0,raises=[];a.sel.forEach(function(i){var d=mpDec(i);if(!d)return;var p=P[i],pr=AIP[i];n++;
    if(d==='un'){p.lv=0;p.fr=[];raises.push([p,0])}else{var lv=d==='acc'?pr.lv:+d.slice(2);p.lv=lv;p.fr=[pr.q];p.ok=false;MD[i].ai=true;MD[i].rv=false;MD[i].conf=pr.conf;MD[i].cw='mp_cwx';MD[i].why=null;raises.push([p,lv*.25])}});
  a.saved=n;a.step=4;render();raises.forEach(function(x){raise(x[0],x[1])});mpFoc('ai-dt')},700)};
ACTS.mpsim=function(b,v){var a=S.mp.ai;a.err=v;a.step=1;render();mpFoc('ai-h')};
[0,1,2,3,4,5,6,7].forEach(function(i){
  CHG['ai-k'+i]=function(el){var a=S.mp.ai,k=a.sel.indexOf(i);if(el.checked&&k<0)a.sel.push(i);if(!el.checked&&k>-1)a.sel.splice(k,1);a.sel.sort();var n=a.sel.length;document.getElementById('ai-n').textContent=n===1?t('ai_sel1',{m:8}):t('ai_sel',{n:n,m:8});document.getElementById('ai-go').disabled=!n};
  ['acc','dn1','dn2','dn3','un','skip'].forEach(function(v){CHG['aid'+i+'_'+v]=function(el){if(el.checked){S.mp.ai.dec[i]=v;var k=document.activeElement&&document.activeElement.id;render();mpFoc(k)}}})});
document.addEventListener('keydown',function(e){if(S.route!=='inicio'||!S.mp.dlg)return;
  if(e.key==='Escape'&&!S.mp.busy){ACTS.mpdx();return}
  if(e.key==='Tab'){var b=[].slice.call(document.querySelectorAll('.dlg button:not([disabled])'));if(!b.length)return;var f=b[0],l=b[b.length-1];
    if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus()}else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus()}}});
