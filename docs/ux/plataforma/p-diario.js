/* /app/diary, /app/diary/new, /app/diary/:id · «Diario de campo».
   Estados reales que cubre: lista vacía, nueva, lectura, edición con cambios sin guardar, guardando,
   guardado sin confirmar (uncertain), eliminar con confirmación, salir sin guardar. */
copy({
 dr_eye:'Espacio / Diario',dr_t:'Diario de campo',dr_priv:'Lo que escribes aquí es solo tuyo. No se comparte con nadie sin que tú lo autorices.',
 dr_new:'Nueva entrada',dr_list:'Tus entradas',dr_empty:'Aún no tienes entradas. Escribe la primera cuando quieras.',dr_sel:'Elige una entrada de la lista o escribe una nueva.',
 dr_date:'Fecha',dr_ct:'Qué quieres dejar escrito',dr_count:'{n} de 10.000 caracteres',dr_manual:'Se guarda cuando tú lo decides.',dr_draftw:'Si sales sin guardar, se pierde lo que escribiste.',
 dr_save:'Guardar entrada',dr_cancel:'Cancelar',dr_edit:'Editar',dr_del:'Eliminar',dr_use:'Usar en una conversación',dr_upd:'Última edición: {d}',
 dr_st_new:'Entrada nueva',dr_st_dirty:'Cambios sin guardar',dr_st_saved:'Guardada',dr_st_saving:'Guardando…',
 dr_e_date:'Elige una fecha.',dr_e_txt:'Escribe algo para guardar la entrada.',
 dr_unc:'No pudimos confirmar si se guardó',dr_unc_p:'Revisa antes de guardar otra vez, para no duplicarla.',dr_insp:'Revisar si se guardó',dr_found:'Sí quedó guardada.',
 dr_dd_t:'¿Eliminar esta entrada?',dr_dd_p:'No se puede deshacer. Lo que escribiste se borra de tu diario.',dr_dd_ok:'Eliminar entrada',dr_dd_no:'Conservarla',
 dr_dc_t:'¿Salir sin guardar?',dr_dc_p:'Lo que escribiste se pierde.',dr_dc_ok:'Descartar cambios',dr_dc_no:'Seguir escribiendo',dr_deleted:'Entrada eliminada.',dr_savedt:'Entrada guardada.',
 dr_seed1:'Hoy tuve que explicar el cambio de turno a alguien nuevo. Me di cuenta de que ya sé el orden en que se hacen las cosas.',dr_seed2:'La reunión de la mañana se alargó. Anoté tres cosas que quiero retomar con calma.',
 routes:{diario:'Diario'}
},{
 dr_eye:'Space / Diary',dr_t:'Field diary',dr_priv:'What you write here is yours alone. It is not shared with anyone unless you authorise it.',
 dr_new:'New entry',dr_list:'Your entries',dr_empty:'You have no entries yet. Write the first one whenever you want.',dr_sel:'Pick an entry from the list or write a new one.',
 dr_date:'Date',dr_ct:'What you want to put in writing',dr_count:'{n} of 10,000 characters',dr_manual:'It is saved when you decide.',dr_draftw:'If you leave without saving, what you wrote is lost.',
 dr_save:'Save entry',dr_cancel:'Cancel',dr_edit:'Edit',dr_del:'Delete',dr_use:'Use in a conversation',dr_upd:'Last edited: {d}',
 dr_st_new:'New entry',dr_st_dirty:'Unsaved changes',dr_st_saved:'Saved',dr_st_saving:'Saving…',
 dr_e_date:'Pick a date.',dr_e_txt:'Write something to save the entry.',
 dr_unc:'We could not confirm it was saved',dr_unc_p:'Check before saving again, so it is not duplicated.',dr_insp:'Check if it was saved',dr_found:'Yes, it was saved.',
 dr_dd_t:'Delete this entry?',dr_dd_p:'This cannot be undone. What you wrote is removed from your diary.',dr_dd_ok:'Delete entry',dr_dd_no:'Keep it',
 dr_dc_t:'Leave without saving?',dr_dc_p:'What you wrote is lost.',dr_dc_ok:'Discard changes',dr_dc_no:'Keep writing',dr_deleted:'Entry deleted.',dr_savedt:'Entry saved.',
 dr_seed1:'Today I had to explain the shift handover to someone new. I realised I already know the order things get done in.',dr_seed2:'The morning meeting ran long. I noted three things I want to come back to calmly.',
 routes:{diario:'Diary'}
});
addRoutes('g_per',['diario']);
S.dr={list:[{id:2,date:'2026-11-04',txt:'dr_seed1',seed:1},{id:1,date:'2026-11-02',txt:'dr_seed2',seed:1}],sel:null,editing:false,date:'',txt:'',dlg:null,unc:false,eD:false,eT:false,busy:false,seq:2,base:null};
function drText(e){return e.seed?t(e.txt):e.txt}
function drDate(d){try{return new Date(d+'T12:00:00').toLocaleDateString(S.lang==='es'?'es-CO':'en',{day:'numeric',month:'long',year:'numeric'})}catch(x){return d}}
function drToday(){var n=new Date();return new Date(n.getTime()-n.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function drDirty(){var d=S.dr;if(!d.editing)return false;if(d.sel==='new')return d.txt.trim().length>0;var e=d.list.filter(function(x){return x.id===d.sel})[0];return !!e&&(d.date!==e.date||d.txt!==drText(e))}
function drStatus(){var d=S.dr;if(d.busy)return t('dr_st_saving');if(d.editing)return drDirty()?t('dr_st_dirty'):(d.sel==='new'?t('dr_st_new'):t('dr_st_saved'));return d.sel?t('dr_st_saved'):''}
V.diario=function(){var d=S.dr,cur=d.list.filter(function(x){return x.id===d.sel})[0];
 var rows=d.list.length?'<ul class="dlist">'+d.list.map(function(e){return'<li><button type="button" data-act="dsel" data-v="'+e.id+'"'+(d.sel===e.id?' aria-current="true"':'')+'><b>'+esc(drDate(e.date))+'</b><span>'+esc(drText(e).slice(0,70))+'…</span></button></li>'}).join('')+'</ul>':'<p class="muted">'+t('dr_empty')+'</p>';
 var sheet;
 if(!d.sel)sheet='<p class="nm">'+t('dr_sel')+'</p>';
 else if(d.editing){var n=d.txt.length.toLocaleString(S.lang==='es'?'es-CO':'en');
  sheet='<form id="f-dr" novalidate><div class="fld" style="margin-top:0"><label for="dr-date">'+t('dr_date')+'</label><input id="dr-date" type="date" value="'+esc(d.date)+'" aria-invalid="'+d.eD+'"'+(d.busy||d.unc?' disabled':'')+'><p class="err" role="alert"'+(d.eD?'':' hidden')+'>'+t('dr_e_date')+'</p></div>'+
  '<div class="fld"><label for="dr-txt">'+t('dr_ct')+'</label><textarea id="dr-txt" class="paper" rows="9" maxlength="10000" aria-invalid="'+d.eT+'"'+(d.busy||d.unc?' disabled':'')+'>'+esc(d.txt)+'</textarea><p class="err" role="alert"'+(d.eT?'':' hidden')+'>'+t('dr_e_txt')+'</p></div>'+
  '<div class="rowx small muted"><span id="dr-count">'+t('dr_count',{n:n})+'</span><span>'+t('dr_manual')+'</span></div><p class="small muted" style="margin:.2rem 0">'+t('dr_draftw')+'</p>'+
  '<div class="row"><button class="btn" type="submit"'+(d.busy||d.unc||!drDirty()?' disabled':'')+' id="dr-save">'+t('dr_save')+'</button><button class="btn ghost" type="button" data-act="dcancel"'+(d.busy?' disabled':'')+'>'+t('dr_cancel')+'</button></div></form>'}
 else sheet='<article><h2 style="margin:0">'+esc(drDate(cur.date))+'</h2><p class="small muted" style="margin:.2rem 0 1rem">'+t('dr_upd',{d:drDate(cur.date)})+'</p><p class="paper read">'+esc(drText(cur))+'</p><div class="row"><button class="btn ghost" data-act="dedit">'+t('dr_edit')+'</button><button class="btn ghost" data-act="ddel">'+t('dr_del')+'</button><a class="lnk" href="#chat" style="text-decoration:none">'+t('dr_use')+'</a></div></article>';
 var unc=d.unc?'<div class="banner bad" role="alert"><b>'+t('dr_unc')+'</b>'+t('dr_unc_p')+'<div class="row"><button class="btn" data-act="dinsp">'+t('dr_insp')+'</button></div></div>':'';
 var dlg='';if(d.dlg){var del=d.dlg==='delete';dlg='<div class="scrim"><div class="dlg" role="alertdialog" aria-modal="true" aria-labelledby="dlt" aria-describedby="dlp"><h2 id="dlt" style="font-size:1.4rem">'+t(del?'dr_dd_t':'dr_dc_t')+'</h2><p id="dlp">'+t(del?'dr_dd_p':'dr_dc_p')+'</p><div class="row"><button class="btn'+(del?' danger':'')+'" id="dlg-ok" data-act="dok">'+t(del?'dr_dd_ok':'dr_dc_ok')+'</button><button class="btn ghost" data-act="dno">'+t(del?'dr_dd_no':'dr_dc_no')+'</button></div></div></div>'}
 return'<main><div style="padding:1.2rem 0 .6rem"><p class="tag">'+t('dr_eye')+'</p><h1 class="s" style="margin:.3rem 0 .5rem">'+t('dr_t')+'</h1><p class="muted" style="margin:0;max-width:40rem">'+t('dr_priv')+'</p></div>'+
 '<div class="diario"><aside aria-label="'+t('dr_list')+'"><button class="btn" data-act="dnew" style="width:100%">'+t('dr_new')+'</button><p class="tag" style="margin:1rem 0 .4rem">'+t('dr_list')+'</p>'+rows+'</aside>'+
 '<section class="sheetp" aria-live="polite"><p class="tag" id="dr-st" role="status">'+drStatus()+'</p>'+unc+sheet+'</section></div>'+dlg+'</main>'};
function drFocus(){var b=document.getElementById('dlg-ok');if(b)b.focus()}
ACTS.dnew=function(){var d=S.dr;if(drDirty()){d.dlg='cancel';d.after='new';render();drFocus();return}d.sel='new';d.editing=true;d.date=drToday();d.txt='';d.eD=d.eT=false;d.unc=false;render();var f=document.getElementById('dr-txt');if(f)f.focus()};
ACTS.dsel=function(b,v){var d=S.dr;if(drDirty()){d.dlg='cancel';d.after=v;render();drFocus();return}d.sel=+v;d.editing=false;d.unc=false;render()};
ACTS.dedit=function(){var d=S.dr,e=d.list.filter(function(x){return x.id===d.sel})[0];d.editing=true;d.date=e.date;d.txt=drText(e);d.eD=d.eT=false;render();document.getElementById('dr-txt').focus()};
ACTS.dcancel=function(){var d=S.dr;if(drDirty()){d.dlg='cancel';d.after=null;render();drFocus();return}if(d.sel==='new')d.sel=null;d.editing=false;render()};
ACTS.ddel=function(){S.dr.dlg='delete';render();drFocus()};
ACTS.dno=function(){S.dr.dlg=null;render()};
ACTS.dok=function(){var d=S.dr,k=d.dlg;d.dlg=null;
 if(k==='delete'){d.list=d.list.filter(function(x){return x.id!==d.sel});d.sel=null;d.editing=false;render();toast(t('dr_deleted'));return}
 var next=d.after;d.editing=false;d.txt='';d.eD=d.eT=false;if(d.sel==='new')d.sel=null;
 if(next==='new'){d.sel='new';d.editing=true;d.date=drToday()}else if(next)d.sel=+next;render()};
ACTS.dinsp=function(){var d=S.dr;d.unc=false;d.editing=false;
 if(d.sel==='new'){var id=++d.seq;d.list.unshift({id:id,date:d.date,txt:d.txt});d.sel=id}
 else d.list.forEach(function(x){if(x.id===d.sel){x.date=d.date;x.txt=d.txt;x.seed=0}});
 render();toast(t('dr_found'))};
SUBS['f-dr']=function(){var d=S.dr;d.eD=!d.date;d.eT=!d.txt.trim();if(d.eD||d.eT){render();document.getElementById(d.eD?'dr-date':'dr-txt').focus();return}
 d.busy=true;render();
 setTimeout(function(){d.busy=false;
  if(S.mode!=='ok'){d.unc=true;render();return}
  if(d.sel==='new'){var id=++d.seq;d.list.unshift({id:id,date:d.date,txt:d.txt});d.sel=id}
  else d.list.forEach(function(x){if(x.id===d.sel){x.date=d.date;x.txt=d.txt;x.seed=0}});
  d.editing=false;render();toast(t('dr_savedt'))},500)};
document.getElementById('app').addEventListener('input',function(e){var d=S.dr;
 if(e.target.id==='dr-txt'){d.txt=e.target.value;var c=document.getElementById('dr-count');if(c)c.textContent=t('dr_count',{n:d.txt.length.toLocaleString(S.lang==='es'?'es-CO':'en')});d.eT=false}
 else if(e.target.id==='dr-date'){d.date=e.target.value;d.eD=false}
 else return;
 var s=document.getElementById('dr-save');if(s)s.disabled=!drDirty()||d.busy;var st=document.getElementById('dr-st');if(st)st.textContent=drStatus()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&S.route==='diario'&&S.dr.dlg){S.dr.dlg=null;render()}});
