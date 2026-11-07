/* Pantallas públicas que faltaban: restablecer contraseña, solicitud de profesionales y precios.
   Código real: access/PasswordResetPages.tsx (+ registrationPassword.ts), professional/ProfessionalApplicationPage.tsx (+ copy.ts, validation.ts), pages/PricingPage.tsx + components/landing/LandingPlans.tsx.
   Planes, precios y nombres son EJEMPLOS: los reales salen del catálogo. Cambios propuestos (ver README, decisiones 31–35):
   la lista de requisitos de la contraseña usa símbolo y palabra (no solo color) y se actualiza mientras se escribe;
   el formulario de profesionales avisa que el enlace debe empezar por https:// pero el código también acepta http:// (se unifica el mensaje y la regla);
   el enlace de restablecer llega en la dirección y se quita de la barra al abrir (se conserva). */
copy({
 rp_t:'Elige tu contraseña nueva',rp_pw:'Contraseña nueva',rp_show:'Mostrar contraseña',rp_save:'Guardar contraseña',rp_busy:'Guardando…',
 rp_reqT:'Tu contraseña debe tener:',rp_r_length:'Al menos 8 caracteres',rp_r_upper:'Una mayúscula (A-Z)',rp_r_lower:'Una minúscula (a-z)',rp_r_digit:'Un número (0-9)',rp_r_special:'Un carácter especial (! ? # $ % & …); el espacio no cuenta',rp_r_max_bytes:'Máximo 72 bytes: las tildes y los emojis ocupan más de uno.',rp_r_common:'No ser una contraseña muy común',
 rp_met:'cumplido',rp_pend:'pendiente',rp_sum:'{n} de {m} requisitos cumplidos',rp_need:'Tu contraseña necesita: {list}.',
 rp_m_length:'al menos 8 caracteres',rp_m_upper:'una mayúscula',rp_m_lower:'una minúscula',rp_m_digit:'un número',rp_m_special:'un carácter especial',rp_m_max_bytes:'no superar los 72 bytes',rp_m_common:'no ser una contraseña muy común',
 rp_e_net:'No pudimos guardar la contraseña. Lo que escribiste sigue aquí; inténtalo de nuevo.',rp_e_rate:'Hiciste demasiados intentos. Inténtalo de nuevo más tarde.',
 rp_doneT:'Contraseña actualizada',rp_done:'Listo. Por seguridad cerramos tus otras sesiones. Inicia sesión con tu contraseña nueva.',rp_go:'Iniciar sesión',
 rp_invT:'Enlace no válido',rp_inv:'Este enlace ya no sirve. Pide uno nuevo.',rp_new:'Pedir un enlace nuevo',rp_back:'Volver a iniciar sesión',
 rp_p:'Prototipo:',rp_p1:'ver enlace no válido',rp_p2:'ver contraseña actualizada',rp_p3:'ver formulario',rp_hint:'Prueba con «Password1!» para ver la regla «contraseña común».',
 pb_t:'Solicitud para profesionales',pb_intro:'Cuéntanos quién eres y adjunta tu hoja de vida. El equipo de Elevation revisa tu solicitud y te escribe al correo que indiques. Después, una junta valida tus credenciales antes de darte acceso.',
 pb_req:'obligatorio',pb_opt:'opcional',pb_name:'Nombre completo',pb_email:'Correo electrónico',pb_country:'País',pb_prof:'Profesión o especialidad',pb_lic:'Número de colegiatura o registro profesional',pb_licH:'Si aplica en tu país.',pb_url:'Perfil profesional (enlace)',pb_urlH:'Por ejemplo, tu perfil público. Debe empezar por https://',pb_msg:'Mensaje',pb_msgH:'Hasta 1.000 caracteres.',
 pb_cv:'Hoja de vida (PDF, máximo 5 MB)',pb_cvH:'Solo se aceptan archivos PDF de hasta 5 MB. Solo la ve el equipo de Elevation.',pb_cvChosen:'Archivo elegido',pb_cvRm:'Quitar archivo',pb_cvPick:'Elegir archivo',
 pb_consent:'Acepto el aviso de privacidad: Elevation usará mis datos solo para evaluar esta solicitud.',pb_send:'Enviar solicitud',pb_sending:'Enviando…',pb_note:'Elevation no es un servicio de emergencias ni sustituye la atención clínica.',
 pb_inv:'Revisa este campo.',pb_invSum:'Revisa los campos marcados.',pb_eCv:'Adjunta tu hoja de vida en PDF.',pb_eCvT:'El archivo debe ser un PDF.',pb_eCvS:'El archivo supera los 5 MB.',pb_eMail:'Escribe un correo válido.',pb_eUrl:'Escribe un enlace que empiece por https://',pb_eCons:'Debes aceptar el aviso de privacidad.',
 pb_net:'No pudimos enviar la solicitud. Lo que escribiste sigue aquí; inténtalo de nuevo.',pb_rate:'Hiciste demasiados intentos. Inténtalo de nuevo más tarde.',pb_srv:'No pudimos guardar la solicitud. Lo que escribiste sigue aquí; inténtalo más tarde.',
 pb_okT:'Solicitud recibida',pb_ok:'Recibimos tu solicitud. El equipo de Elevation la revisará y te escribirá al correo que indicaste.',pb_home:'Volver al inicio',pb_ct:'{n} de {m}',
 pb_p:'Prototipo:',pb_p1:'ver error de red',pb_p2:'ver demasiados intentos',pb_p3:'ver error del servidor',pb_p4:'ver formulario',pb_p5:'ver enviada',
 pp_t:'Elige cómo quieres acompañarte',pp_sub:'Empieza sin costo y cambia de plan cuando lo necesites.',pp_free:'Gratis',pp_feat:'Destacado',pp_reg:'Crear cuenta y solicitar este plan',pp_req:'Solicitar este plan',pp_note:'Los planes de pago pasan por la aprobación de un administrador.',
 pp_load:'Cargando planes…',pp_err:'No se pudieron cargar los planes. Inténtalo de nuevo.',pp_retry:'Reintentar',pp_empty:'Pronto publicaremos los planes.',pp_review:'Revisa el plan seleccionado antes de enviar tu solicitud.',pp_retired:'El plan seleccionado ya no está disponible. Revisa las opciones actuales.',
 pp_sending:'Enviando solicitud…',pp_sub1:'Tu solicitud quedó registrada y está en revisión. El plan aún no está activado.',pp_pend:'Ya tienes una solicitud en revisión.',pp_unk:'No pudimos confirmar el resultado. Comprueba el estado antes de volver a solicitarlo.',pp_chk:'Comprobar estado',pp_space:'Continuar a mi espacio',
 pp_mo:'/ mes',pp_yr:'/ año',pp_notice:'El asistente de IA de Elevation ofrece acompañamiento y orientación profesional no clínicos; no sustituye la atención psicológica, médica ni de emergencia.',pp_ex:'Planes y precios de ejemplo: los reales salen del catálogo.',
 pp_n1:'Gratis (ejemplo)',pp_d1:'Para empezar a ordenar tus ideas.',pp_f1a:'Conversación de acompañamiento',pp_f1b:'Mapa de competencias',pp_n2:'Acompañado (ejemplo)',pp_d2:'Con una persona profesional que te acompaña.',pp_f2a:'Todo lo del plan gratis',pp_f2b:'Sesiones con una persona profesional',
 pp_p:'Prototipo, ver como:',pp_p1:'visitante',pp_p2:'con sesión',pp_p3:'cargando',pp_p4:'error',pp_p5:'sin planes',pp_p6:'plan retirado',pp_p7:'solicitud en revisión',pp_p8:'resultado incierto',pp_p9:'enviando',
 routes:{restablecer:'Público · restablecer contraseña',profesionales:'Público · solicitud de profesionales',precios:'Público · precios'}
},{
 rp_t:'Choose your new password',rp_pw:'New password',rp_show:'Show password',rp_save:'Save password',rp_busy:'Saving…',
 rp_reqT:'Your password must have:',rp_r_length:'At least 8 characters',rp_r_upper:'One uppercase letter (A-Z)',rp_r_lower:'One lowercase letter (a-z)',rp_r_digit:'One number (0-9)',rp_r_special:'One special character (! ? # $ % & …); a space does not count',rp_r_max_bytes:'Up to 72 bytes: accents and emojis take more than one.',rp_r_common:'Not a very common password',
 rp_met:'met',rp_pend:'pending',rp_sum:'{n} of {m} requirements met',rp_need:'Your password needs: {list}.',
 rp_m_length:'at least 8 characters',rp_m_upper:'an uppercase letter',rp_m_lower:'a lowercase letter',rp_m_digit:'a number',rp_m_special:'a special character',rp_m_max_bytes:'not exceed 72 bytes',rp_m_common:'not be a very common password',
 rp_e_net:'We could not save the password. What you wrote is still here; please try again.',rp_e_rate:'You made too many attempts. Please try again later.',
 rp_doneT:'Password updated',rp_done:'Done. For security we signed you out everywhere else. Sign in with your new password.',rp_go:'Sign in',
 rp_invT:'Link not valid',rp_inv:'This link no longer works. Request a new one.',rp_new:'Request a new link',rp_back:'Back to sign in',
 rp_p:'Prototype:',rp_p1:'see invalid link',rp_p2:'see password updated',rp_p3:'see form',rp_hint:'Try “Password1!” to see the “common password” rule.',
 pb_t:'Application for professionals',pb_intro:'Tell us who you are and attach your résumé. The Elevation team reviews your application and writes to the email you provide. Afterwards, a board verifies your credentials before giving you access.',
 pb_req:'required',pb_opt:'optional',pb_name:'Full name',pb_email:'Email address',pb_country:'Country',pb_prof:'Profession or specialty',pb_lic:'License or professional registration number',pb_licH:'If it applies in your country.',pb_url:'Professional profile (link)',pb_urlH:'For example, your public profile. It must start with https://',pb_msg:'Message',pb_msgH:'Up to 1,000 characters.',
 pb_cv:'Résumé / CV (PDF, up to 5 MB)',pb_cvH:'Only PDF files up to 5 MB are accepted. Only the Elevation team can see it.',pb_cvChosen:'Selected file',pb_cvRm:'Remove file',pb_cvPick:'Choose file',
 pb_consent:'I accept the privacy notice: Elevation will use my data only to evaluate this application.',pb_send:'Send application',pb_sending:'Sending…',pb_note:'Elevation is not an emergency service and does not replace clinical care.',
 pb_inv:'Check this field.',pb_invSum:'Check the marked fields.',pb_eCv:'Attach your résumé as a PDF.',pb_eCvT:'The file must be a PDF.',pb_eCvS:'The file is larger than 5 MB.',pb_eMail:'Enter a valid email.',pb_eUrl:'Enter a link that starts with https://',pb_eCons:'You must accept the privacy notice.',
 pb_net:'We could not send the application. What you wrote is still here; please try again.',pb_rate:'You made too many attempts. Please try again later.',pb_srv:'We could not save the application. What you wrote is still here; please try again later.',
 pb_okT:'Application received',pb_ok:'We received your application. The Elevation team will review it and write to the email you provided.',pb_home:'Back to home',pb_ct:'{n} of {m}',
 pb_p:'Prototype:',pb_p1:'see network error',pb_p2:'see too many attempts',pb_p3:'see server error',pb_p4:'see form',pb_p5:'see sent',
 pp_t:'Choose how you want to be supported',pp_sub:'Start at no cost and change plans whenever you need.',pp_free:'Free',pp_feat:'Featured',pp_reg:'Create an account and request this plan',pp_req:'Request this plan',pp_note:'Paid plans go through administrator approval.',
 pp_load:'Loading plans…',pp_err:'Plans could not be loaded. Please try again.',pp_retry:'Try again',pp_empty:'We will publish the plans soon.',pp_review:'Review the selected plan before submitting your request.',pp_retired:'The selected plan is no longer available. Review the current options.',
 pp_sending:'Submitting request…',pp_sub1:'Your request was recorded and is under review. The plan is not active yet.',pp_pend:'You already have a request under review.',pp_unk:'We could not confirm the result. Check its status before requesting again.',pp_chk:'Check status',pp_space:'Continue to my space',
 pp_mo:'/ month',pp_yr:'/ year',pp_notice:'Elevation’s AI assistant offers non-clinical support and career guidance; it does not replace psychological, medical or emergency care.',pp_ex:'Example plans and prices: the real ones come from the catalog.',
 pp_n1:'Free (example)',pp_d1:'To start organizing your ideas.',pp_f1a:'Supportive conversation',pp_f1b:'Skills map',pp_n2:'Supported (example)',pp_d2:'With a professional who accompanies you.',pp_f2a:'Everything in the free plan',pp_f2b:'Sessions with a professional',
 pp_p:'Prototype, view as:',pp_p1:'visitor',pp_p2:'signed in',pp_p3:'loading',pp_p4:'error',pp_p5:'no plans',pp_p6:'retired plan',pp_p7:'request under review',pp_p8:'uncertain result',pp_p9:'sending',
 routes:{restablecer:'Public · reset password',profesionales:'Public · professional application',precios:'Public · pricing'}
});
addRoutes('g_pub',['restablecer','profesionales','precios']);PUB.push('restablecer','profesionales','precios');
/* ============ RESTABLECER CONTRASEÑA ============ */
S.rp={ph:'form',pw:'',show:false,busy:false,miss:[],srv:[],err:''};
var RPR=['length','upper','lower','digit','special'];
function rpOk(id,v){return id==='length'?[].concat(Array.from(v)).length>=8:id==='upper'?/[A-ZÁÉÍÓÚÑ]/.test(v):id==='lower'?/[a-záéíóúñ]/.test(v):id==='digit'?/[0-9]/.test(v):/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9\s]/.test(v)}
function rpProblems(v){return RPR.filter(function(id){return!rpOk(id,v)})}
V.restablecer=function(){var r=S.rp,
 px=bjProto('rp_p',[['rpsim','invalid','rp_p1'],['rpsim','done','rp_p2'],['rpsim','form','rp_p3']]);
 var shell=function(title,body){return'<main class="auth"><div><h1 class="s" id="rp-h" tabindex="-1">'+title+'</h1></div><div>'+body+'</div></main>'};
 if(r.ph==='done')return shell(t('rp_doneT'),'<div class="banner" role="status"><b>'+t('rp_doneT')+'</b>'+t('rp_done')+'</div><div class="row"><a class="btn" href="#entrar">'+t('rp_go')+'</a></div>'+px);
 if(r.ph==='invalid')return shell(t('rp_invT'),'<div class="banner bad" role="alert"><b>'+t('rp_invT')+'</b>'+t('rp_inv')+'</div><div class="row"><a class="btn" href="#recuperar">'+t('rp_new')+'</a><a href="#entrar">'+t('rp_back')+'</a></div>'+px);
 var all=r.srv.length||r.miss.length,met=RPR.filter(function(id){return rpOk(id,r.pw)}).length;
 var need=r.miss.concat(r.srv).filter(function(x,i,a){return a.indexOf(x)===i});
 var list=RPR.concat(['max_bytes','common']).filter(function(id){return RPR.indexOf(id)>-1||r.srv.indexOf(id)>-1}).map(function(id){var ok=RPR.indexOf(id)>-1?rpOk(id,r.pw):false;
  return'<li><i class="sym '+(ok?'s':'n')+'" aria-hidden="true"></i> <span>'+t('rp_r_'+id)+'</span> <span class="sr">· '+t(ok?'rp_met':'rp_pend')+'</span></li>'}).join('');
 var body='<form id="f-rp" novalidate><div class="fld"><label for="rp-pw">'+t('rp_pw')+'</label><input id="rp-pw" type="'+(r.show?'text':'password')+'" autocomplete="new-password" value="'+esc(r.pw)+'" aria-describedby="rp-req"'+(all?' class="bad" aria-invalid="true"':'')+(r.busy?' disabled':'')+'></div>'+
  '<label class="check"><input type="checkbox" id="rp-show" '+(r.show?'checked':'')+'><span>'+t('rp_show')+'</span></label>'+
  '<div id="rp-req" class="card" style="margin:.8rem 0"><p class="tag" style="margin:0">'+t('rp_reqT')+'</p><ul class="reql" style="list-style:none;padding:0;margin:.4rem 0">'+list+'</ul><p class="small muted" style="margin:0" id="rp-sum" aria-live="polite">'+t('rp_sum',{n:met,m:RPR.length})+'</p></div>'+
  (need.length?'<p class="pferr" role="alert" id="rp-er" tabindex="-1">'+t('rp_need',{list:need.map(function(x){return t('rp_m_'+x)}).join(', ')})+'</p>':'')+
  (r.err?'<p class="pferr" role="alert" id="rp-er2" tabindex="-1">'+t(r.err)+'</p>':'')+
  '<div class="row"><button class="btn" type="submit"'+(r.busy?' disabled':'')+'>'+t(r.busy?'rp_busy':'rp_save')+'</button></div></form><p class="small muted">'+t('rp_hint')+'</p>';
 return shell(t('rp_t'),body+px)};
ADV['rp-pw']=function(v){S.rp.pw=v;S.rp.miss=[];S.rp.srv=[];S.rp.err='';var l=document.querySelector('.reql');if(l){l.innerHTML=RPR.map(function(id){var ok=rpOk(id,v);return'<li><i class="sym '+(ok?'s':'n')+'" aria-hidden="true"></i> <span>'+t('rp_r_'+id)+'</span> <span class="sr">· '+t(ok?'rp_met':'rp_pend')+'</span></li>'}).join('')}
 var s=document.getElementById('rp-sum');if(s)s.textContent=t('rp_sum',{n:RPR.filter(function(id){return rpOk(id,v)}).length,m:RPR.length})};
CHG['rp-show']=function(el){var r=S.rp,v=document.getElementById('rp-pw').value;r.pw=v;r.show=el.checked;render();pfFoc('rp-show')};
ACTS.rpsim=function(b,v){var r=S.rp;r.ph=v;r.pw='';r.miss=[];r.srv=[];r.err='';r.busy=false;render();pfFoc('rp-h')};
SUBS['f-rp']=function(){var r=S.rp;if(r.busy)return;r.pw=document.getElementById('rp-pw').value;r.err='';r.srv=[];r.miss=rpProblems(r.pw);
 if(r.miss.length){render();pfFoc('rp-er');return}
 r.busy=true;render();setTimeout(function(){r.busy=false;
  if(S.mode==='offline'){r.err='rp_e_net';render();pfFoc('rp-er2');return}
  if(S.mode==='limit'){r.err='rp_e_rate';render();pfFoc('rp-er2');return}
  if(r.pw.toLowerCase()==='password1!'){r.srv=['common'];render();pfFoc('rp-er');return}
  r.ph='done';r.pw='';render();pfFoc('rp-h')},600)};
/* ============ SOLICITUD DE PROFESIONALES ============ */
var PBL={name:120,email:254,country:80,profession:120,licenseNumber:60,profileUrl:300,message:1000};
function pbMk(){return{ph:'idle',v:{name:'',email:'',country:'',profession:'',licenseNumber:'',profileUrl:'',message:''},file:null,consent:false,errs:[],sim:''}}
S.pb=pbMk();
function pbFileProblem(f){if(!f)return'required';if(f.type!=='application/pdf'&&!/\.pdf$/i.test(f.name))return'type';if(f.size>5*1024*1024)return'size';return null}
function pbValidate(){var b=S.pb,v=b.v,bad=[];['name','email','country','profession'].forEach(function(k){if(!v[k].trim())bad.push(k)});
 if(v.email.trim()&&!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(v.email.trim())&&bad.indexOf('email')<0)bad.push('email');
 Object.keys(PBL).forEach(function(k){if(v[k].length>PBL[k]&&bad.indexOf(k)<0)bad.push(k)});
 if(v.profileUrl.trim()){var ok=false;try{var u=new URL(v.profileUrl.trim());ok=(u.protocol==='https:'||u.protocol==='http:')&&!u.username&&!u.password}catch(e){}if(!ok&&bad.indexOf('profileUrl')<0)bad.push('profileUrl')}
 if(pbFileProblem(b.file))bad.push('cv');if(!b.consent)bad.push('consent');
 var ord=['name','email','country','profession','licenseNumber','profileUrl','message','cv','consent'];return ord.filter(function(k){return bad.indexOf(k)>-1})}
function pbMsg(k){var b=S.pb;if(k==='cv'){var p=pbFileProblem(b.file);return t(p==='type'?'pb_eCvT':p==='size'?'pb_eCvS':'pb_eCv')}return k==='email'&&b.v.email.trim()?t('pb_eMail'):k==='profileUrl'?t('pb_eUrl'):k==='consent'?t('pb_eCons'):t('pb_inv')}
function pbF(k,label,o){o=o||{};var b=S.pb,id='pb-'+k,bad=b.errs.indexOf(k)>-1,dis=b.ph==='sending'?' disabled':'';ADV[id]=function(v){S.pb.v[k]=v};
 var ds=[o.help?id+'-h':'',bad?id+'-e':''].filter(Boolean).join(' ');
 var inp=o.area?'<textarea id="'+id+'" rows="4" maxlength="'+PBL[k]+'"'+(bad?' class="bad" aria-invalid="true"':'')+(ds?' aria-describedby="'+ds+'"':'')+dis+'>'+esc(b.v[k])+'</textarea>':
  '<input id="'+id+'" type="'+(o.type||'text')+'" autocomplete="off" maxlength="'+PBL[k]+'" value="'+esc(b.v[k])+'"'+(bad?' class="bad" aria-invalid="true"':'')+(ds?' aria-describedby="'+ds+'"':'')+dis+'>';
 return'<div class="fld"><label for="'+id+'">'+label+' · '+t(o.req?'pb_req':'pb_opt')+'</label>'+inp+(o.help?'<small id="'+id+'-h">'+o.help+'</small>':'')+(bad?'<span class="err" id="'+id+'-e">'+pbMsg(k)+'</span>':'')+'</div>'}
V.profesionales=function(){var b=S.pb,px=bjProto('pb_p',[['pbsim','offline','pb_p1'],['pbsim','limit','pb_p2'],['pbsim','server','pb_p3'],['pbsim','ok','pb_p4'],['pbsim','success','pb_p5']]);
 if(b.ph==='success')return'<main class="auth"><div><h1 class="s" id="pb-h" tabindex="-1">'+t('pb_okT')+'</h1><p role="status" style="max-width:30rem;font-size:1.15rem">'+t('pb_ok')+'</p><div class="row"><a class="btn" href="#portada">'+t('pb_home')+'</a></div></div><div></div></main>'+px;
 var ban=b.ph==='network'?t('pb_net'):b.ph==='rate'?t('pb_rate'):b.ph==='server'?t('pb_srv'):b.errs.length?t('pb_invSum'):'',dis=b.ph==='sending'?' disabled':'';
 var f=b.file,cvBad=b.errs.indexOf('cv')>-1,csBad=b.errs.indexOf('consent')>-1;
 return'<main class="narrow"><div style="padding:1.2rem 0 .4rem"><a class="lnk" href="#portada" style="text-decoration:none">← '+t('pb_home')+'</a><h1 class="s" id="pb-h" tabindex="-1" style="margin-top:1rem">'+t('pb_t')+'</h1><p style="max-width:40rem;font-size:1.1rem">'+t('pb_intro')+'</p></div>'+
 '<form id="f-pb" novalidate>'+(ban?'<div class="banner bad" role="alert" id="pb-ban" tabindex="-1"><b>'+ban+'</b></div>':'')+
 '<div class="pbgrid">'+pbF('name',t('pb_name'),{req:1})+pbF('email',t('pb_email'),{req:1,type:'email'})+pbF('country',t('pb_country'),{req:1})+pbF('profession',t('pb_prof'),{req:1})+'</div>'+
 pbF('licenseNumber',t('pb_lic'),{help:t('pb_licH')})+pbF('profileUrl',t('pb_url'),{help:t('pb_urlH'),type:'url'})+pbF('message',t('pb_msg'),{help:t('pb_msgH'),area:1})+
 '<div class="fld"><label for="pb-cv">'+t('pb_cv')+' · '+t('pb_req')+'</label><input id="pb-cv" type="file" accept="application/pdf,.pdf"'+(cvBad?' aria-invalid="true"':'')+' aria-describedby="pb-cv-h'+(cvBad?' pb-cv-e':'')+'"'+dis+'><small id="pb-cv-h">'+t('pb_cvH')+'</small>'+
 (f?'<p role="status" style="margin:.3rem 0">'+t('pb_cvChosen')+': '+esc(f.name)+' ('+Math.max(1,Math.round(f.size/1024))+' KB) <button type="button" class="lnk" data-act="pbrmfile">'+t('pb_cvRm')+'</button></p>':'')+(cvBad?'<span class="err" id="pb-cv-e">'+pbMsg('cv')+'</span>':'')+'</div>'+
 '<div class="fld"><label class="check"><input type="checkbox" id="pb-consent" '+(b.consent?'checked':'')+(csBad?' aria-invalid="true" aria-describedby="pb-consent-e"':'')+dis+'><span>'+t('pb_consent')+'</span></label>'+(csBad?'<span class="err" id="pb-consent-e">'+t('pb_eCons')+'</span>':'')+'</div>'+
 '<div class="row"><button class="btn" type="submit"'+dis+'>'+t(b.ph==='sending'?'pb_sending':'pb_send')+'</button></div><p class="small muted">'+t('pb_note')+'</p></form>'+px+'</main>'};
CHG['pb-consent']=function(el){S.pb.consent=el.checked;S.pb.errs=S.pb.errs.filter(function(k){return k!=='consent'})};
CHG['pb-cv']=function(el){var f=el.files&&el.files[0];S.pb.file=f?{name:f.name,size:f.size,type:f.type}:null;S.pb.errs=S.pb.errs.filter(function(k){return k!=='cv'});render();pfFoc('pb-cv')};
ACTS.pbrmfile=function(){S.pb.file=null;render();pfFoc('pb-cv')};
ACTS.pbsim=function(b,v){var s=S.pb;if(v==='ok'){S.pb=pbMk();S.mode='ok'}else if(v==='success'){s.ph='success'}else{if(v==='server'){s.sim='server'}else{S.mode=v}
 if(!s.v.name){s.v={name:'Camila (ejemplo)',email:'camila@ejemplo.invalid',country:'Colombia',profession:'Psicología',licenseNumber:'',profileUrl:'',message:''};s.file={name:'hoja-de-vida.pdf',size:412*1024,type:'application/pdf'};s.consent=true}
 s.ph='idle';s.errs=[]}
 var md=document.getElementById('md');if(md&&(v==='offline'||v==='limit'||v==='ok'))md.value=S.mode;render();pfFoc('pb-h')};
SUBS['f-pb']=function(){var b=S.pb;if(b.ph==='sending')return;b.errs=pbValidate();
 if(b.errs.length){b.ph='idle';render();pfFoc(b.errs[0]==='cv'?'pb-cv':b.errs[0]==='consent'?'pb-consent':'pb-'+b.errs[0]);return}
 b.ph='sending';render();setTimeout(function(){
  var nx=b.sim==='server'?'server':S.mode==='offline'?'network':S.mode==='limit'?'rate':'success';b.sim='';
  if(nx==='success'){var keep=pbMk();S.pb=keep;S.pb.ph='success';render();pfFoc('pb-h');return}
  b.ph=nx;render();pfFoc('pb-ban')},700)};
/* ============ PRECIOS ============ */
S.pp={ph:'ready',user:false,sel:null,req:'none'};
var PPP=[{id:1,n:'pp_n1',d:'pp_d1',f:['pp_f1a','pp_f1b'],price:0,per:'mo',hl:false},{id:2,n:'pp_n2',d:'pp_d2',f:['pp_f2a','pp_f2b'],price:12,per:'mo',hl:true}];
V.precios=function(){var p=S.pp,px=bjProto('pp_p',[['ppsim','visitor','pp_p1'],['ppsim','user','pp_p2'],['ppsim','load','pp_p3'],['ppsim','err','pp_p4'],['ppsim','empty','pp_p5'],['ppsim','retired','pp_p6'],['ppsim','pending','pp_p7'],['ppsim','unknown','pp_p8'],['ppsim','sending','pp_p9']]);
 var h='<main><section class="narrow" aria-labelledby="pp-h" style="padding:1.2rem 0"><h1 class="s" id="pp-h" tabindex="-1">'+t('pp_t')+'</h1><p class="small muted">'+t('pp_ex')+'</p>';
 if(p.ph==='load')h+='<div role="status"><p>'+t('pp_load')+'</p><div class="pulse" aria-hidden="true"></div></div>';
 else if(p.ph==='err')h+='<div class="banner bad" role="alert" id="pp-st" tabindex="-1"><b>'+t('pp_err')+'</b><div class="row"><button class="btn" data-act="ppretry">'+t('pp_retry')+'</button></div></div>';
 else if(p.ph==='empty')h+='<p role="status">'+t('pp_empty')+'</p>';
 else{h+='<p>'+t('pp_sub')+'</p>';
  if(p.sel)h+='<p role="status" id="pp-st" tabindex="-1">'+t(p.sel==='retired'?'pp_retired':'pp_review')+'</p>';
  var blocked=p.user&&(p.req==='pending'||p.req==='sending'||p.req==='unknown');
  h+='<div id="pp-action">';
  if(p.user&&p.req==='sending')h+='<p role="status">'+t('pp_sending')+'</p>';
  if(p.user&&p.req==='pending')h+='<p role="status">'+t('pp_pend')+'</p>';
  if(p.user&&p.req==='submitted')h+='<p role="status" id="pp-st2" tabindex="-1">'+t('pp_sub1')+'</p>';
  if(p.user&&p.req==='unknown')h+='<div role="alert"><p>'+t('pp_unk')+'</p><button class="btn ghost" data-act="ppcheck">'+t('pp_chk')+'</button></div>';
  h+='</div><div class="plans">'+PPP.map(function(x){var cur=p.sel==='review'&&x.id===2;
   return'<article class="plan" aria-labelledby="pp-n'+x.id+'"'+(cur?' aria-current="true"':'')+'>'+(x.hl?'<span class="chip wait">'+t('pp_feat')+'</span>':'')+'<h2 id="pp-n'+x.id+'" style="font-size:1.5rem;margin:.3rem 0">'+t(x.n)+'</h2><p class="nm" style="font-size:1.8rem;margin:0">'+(x.price?'US$ '+x.price+' <small>'+t('pp_mo')+'</small>':t('pp_free'))+'</p><p class="small muted">'+t(x.d)+'</p><ul>'+x.f.map(function(f){return'<li>'+t(f)+'</li>'}).join('')+'</ul>'+
   '<div class="row"><button class="btn'+(x.hl?'':' ghost')+'" data-act="ppreq" data-v="'+x.id+'"'+(blocked?' disabled':'')+'>'+t(p.user?'pp_req':'pp_reg')+'</button></div></article>'}).join('')+'</div><p class="small muted">'+t('pp_note')+'</p>';
  if(p.user)h+='<p><a class="lnk" href="#inicio" style="text-decoration:none">'+t('pp_space')+'</a></p>'}
 return h+'</section>'+px+'</main><footer class="f"><span>'+t('pp_notice')+'</span></footer>'};
ACTS.ppsim=function(b,v){var p=S.pp;p.sel=null;p.req='none';p.ph='ready';
 if(v==='visitor')p.user=false;else if(v==='user')p.user=true;else if(v==='load'||v==='err'||v==='empty')p.ph=v;
 else if(v==='retired'){p.sel='retired'}else{p.user=true;p.req=v}
 render();pfFoc(p.sel||p.ph==='err'?'pp-st':'pp-h')};
ACTS.ppretry=function(){S.pp.ph='load';render();pfFoc('pp-h');setTimeout(function(){S.pp.ph=S.mode==='ok'?'ready':'err';render();pfFoc(S.pp.ph==='ready'?'pp-h':'pp-st')},600)};
ACTS.ppcheck=function(){S.pp.req='none';render();pfFoc('pp-h')};
ACTS.ppreq=function(b,v){var p=S.pp;if(!p.user){location.hash='#registro';return}p.sel=null;p.req='sending';render();setTimeout(function(){p.req=S.mode==='ok'?'submitted':'unknown';render();pfFoc(p.req==='submitted'?'pp-st2':'pp-action')},800)};
