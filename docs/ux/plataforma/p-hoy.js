/* /app/checkin · «Hoy». Reemplaza las 5 caritas por una escala de palabras con relieve (sin emojis).
   Estado real que cubre: elegir, guardar, error al guardar (el código actual continúa aunque falle el API). */
copy({
 ck_eye:'Registro del día',ck_t:'¿Cómo llegas hoy?',ck_p:'Elige la palabra que más se acerca. Solo tú ves esto y puedes cambiarlo cuando quieras.',
 ck_lg:'Cómo llegas hoy',ck_1:'Cargado',ck_2:'Bajo',ck_3:'Regular',ck_4:'Bien',ck_5:'Con energía',
 ck_note:'Esto no es un diagnóstico ni una medición de salud. Es un registro tuyo.',
 ck_save:'Guardar y pasar a la conversación',ck_saving:'Guardando…',ck_skip:'Saltar por hoy',ck_need:'Elige una opción para guardarla, o salta por hoy.',
 ck_err:'No pudimos guardar tu registro',ck_err_p:'Tu respuesta sigue aquí. Puedes pasar a la conversación sin guardar o intentarlo de nuevo.',ck_go:'Pasar sin guardar',
 ck_ok:'Registro guardado.',ck_pend:'Pendiente de producto',ck_pend_p:'Número de emergencia local en este aviso: falta la decisión de Alejo o Mauricio. Hasta entonces no se muestra ninguno.',
 routes:{checkin:'Hoy (registro del día)'}
},{
 ck_eye:'Daily check-in',ck_t:'How are you arriving today?',ck_p:'Pick the word that fits best. Only you see this, and you can change it whenever you want.',
 ck_lg:'How you are arriving today',ck_1:'Weighed down',ck_2:'Low',ck_3:'So-so',ck_4:'Good',ck_5:'Energised',
 ck_note:'This is not a diagnosis or a health measurement. It is your own record.',
 ck_save:'Save and go to the conversation',ck_saving:'Saving…',ck_skip:'Skip for today',ck_need:'Pick an option to save it, or skip for today.',
 ck_err:'We could not save your check-in',ck_err_p:'Your answer is still here. You can go to the conversation without saving or try again.',ck_go:'Continue without saving',
 ck_ok:'Check-in saved.',ck_pend:'Product pending',ck_pend_p:'A local emergency number in this notice: the decision from Alejo or Mauricio is missing. Until then none is shown.',
 routes:{checkin:'Today (daily check-in)'}
});
addRoutes('g_per',['checkin']);
S.ck={v:null,busy:false,err:false,need:false};
function ckGlyph(n){var r='';for(var i=1;i<=n;i++)r+='<ellipse cx="30" cy="20" rx="'+(5+i*5)+'" ry="'+(2.5+i*2.4)+'" fill="none" stroke="currentColor" stroke-width="'+(i===n?2.2:1)+'"/>';return'<svg viewBox="0 0 60 40" width="60" height="40" aria-hidden="true">'+r+'</svg>'}
V.checkin=function(){var k=S.ck;
 return'<main class="narrow"><section aria-labelledby="ckt"><p class="tag">'+t('ck_eye')+'</p><h1 class="s" id="ckt" style="margin:.3rem 0 .8rem">'+t('ck_t')+'</h1><p style="max-width:34rem;font-size:1.1rem">'+t('ck_p')+'</p>'+
 '<form id="f-ck" novalidate><fieldset class="scale"><legend class="sr">'+t('ck_lg')+'</legend>'+
 [1,2,3,4,5].map(function(i){return'<label><input type="radio" name="ck" id="ck-'+i+'" value="'+i+'"'+(k.v===i?' checked':'')+(k.busy?' disabled':'')+'>'+ckGlyph(i)+'<span>'+t('ck_'+i)+'</span></label>'}).join('')+'</fieldset>'+
 '<p class="err" role="alert"'+(k.need?'':' hidden')+'>'+t('ck_need')+'</p>'+
 (k.err?'<div class="banner bad" role="alert"><b>'+t('ck_err')+'</b>'+t('ck_err_p')+'<div class="row"><button class="btn" type="submit">'+t('retry')+'</button><button class="btn ghost" type="button" data-act="ckgo">'+t('ck_go')+'</button></div></div>':
 '<div class="row"><button class="btn" type="submit"'+(k.busy?' disabled':'')+'>'+(k.busy?t('ck_saving'):t('ck_save'))+'</button><button class="lnk" type="button" data-act="ckgo">'+t('ck_skip')+'</button></div>')+
 '</form><p class="muted small" style="margin-top:1.2rem">'+t('ck_note')+'</p><div class="protoNote"><b>'+t('ck_pend')+'</b>'+t('ck_pend_p')+'</div></section></main>'};
[1,2,3,4,5].forEach(function(i){CHG['ck-'+i]=function(){S.ck.v=i;S.ck.need=false;S.ck.err=false}});
ACTS.ckgo=function(){S.ck.err=false;S.ck.need=false;location.hash='chat'};
SUBS['f-ck']=function(){var k=S.ck;if(!k.v){k.need=true;render();var f=document.getElementById('ck-1');if(f)f.focus();return}
 k.busy=true;k.err=false;render();
 setTimeout(function(){k.busy=false;if(S.mode!=='ok'){k.err=true;render();return}toast(t('ck_ok'));location.hash='chat'},500)};
