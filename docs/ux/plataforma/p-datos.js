/* /app/data · «Mis datos» (ES-135). Exportar los datos personales y pedir la eliminación de la cuenta en dos pasos.
   Las secciones del archivo de ejemplo NO son las reales: salen del servidor (dataRights). */
copy({
 da_t:'Mis datos',da_p:'Aquí descargas lo que Elevation guarda de ti, o pides que cerremos tu cuenta. Tú decides.',
 da_ex_t:'Descargar mis datos',da_ex_p:'Preparamos un archivo con tus datos personales. Queda disponible unos minutos y solo lo ves tú.',da_prep:'Preparar mi archivo',da_preping:'Preparando…',
 da_secs:'El archivo incluye: {l}.',da_valid:'Disponible hasta las {h}.',da_dl:'Descargar archivo',da_dling:'Descargando…',da_dled:'Archivo descargado.',da_sample:'Ejemplo de contenido',
 da_s1:'Perfil',da_s2:'Evidencias (3)',da_s3:'Diario (2)',da_s4:'Conversaciones (4)',
 da_err:'No pudimos preparar tu archivo. Intenta de nuevo en unos minutos.',
 da_de_t:'Eliminar mi cuenta',da_de_p:'Se cierra tu cuenta y se borran tus datos. No se puede deshacer. Si quieres conservar algo, descárgalo antes.',da_de_start:'Quiero eliminar mi cuenta',
 da_de_ack:'Entiendo que se borra mi cuenta y que no se puede deshacer.',da_de_ok:'Sí, eliminar mi cuenta',da_de_no:'Cancelar',da_de_ing:'Eliminando…',
 da_done_t:'Registramos tu solicitud',da_done_p:'Cerramos tu sesión y tu cuenta queda en proceso de eliminación.',da_home:'Volver al inicio',
 da_off:'Esta función no está disponible por ahora.',da_ref:'Prototipo: así se ve cuando el servidor la tiene apagada.',
 routes:{datos:'Mis datos'}
},{
 da_t:'My data',da_p:'Here you download what Elevation keeps about you, or ask us to close your account. You decide.',
 da_ex_t:'Download my data',da_ex_p:'We prepare a file with your personal data. It stays available for a few minutes and only you can see it.',da_prep:'Prepare my file',da_preping:'Preparing…',
 da_secs:'The file includes: {l}.',da_valid:'Available until {h}.',da_dl:'Download file',da_dling:'Downloading…',da_dled:'File downloaded.',da_sample:'Sample contents',
 da_s1:'Profile',da_s2:'Evidence (3)',da_s3:'Diary (2)',da_s4:'Conversations (4)',
 da_err:'We could not prepare your file. Try again in a few minutes.',
 da_de_t:'Delete my account',da_de_p:'Your account is closed and your data is erased. This cannot be undone. If you want to keep something, download it first.',da_de_start:'I want to delete my account',
 da_de_ack:'I understand my account is erased and this cannot be undone.',da_de_ok:'Yes, delete my account',da_de_no:'Cancel',da_de_ing:'Deleting…',
 da_done_t:'We recorded your request',da_done_p:'We signed you out and your account is being deleted.',da_home:'Back to home',
 da_off:'This feature is not available right now.',da_ref:'Prototype: this is how it looks when the server has it switched off.',
 routes:{datos:'My data'}
});
addRoutes('g_per',['datos']);
S.da={prep:false,busy:null,err:false,confirm:false,ack:false,done:false,off:false};
V.datos=function(){var d=S.da;
 if(d.done)return'<main class="narrow"><h1 class="s" style="margin-top:1.2rem">'+t('da_done_t')+'</h1><p role="status" style="font-size:1.1rem">'+t('da_done_p')+'</p><div class="row"><a class="btn" href="#portada">'+t('da_home')+'</a></div></main>';
 var h=new Date(Date.now()+15*60000).toLocaleTimeString(S.lang==='es'?'es-CO':'en',{hour:'2-digit',minute:'2-digit'});
 var list=[1,2,3,4].map(function(i){return t('da_s'+i)}).join(' · ');
 var ex='<section class="card" aria-labelledby="da-ex"><h2 id="da-ex" style="font-size:1.4rem">'+t('da_ex_t')+'</h2><p>'+t('da_ex_p')+'</p>'+
  (d.err?'<p class="err" role="alert">'+t('da_err')+'</p>':'')+
  (!d.prep?'<div class="row"><button class="btn" data-act="daprep"'+(d.busy||d.off?' disabled':'')+'>'+(d.busy==='prep'?t('da_preping'):t('da_prep'))+'</button></div>':
  '<p>'+t('da_secs',{l:list})+' <span class="chip">'+t('da_sample')+'</span></p><p class="small muted">'+t('da_valid',{h:h})+'</p><div class="row"><button class="btn" data-act="dadl"'+(d.busy?' disabled':'')+'>'+(d.busy==='dl'?t('da_dling'):t('da_dl'))+'</button></div>')+'</section>';
 var de='<section class="card" aria-labelledby="da-de"><h2 id="da-de" style="font-size:1.4rem">'+t('da_de_t')+'</h2><p>'+t('da_de_p')+'</p>'+
  (!d.confirm?'<div class="row"><button class="btn ghost danger" id="da-start" data-act="dastart"'+(d.busy||d.off?' disabled':'')+'>'+t('da_de_start')+'</button></div>':
  '<div role="group" aria-label="'+t('da_de_t')+'"><label class="check"><input type="checkbox" id="da-ack"'+(d.ack?' checked':'')+'><span>'+t('da_de_ack')+'</span></label><div class="row"><button class="btn danger" data-act="dadel"'+(d.ack&&!d.busy?'':' disabled')+'>'+(d.busy==='del'?t('da_de_ing'):t('da_de_ok'))+'</button><button class="btn ghost" data-act="dano"'+(d.busy?' disabled':'')+'>'+t('da_de_no')+'</button></div></div>')+'</section>';
 return'<main class="narrow"><div style="padding:1.2rem 0 .6rem"><h1 class="s">'+t('da_t')+'</h1><p class="muted" style="max-width:36rem">'+t('da_p')+'</p></div><div class="stack">'+ex+de+'</div></main>'};
ACTS.daprep=function(){var d=S.da;d.busy='prep';d.err=false;render();setTimeout(function(){d.busy=null;if(S.mode!=='ok')d.err=true;else d.prep=true;render()},600)};
ACTS.dadl=function(){var d=S.da;d.busy='dl';render();setTimeout(function(){d.busy=null;render();toast(t('da_dled'))},500)};
ACTS.dastart=function(){S.da.confirm=true;render();var c=document.getElementById('da-ack');if(c)c.focus()};
ACTS.dano=function(){var d=S.da;d.confirm=false;d.ack=false;render();var b=document.getElementById('da-start');if(b)b.focus()};
ACTS.dadel=function(){var d=S.da;d.busy='del';render();setTimeout(function(){d.busy=null;d.done=true;render()},600)};
CHG['da-ack']=function(el){S.da.ack=el.checked;var b=document.querySelector('[data-act=dadel]');if(b)b.disabled=!el.checked};
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&S.route==='datos'&&S.da.confirm&&!S.da.busy)ACTS.dano()});
