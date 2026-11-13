/* /app/onboarding · «Tu punto de partida» (ParticipantContextForm + ResumeStarter + ContextExtras).
   Campos reales: entrada (personal / profesional / pronto), idioma preferido (obligatorio para continuar), país de residencia, mercado objetivo,
   zona horaria, y en «detalles»: profesión (120), intereses, meta, restricciones, disponibilidad en HORAS por semana, y los datos de la hoja de vida.
   La hoja de vida PROPONE, no pisa lo escrito, y nada se guarda hasta que la persona guarda. */
copy({
 pt_t:'Tu punto de partida',pt_p:'Cuéntanos lo básico para ajustar la conversación. Puedes guardar un borrador y volver cuando quieras.',
 pt_ent:'¿Qué te trae por aquí?',pt_e1:'Quiero conocerme mejor',pt_e2:'Busco apoyo con mi camino profesional',pt_e3:'Todavía no lo tengo claro',pt_e3h:'Puedes empezar y decidirlo después.',
 pt_lang:'Idioma preferido',pt_cty:'País de residencia',pt_mkt:'Mercado al que apuntas',pt_tz:'Zona horaria',pt_sug:'Usar la de mi dispositivo',pt_unk:'Sin indicar',
 pt_es:'Español',pt_en:'English',pt_co:'Colombia',pt_dk:'Dinamarca',pt_ar:'Argentina',pt_mx:'México',
 pt_det:'Detalles profesionales',pt_prof:'Profesión actual',pt_int:'Intereses',pt_goal:'Meta profesional',pt_cons:'Restricciones',pt_h120:'Hasta 120 caracteres.',pt_h500:'Hasta 500 caracteres.',
 pt_avail:'Disponibilidad',pt_avail_h:'Horas por semana que puedes dedicar. Puedes usar decimales: 2,5.',pt_avail_e:'Escribe un número de horas válido, por ejemplo 3 o 2,5.',
 pt_ext:'Datos de tu hoja de vida',pt_exp:'Experiencia',pt_edu:'Educación',pt_skl:'Habilidades que declaras',pt_lng:'Idiomas',pt_sec:'Sector',pt_yrs:'Años de experiencia total',
 rs_h:'Empieza con tu hoja de vida',rs_hp:'Opcional. Analizamos el texto y te proponemos datos. Nada se guarda hasta que tú guardes.',rs_btn:'Analizar mi hoja de vida (ejemplo)',rs_manual:'Prefiero escribirlo yo',
 rs_ft:'Encontramos datos en tu hoja de vida',rs_fs:'Encontramos {f} de {t} datos.',rs_fh:'Revísalos. Lo que escribiste tú no se reemplaza: lo nuevo queda aparte para que decidas.',rs_un:'Aún no se guardó nada.',rs_unb:'Si sales ahora, se pierden las sugerencias.',rs_rm:'Quitar todo lo sugerido',
 rs_sugg:'Sugerido desde tu hoja de vida',rs_rmv:'Quitar',rs_pend:'Propuesta aparte',rs_use:'Usar la propuesta',rs_ign:'Ignorar',rs_v_prof:'Analista de operaciones',rs_v_int:'Logística, mejora de procesos',rs_v_goal:'Pasar a un rol de coordinación',
 pt_draft:'Guardar borrador',pt_cont:'Guardar y continuar',pt_save:'Guardar',pt_back:'Volver al mapa',pt_conf:'Guardando…',
 pt_s_new:'Aún no has guardado nada.',pt_s_dirty:'Tienes cambios sin guardar.',pt_s_draft:'Borrador guardado.',pt_s_saved:'Punto de partida guardado.',
 pt_e_lang:'Elige un idioma para continuar.',pt_e_ent:'Elige una opción para continuar.',pt_e_gen:'Revisa los campos marcados.',
 pt_ok_t:'Punto de partida guardado',pt_ok_edit:'Editar',pt_ok_cv:'Mis hojas de vida',pt_ok_sk:'Revisar habilidades de la hoja de vida',pt_nx_t:'Qué sigue',pt_nx_p:'Ahora puedes ver tu mapa o ir al inicio. El mapa empieza plano: sube con tus evidencias.',pt_nx_map:'Ver mi mapa',pt_nx_home:'Ir al inicio',
 pt_cf:'Esta información cambió en otra sesión. Recarga para ver lo último.',pt_reload:'Recargar',pt_exp_t:'Tu sesión venció',pt_exp_p:'Inicia sesión otra vez. Lo que escribiste sin guardar se perdió.',
 pt_pend:'Pendiente de producto',pt_pend_p:'El estado de conflicto y de sesión vencida se ven en la pantalla Estados. La lista de países y zonas horarias sale del servidor: aquí van ejemplos.',
 routes:{punto:'Punto de partida (onboarding)'}
},{
 pt_t:'Your starting point',pt_p:'Tell us the basics so we can adjust the conversation. You can save a draft and come back whenever you want.',
 pt_ent:'What brings you here?',pt_e1:'I want to know myself better',pt_e2:'I am looking for support with my career',pt_e3:'I am not sure yet',pt_e3h:'You can start and decide later.',
 pt_lang:'Preferred language',pt_cty:'Country of residence',pt_mkt:'Market you are aiming at',pt_tz:'Time zone',pt_sug:'Use my device’s',pt_unk:'Not stated',
 pt_es:'Español',pt_en:'English',pt_co:'Colombia',pt_dk:'Denmark',pt_ar:'Argentina',pt_mx:'Mexico',
 pt_det:'Professional details',pt_prof:'Current profession',pt_int:'Interests',pt_goal:'Career goal',pt_cons:'Constraints',pt_h120:'Up to 120 characters.',pt_h500:'Up to 500 characters.',
 pt_avail:'Availability',pt_avail_h:'Hours per week you can spend. Decimals are fine: 2.5.',pt_avail_e:'Enter a valid number of hours, for example 3 or 2.5.',
 pt_ext:'Data from your résumé',pt_exp:'Experience',pt_edu:'Education',pt_skl:'Skills you declare',pt_lng:'Languages',pt_sec:'Sector',pt_yrs:'Total years of experience',
 rs_h:'Start with your résumé',rs_hp:'Optional. We analyse the text and suggest data. Nothing is saved until you save.',rs_btn:'Analyse my résumé (sample)',rs_manual:'I prefer to write it myself',
 rs_ft:'We found data in your résumé',rs_fs:'We found {f} of {t} items.',rs_fh:'Review them. What you wrote is not replaced: new items are kept apart for you to decide.',rs_un:'Nothing is saved yet.',rs_unb:'If you leave now, the suggestions are lost.',rs_rm:'Remove everything suggested',
 rs_sugg:'Suggested from your résumé',rs_rmv:'Remove',rs_pend:'Separate proposal',rs_use:'Use the proposal',rs_ign:'Ignore',rs_v_prof:'Operations analyst',rs_v_int:'Logistics, process improvement',rs_v_goal:'Move into a coordination role',
 pt_draft:'Save draft',pt_cont:'Save and continue',pt_save:'Save',pt_back:'Back to the map',pt_conf:'Saving…',
 pt_s_new:'You have not saved anything yet.',pt_s_dirty:'You have unsaved changes.',pt_s_draft:'Draft saved.',pt_s_saved:'Starting point saved.',
 pt_e_lang:'Pick a language to continue.',pt_e_ent:'Pick an option to continue.',pt_e_gen:'Check the marked fields.',
 pt_ok_t:'Starting point saved',pt_ok_edit:'Edit',pt_ok_cv:'My résumés',pt_ok_sk:'Review résumé skills',pt_nx_t:'What comes next',pt_nx_p:'You can now see your map or go home. The map starts flat: it rises with your evidence.',pt_nx_map:'See my map',pt_nx_home:'Go home',
 pt_cf:'This information changed in another session. Reload to see the latest.',pt_reload:'Reload',pt_exp_t:'Your session expired',pt_exp_p:'Sign in again. What you wrote without saving was lost.',
 pt_pend:'Product pending',pt_pend_p:'The conflict and expired-session states appear in the States screen. The list of countries and time zones comes from the server: these are samples.',
 routes:{punto:'Starting point (onboarding)'}
});
addRoutes('g_per',['punto']);
S.pt={ent:'',lang:'',cty:'',mkt:'',tz:'',prof:'',int:'',goal:'',cons:'',avail:'',ext:{exp:'',edu:'',skl:'',lng:'',sec:'',yrs:''},flag:{prof:0,int:0,goal:0},pend:{goal:0},an:null,errs:[],phase:'ready',msg:'',open:false,dirty:false,saved:null};
function ptSync(){var p=S.pt;[['pt-cty','cty'],['pt-mkt','mkt'],['pt-tz','tz'],['pt-prof','prof'],['pt-int','int'],['pt-goal','goal'],['pt-cons','cons'],['pt-avail','avail']].forEach(function(m){var e=document.getElementById(m[0]);if(e)p[m[1]]=e.value});
 var l=document.getElementById('pt-lang');if(l){p.lang=l.value}['exp','edu','skl','lng','sec','yrs'].forEach(function(k){var e=document.getElementById('px-'+k);if(e)p.ext[k]=e.value})}
function ptOpts(list,cur,unk){return'<option value="">'+t('pt_unk')+'</option>'+list.map(function(o){return'<option value="'+o[0]+'"'+(cur===o[0]?' selected':'')+'>'+t(o[1])+'</option>'}).join('')}
function ptFld(id,label,val,max,rows,help,key){var p=S.pt,sug=key&&p.flag[key]&&val;return'<div class="fld"><label for="'+id+'">'+label+(sug?' <span class="chip wait">'+t('rs_sugg')+'</span>':'')+'</label>'+(rows?'<textarea id="'+id+'" rows="'+rows+'" maxlength="'+max+'">'+esc(val)+'</textarea>':'<input type="text" id="'+id+'" maxlength="'+max+'" value="'+esc(val)+'">')+'<small>'+help+'</small>'+(sug?'<div class="row" style="margin:.2rem 0 0"><button type="button" class="lnk" data-act="ptrm" data-v="'+key+'">'+t('rs_rmv')+'</button></div>':'')+
 (key&&p.pend[key]?'<div class="pista" style="margin-top:.4rem"><p class="tag" style="margin:0">'+t('rs_pend')+'</p><p>'+esc(t('rs_v_'+key))+'</p><div class="row" style="margin:0"><button type="button" class="lnk" data-act="ptuse" data-v="'+key+'">'+t('rs_use')+'</button><button type="button" class="lnk" data-act="ptign" data-v="'+key+'">'+t('rs_ign')+'</button></div></div>':'')+'</div>'}
V.punto=function(){var p=S.pt;
 if(p.phase==='saved')return'<main class="narrow"><div role="status" class="card" style="margin-top:1.2rem"><h1 class="s" style="margin:0 0 .6rem">'+t('pt_ok_t')+'</h1><div class="row"><button class="btn" data-act="ptedit">'+t('pt_ok_edit')+'</button><a class="btn ghost" href="#resumes">'+t('pt_ok_cv')+'</a><a class="btn ghost" href="#resumen_habilidades">'+t('pt_ok_sk')+'</a></div><h2 style="font-size:1.3rem;margin-top:1.2rem">'+t('pt_nx_t')+'</h2><p>'+t('pt_nx_p')+'</p><div class="row"><a class="btn" href="#inicio">'+t('pt_nx_map')+'</a><a class="btn ghost" href="#inicio">'+t('pt_nx_home')+'</a></div></div></main>';
 var e=p.errs,er=function(k){return e.indexOf(k)>-1},ents=[['1','pt_e1'],['2','pt_e2'],['3','pt_e3']];
 var an=p.an?'<div class="card tint" role="status" tabindex="-1" id="pt-an"><h2 style="font-size:1.3rem">'+t('rs_ft')+'</h2><p><b>'+t('rs_fs',{f:p.an.f,t:p.an.t})+'</b></p><p class="small muted">'+t('rs_fh')+'</p><div class="banner" role="note"><b>'+t('rs_un')+'</b>'+t('rs_unb')+'</div><div class="row" style="margin:0"><button class="btn ghost" data-act="ptrmall">'+t('rs_rm')+'</button></div></div>':'';
 var stat=p.phase==='saving'?t('pt_conf'):p.dirty?t('pt_s_dirty'):p.saved==='d'?t('pt_s_draft'):t('pt_s_new');
 return'<main class="narrow"><div style="padding:1.2rem 0 .4rem"><h1 class="s">'+t('pt_t')+'</h1><p class="muted" style="max-width:40rem">'+t('pt_p')+'</p></div>'+
 '<section class="card" aria-labelledby="rsh"><h2 id="rsh" style="font-size:1.3rem">'+t('rs_h')+'</h2><p class="muted" style="margin:.2rem 0">'+t('rs_hp')+'</p><div class="row"><button class="btn" data-act="ptan">'+t('rs_btn')+'</button><a class="lnk" style="text-decoration:none" href="#punto" data-act="ptman">'+t('rs_manual')+'</a></div></section>'+an+
 '<form id="f-pt" novalidate><fieldset class="fld" style="border:0;padding:0"><legend>'+t('pt_ent')+'</legend>'+ents.map(function(o){return'<label class="check"><input type="radio" name="pt-ent" id="pt-ent'+o[0]+'" value="'+o[0]+'"'+(p.ent===o[0]?' checked':'')+'><span>'+t(o[1])+(o[0]==='3'?'<small class="muted" style="display:block">'+t('pt_e3h')+'</small>':'')+'</span></label>'}).join('')+'<p class="err" role="alert"'+(er('ent')?'':' hidden')+'>'+t('pt_e_ent')+'</p></fieldset>'+
 '<div class="fld"><label for="pt-lang">'+t('pt_lang')+'</label><select id="pt-lang" aria-invalid="'+er('lang')+'">'+ptOpts([['es','pt_es'],['en','pt_en']],p.lang)+'</select><p class="err" role="alert"'+(er('lang')?'':' hidden')+'>'+t('pt_e_lang')+'</p></div>'+
 '<div class="fld"><label for="pt-cty">'+t('pt_cty')+'</label><select id="pt-cty">'+ptOpts([['CO','pt_co'],['DK','pt_dk'],['AR','pt_ar'],['MX','pt_mx']],p.cty)+'</select></div>'+
 '<div class="fld"><label for="pt-mkt">'+t('pt_mkt')+'</label><select id="pt-mkt">'+ptOpts([['CO','pt_co'],['DK','pt_dk']],p.mkt)+'</select></div>'+
 '<div class="fld"><label for="pt-tz">'+t('pt_tz')+'</label><select id="pt-tz"><option value="">'+t('pt_unk')+'</option>'+['America/Bogota','Europe/Copenhagen','UTC'].map(function(z){return'<option value="'+z+'"'+(p.tz===z?' selected':'')+'>'+z+'</option>'}).join('')+'</select><div class="row" style="margin:.2rem 0 0"><button type="button" class="lnk" data-act="pttz">'+t('pt_sug')+'</button></div></div>'+
 '<details'+(p.open?' open':'')+' id="pt-det"><summary>'+t('pt_det')+'</summary>'+ptFld('pt-prof',t('pt_prof'),p.prof,120,2,t('pt_h120'),'prof')+ptFld('pt-int',t('pt_int'),p.int,500,3,t('pt_h500'),'int')+ptFld('pt-goal',t('pt_goal'),p.goal,500,3,t('pt_h500'),'goal')+ptFld('pt-cons',t('pt_cons'),p.cons,500,3,t('pt_h500'))+
 '<div class="fld"><label for="pt-avail">'+t('pt_avail')+'</label><input type="text" id="pt-avail" inputmode="decimal" autocomplete="off" value="'+esc(p.avail)+'" aria-invalid="'+er('avail')+'"><small>'+t('pt_avail_h')+'</small><p class="err" role="alert"'+(er('avail')?'':' hidden')+'>'+t('pt_avail_e')+'</p></div>'+
 '<h3 style="margin:1.2rem 0 0;font:700 1.1rem var(--cond);text-transform:uppercase;letter-spacing:.06em">'+t('pt_ext')+'</h3>'+[['exp','pt_exp'],['edu','pt_edu'],['skl','pt_skl'],['lng','pt_lng'],['sec','pt_sec'],['yrs','pt_yrs']].map(function(x){return'<div class="fld"><label for="px-'+x[0]+'">'+t(x[1])+'</label><input type="text" id="px-'+x[0]+'" value="'+esc(p.ext[x[0]])+'"></div>'}).join('')+'</details>'+
 (p.msg?'<div class="banner bad" role="alert" tabindex="-1" id="pt-msg">'+t(p.msg)+'</div>':'')+
 '<p role="status" aria-live="polite" class="muted small">'+stat+'</p><div class="row"><a class="btn ghost" href="#inicio">'+t('pt_back')+'</a><button type="button" class="btn ghost" data-act="ptdraft"'+(p.phase==='saving'?' disabled':'')+'>'+t('pt_draft')+'</button><button type="submit" class="btn"'+(p.phase==='saving'?' disabled':'')+'>'+t(p.ent==='1'?'pt_cont':'pt_save')+'</button></div></form><div class="protoNote"><b>'+t('pt_pend')+'</b>'+t('pt_pend_p')+'</div></main>'};
['1','2','3'].forEach(function(k){CHG['pt-ent'+k]=function(){ptSync();var d=document.getElementById('pt-det');if(d)S.pt.open=d.open;S.pt.ent=k;S.pt.errs=S.pt.errs.filter(function(x){return x!=='ent'});S.pt.dirty=true;render();var r=document.getElementById('pt-ent'+k);if(r)r.focus()}});
CHG['pt-lang']=function(el){ptSync();S.pt.errs=S.pt.errs.filter(function(x){return x!=='lang'});S.pt.dirty=true;if(el.value&&el.value!==S.lang){S.lang=el.value;render()}};
document.getElementById('app').addEventListener('input',function(e){if(/^(pt|px)-/.test(e.target.id)){S.pt.dirty=true;var det=document.getElementById('pt-det');if(det)S.pt.open=det.open}});
ACTS.ptan=function(){ptSync();var p=S.pt;p.an={f:3,t:6};p.open=true;
 if(!p.prof){p.prof=t('rs_v_prof');p.flag.prof=1}
 if(!p.int){p.int=t('rs_v_int');p.flag.int=1}
 if(p.goal){p.pend.goal=1}else{p.goal=t('rs_v_goal');p.flag.goal=1}
 p.dirty=true;render();var a=document.getElementById('pt-an');if(a)a.focus()};
ACTS.ptman=function(){ptSync();S.pt.open=true;render();var f=document.getElementById('pt-lang');if(f)f.focus()};
ACTS.ptrm=function(b,v){ptSync();S.pt[v]='';S.pt.flag[v]=0;render()};
ACTS.ptrmall=function(){ptSync();var p=S.pt;['prof','int','goal'].forEach(function(k){if(p.flag[k]){p[k]='';p.flag[k]=0}});p.pend={goal:0};p.an=null;render()};
ACTS.ptuse=function(b,v){ptSync();S.pt[v]=t('rs_v_'+v);S.pt.flag[v]=1;S.pt.pend[v]=0;render()};
ACTS.ptign=function(b,v){ptSync();S.pt.pend[v]=0;render()};
ACTS.pttz=function(){ptSync();S.pt.tz='America/Bogota';render()};
ACTS.ptedit=function(){S.pt.phase='ready';render()};
function ptValidate(cont){var p=S.pt,er=[];if(cont){if(!p.lang)er.push('lang');if(!p.ent)er.push('ent')}if(p.avail&&!/^\d+([.,]\d+)?$/.test(p.avail.trim()))er.push('avail');return er}
function ptSave(kind){var p=S.pt;p.errs=ptValidate(kind==='c');p.msg='';if(p.errs.length){p.msg='pt_e_gen';p.open=p.open||p.errs.indexOf('avail')>-1;render();var f=document.querySelector('[aria-invalid=true]')||document.getElementById('pt-msg');if(f)f.focus();return}
 p.phase='saving';render();setTimeout(function(){if(S.mode!=='ok'){p.phase='ready';p.msg='pt_e_gen';render();return}p.dirty=false;p.flag={prof:0,int:0,goal:0};p.an=null;if(kind==='d'){p.phase='ready';p.saved='d';render();toast(t('pt_s_draft'))}else{p.phase='saved';render()}},500)}
ACTS.ptdraft=function(){ptSync();ptSave('d')};
SUBS['f-pt']=function(){ptSync();ptSave('c')};
