/* /app/route-catalog y /app/route-catalog/roles/:roleKey «Catálogo de rutas» (ES-27, vista de la persona; el gestor de administración va aparte).
   Los textos de interfaz son los reales (routeCatalog/copy.ts). TODO el contenido del catálogo (fichas, fuentes, ofertas, recursos, mercados, contextos) es de EJEMPLO inventado para mostrar la maqueta:
   las direcciones usan el dominio reservado .invalid y la pantalla siempre muestra el aviso «Contenido de prueba». No hay porcentajes ni afirmaciones de reemplazo por IA (el servidor las rechaza).
   Mejora propuesta: los enlaces externos avisan «se abre en una pestaña nueva». */
copy({
 cg_t:'Catálogo de rutas',cg_intro:'Explora fichas ocupacionales, fuentes y recursos. No son recomendaciones personalizadas.',cg_back:'Volver al inicio',cg_back_c:'Volver al catálogo',
 cg_version:'Versión',cg_pub:'Publicada el',cg_synth:'Contenido de prueba; no describe ofertas ni precios reales.',cg_market:'Mercado',cg_lang_f:'Idioma del recurso',cg_ctx:'Contexto editorial',cg_all:'Todos',
 cg_profile:'Ver ficha',cg_unknown:'Por confirmar',cg_ver_t:'Requiere verificación',cg_src_cur:'Consulta las fechas y fuentes de esta ficha.',cg_none_f:'No hay resultados con estos filtros.',cg_clear:'Quitar filtros',
 cg_load:'Cargando catálogo…',cg_err:'No pudimos cargar el catálogo.',cg_retry:'Reintentar',cg_empty:'El catálogo aún no está disponible.',cg_nf:'Ficha no encontrada.',cg_session:'Tu sesión venció. Inicia sesión para continuar.',cg_login:'Iniciar sesión',
 cg_review:'Revisión de dominio registrada el',cg_tasks:'Tareas y exposición a IA',cg_ai:'Exposición a IA',cg_sourced:'Con fuente',cg_hyp:'Hipótesis',cg_barriers:'Barreras',cg_caps:'Capacidades requeridas',cg_req:'Requisito del rol, no evaluación personal.',
 cg_essential:'Esencial',cg_optional:'Opcional',cg_lic:'Habilitación por confirmar; la residencia no acredita elegibilidad.',cg_sources:'Fuentes',cg_stale:'Fuente desactualizada',cg_offers:'Ofertas',cg_checked:'Comprobada el',cg_expired:'Verificación vencida',cg_unver:'No verificada',
 cg_salary:'Salario no publicado',cg_resources:'Recursos',cg_course:'Completar un curso no acredita competencia.',cg_purpose:'Propósito',cg_duration:'Duración',cg_min:'minutos',cg_price:'Precio por confirmar',cg_none:'Sin elementos',
 cg_onsite:'Presencial',cg_hybrid:'Híbrida',cg_remote:'Remota',cg_introductory:'Inicial',cg_intermediate:'Intermedio',cg_ext:'se abre en una pestaña nueva',cg_consulted:'Consultada el',cg_ind:'Industria',
 cg_p:'Prototipo:',cg_p0:'ver normal',cg_p1:'ver cargando',cg_p2:'ver error',cg_p3:'ver catálogo vacío',cg_p4:'ver sesión vencida',cg_p5:'ver ficha inexistente',
 cg_l_es:'Español',cg_l_en:'Inglés',cg_ctx1:'Transición desde otro sector',cg_ctx2:'Primer empleo formal',
 cg_r1:'Analista de datos junior (ejemplo)',cg_r2:'Coordinador/a de proyectos (ejemplo)',cg_r3:'Docente de secundaria (ejemplo)',
 cg_i1:'Servicios profesionales',cg_i2:'Construcción y obras',cg_i3:'Educación',
 cg_t11:'Limpiar y ordenar tablas de datos de distintas áreas.',cg_t12:'Preparar informes periódicos y explicarlos a quien decide.',cg_t13:'Revisar con el equipo si una cifra tiene sentido antes de publicarla.',
 cg_t21:'Coordinar plazos y responsables entre varios equipos.',cg_t22:'Registrar acuerdos y hacer seguimiento de pendientes.',
 cg_t31:'Preparar y dar clases a grupos de 25 a 35 estudiantes.',cg_t32:'Acompañar la convivencia y comunicarse con las familias.',
 cg_n11:'La preparación de informes puede apoyarse en herramientas automáticas; la interpretación y la conversación con quien decide siguen siendo de la persona.',cg_n21:'El seguimiento de tareas puede apoyarse en herramientas; la negociación de plazos sigue siendo humana.',
 cg_b11:'Se piden pruebas técnicas de SQL en varios procesos de selección.',cg_b12:'Las vacantes suelen pedir portafolio con casos propios.',cg_b21:'Algunas organizaciones piden una certificación de gestión de proyectos.',cg_b31:'Requiere homologar el título y cumplir requisitos de habilitación según el país.',
 cg_pr1:'Oferta de ejemplo: analista de datos',cg_pr2:'Oferta de ejemplo: coordinación de obra',cg_org:'Organización de ejemplo',
 cg_rs1:'Recurso de ejemplo: introducción a hojas de cálculo',cg_rs2:'Recurso de ejemplo: lectura sobre gestión de plazos',cg_pv:'Proveedor de ejemplo',
 cg_rsp1:'Practicar la limpieza de datos con un caso pequeño.',cg_rsp2:'Revisar vocabulario y técnicas de planificación.',
 routes:{catalogo:'Catálogo de rutas',catalogo_ficha:'Ficha del catálogo'}
},{
 cg_t:'Route catalog',cg_intro:'Explore occupational profiles, sources and resources. These are not personalized recommendations.',cg_back:'Back to dashboard',cg_back_c:'Back to catalog',
 cg_version:'Version',cg_pub:'Published on',cg_synth:'Test content; it does not describe real vacancies or prices.',cg_market:'Market',cg_lang_f:'Resource language',cg_ctx:'Editorial context',cg_all:'All',
 cg_profile:'View profile',cg_unknown:'To be confirmed',cg_ver_t:'Verification needed',cg_src_cur:'Check this profile’s dates and sources.',cg_none_f:'No results match these filters.',cg_clear:'Clear filters',
 cg_load:'Loading catalog…',cg_err:'We could not load the catalog.',cg_retry:'Retry',cg_empty:'The catalog is not available yet.',cg_nf:'Profile not found.',cg_session:'Your session expired. Sign in to continue.',cg_login:'Sign in',
 cg_review:'Domain review recorded on',cg_tasks:'Tasks and AI exposure',cg_ai:'AI exposure',cg_sourced:'Sourced',cg_hyp:'Hypothesis',cg_barriers:'Barriers',cg_caps:'Required capabilities',cg_req:'Role requirement, not a personal assessment.',
 cg_essential:'Essential',cg_optional:'Optional',cg_lic:'Licensing to be confirmed; residence does not establish eligibility.',cg_sources:'Sources',cg_stale:'Outdated source',cg_offers:'Vacancies',cg_checked:'Checked on',cg_expired:'Verification expired',cg_unver:'Unverified',
 cg_salary:'Salary not published',cg_resources:'Resources',cg_course:'Completing a course does not demonstrate competence.',cg_purpose:'Purpose',cg_duration:'Duration',cg_min:'minutes',cg_price:'Price to be confirmed',cg_none:'No items',
 cg_onsite:'On-site',cg_hybrid:'Hybrid',cg_remote:'Remote',cg_introductory:'Introductory',cg_intermediate:'Intermediate',cg_ext:'opens in a new tab',cg_consulted:'Consulted on',cg_ind:'Industry',
 cg_p:'Prototype:',cg_p0:'see normal',cg_p1:'see loading',cg_p2:'see error',cg_p3:'see empty catalog',cg_p4:'see expired session',cg_p5:'see missing profile',
 cg_l_es:'Spanish',cg_l_en:'English',cg_ctx1:'Career change from another sector',cg_ctx2:'First formal job',
 cg_r1:'Junior data analyst (example)',cg_r2:'Project coordinator (example)',cg_r3:'Secondary school teacher (example)',
 cg_i1:'Professional services',cg_i2:'Construction and works',cg_i3:'Education',
 cg_t11:'Clean and organize data tables from different areas.',cg_t12:'Prepare periodic reports and explain them to decision makers.',cg_t13:'Check with the team that a figure makes sense before publishing it.',
 cg_t21:'Coordinate deadlines and owners across several teams.',cg_t22:'Record agreements and follow up on pending items.',
 cg_t31:'Prepare and teach classes of 25 to 35 students.',cg_t32:'Support classroom coexistence and communicate with families.',
 cg_n11:'Report preparation can be supported by automated tools; interpretation and the conversation with the decision maker remain the person’s.',cg_n21:'Task tracking can be supported by tools; negotiating deadlines remains human.',
 cg_b11:'Several selection processes ask for SQL technical tests.',cg_b12:'Vacancies often ask for a portfolio with your own cases.',cg_b21:'Some organizations ask for a project management certification.',cg_b31:'Requires degree recognition and licensing requirements that depend on the country.',
 cg_pr1:'Example vacancy: data analyst',cg_pr2:'Example vacancy: site coordination',cg_org:'Example organization',
 cg_rs1:'Example resource: introduction to spreadsheets',cg_rs2:'Example resource: reading on deadline management',cg_pv:'Example provider',
 cg_rsp1:'Practice data cleaning with a small case.',cg_rsp2:'Review planning vocabulary and techniques.',
 routes:{catalogo:'Route catalog',catalogo_ficha:'Catalog profile'}
});
addRoutes('g_per',['catalogo','catalogo_ficha']);
SEC.herramientas=(SEC.herramientas||[]).concat(['catalogo','catalogo_ficha']);
var CGR=[
 {k:'analista',n:1,mk:'CO',lang:['es','en'],mod:['hybrid','remote'],ctx:['ctx1'],ver:false,reg:false,tasks:[[1,'sourced','n11','s1'],[2,'hyp',null,null],[3,'hyp',null,null]],bar:['b11','b12'],caps:[[1,'essential'],[6,'essential'],[3,'optional']],src:['s1','s2'],off:[['pr1','current','2026-10-20',true]],res:['rs1'],rev:'2026-10-14'},
 {k:'coordinacion',n:2,mk:'ES',lang:['es'],mod:['onsite','hybrid'],ctx:['ctx1','ctx2'],ver:true,reg:false,tasks:[[1,'sourced','n21','s1'],[2,'hyp',null,null]],bar:['b21'],caps:[[5,'essential'],[3,'essential'],[7,'optional']],src:['s1'],off:[['pr2','expired','2026-09-02',false]],res:['rs2'],rev:null},
 {k:'docente',n:3,mk:'CO',lang:['es'],mod:['onsite'],ctx:['ctx1'],ver:false,reg:true,tasks:[[1,'hyp',null,null],[2,'hyp',null,null]],bar:['b31'],caps:[[3,'essential'],[7,'essential'],[0,'optional']],src:['s2'],off:[],res:[],rev:'2026-10-02'}];
var CGS={s1:{title:'Fuente de ejemplo A',url:'https://fuente-ejemplo-a.invalid/ficha',at:'2026-10-12',lang:'es',stale:false,name:'A'},s2:{title:'Fuente de ejemplo B',url:'https://fuente-ejemplo-b.invalid/informe',at:'2026-03-01',lang:'es',stale:true,name:'B'}};
var CGRS={rs1:{n:'rs1',pv:'pv',lang:'es',lvl:'introductory',p:'rsp1',min:90,price:false,url:'https://recurso-ejemplo.invalid/hojas'},rs2:{n:'rs2',pv:'pv',lang:'en',lvl:'intermediate',p:'rsp2',min:null,price:false,url:'https://recurso-ejemplo-b.invalid/lectura'}};
S.cg={mode:'ok',role:'analista',mk:'',lg:'',cx:''};
function cgL(c){return t('cg_l_'+c)}
function cgDate(s){return new Date(s+'T12:00:00').toLocaleDateString(S.lang==='es'?'es-CO':'en',{day:'numeric',month:'short',year:'numeric'})}
function cgHost(u){return u.replace(/^https?:\/\//,'').split('/')[0]}
function cgExt(u,label){return'<a href="'+u+'" target="_blank" rel="noopener noreferrer">'+label+' <span aria-hidden="true">↗</span><span class="sr"> · '+cgHost(u)+' · '+t('cg_ext')+'</span></a><span class="small muted" aria-hidden="true"> · '+cgHost(u)+'</span>'}
function cgHead(){return'<div style="padding:1.2rem 0 .6rem"><div class="row" style="margin:0 0 .8rem"><a class="btn ghost" href="#'+(S.route==='catalogo'?'herramientas':'catalogo')+'">← '+t(S.route==='catalogo'?'cg_back':'cg_back_c')+'</a></div>'}
function cgProto(){var m=[['0','cg_p0'],['load','cg_p1'],['err','cg_p2'],['empty','cg_p3'],['session','cg_p4']];return'<p class="small muted" style="margin:1.4rem 0">'+t('cg_p')+' '+m.map(function(i){return'<button class="lnk" data-act="cgsim" data-v="'+i[0]+'">'+t(i[1])+'</button>'}).join(' · ')+(S.route==='catalogo'?' · <button class="lnk" data-act="cgsim" data-v="nf">'+t('cg_p5')+'</button>':'')+'</p>'}
function cgGate(h){var m=S.cg.mode;
 if(m==='load')return h+'<div role="status" style="padding:2rem 0"><div class="pulse" aria-hidden="true"></div><p>'+t('cg_load')+'</p></div>'+cgProto()+'</main>';
 if(m==='err')return h+'<div class="banner bad" role="alert" id="cg-st" tabindex="-1"><b>'+t('cg_err')+'</b><div class="row"><button class="btn" data-act="cgretry">'+t('cg_retry')+'</button></div></div>'+cgProto()+'</main>';
 if(m==='empty')return h+'<p role="status" id="cg-st" tabindex="-1">'+t('cg_empty')+'</p>'+cgProto()+'</main>';
 if(m==='session')return h+'<div class="banner bad" role="alert"><b>'+t('cg_session')+'</b><div class="row"><a class="btn" href="#entrar">'+t('cg_login')+'</a></div></div>'+cgProto()+'</main>';
 return null}
function cgMeta(){return'<p class="muted">'+t('cg_version')+' 3 · '+t('cg_pub')+' '+cgDate('2026-10-20')+'</p><p class="banner" role="note">'+t('cg_synth')+'</p>'}
V.catalogo=function(){var c=S.cg,h='<main class="narrow">'+cgHead()+'<h1 class="s">'+t('cg_t')+'</h1><p class="muted" style="max-width:38rem">'+t('cg_intro')+'</p></div>';
 var g=cgGate(h);if(g)return g;
 var mks=['CO','ES'],lgs=['es','en'],cxs=['ctx1','ctx2'];
 var f=function(id,lbl,val,opts,nm){return'<div class="fld"><label for="'+id+'">'+t(lbl)+'</label><select id="'+id+'"><option value="">'+t('cg_all')+'</option>'+opts.map(function(o){return'<option value="'+o+'"'+(val===o?' selected':'')+'>'+(nm?t('cg_'+o):o)+'</option>'}).join('')+'</select></div>'};
 var list=CGR.filter(function(r){return(!c.mk||r.mk===c.mk)&&(!c.cx||r.ctx.indexOf(c.cx)>-1)&&(!c.lg||r.res.some(function(k){return CGRS[k].lang===c.lg}))});
 h+=cgMeta()+'<div class="three" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));gap:0 1rem">'+f('cg-mk','cg_market',c.mk,mks)+f('cg-lg','cg_lang_f',c.lg,lgs)+f('cg-cx','cg_ctx',c.cx,cxs,true)+'</div>'+
  '<p role="status" aria-live="polite" class="small muted" id="cg-n">'+list.length+' / '+CGR.length+'</p>';
 h+='<div class="stack">'+list.map(function(r){var id='cgc-'+r.k;
  return'<article class="card" aria-labelledby="'+id+'"><h2 id="'+id+'" style="font-size:1.4rem">'+t('cg_r'+r.n)+'</h2><p>'+r.mk+' · '+r.lang.map(cgL).join(', ')+'</p><p class="muted">'+t(r.ver?'cg_ver_t':'cg_src_cur')+'</p><p><span class="chip">'+t('cg_synth').split(';')[0]+'</span></p><div class="row"><a class="btn" href="#catalogo_ficha" data-act="cgopen" data-v="'+r.k+'" aria-describedby="'+id+'">'+t('cg_profile')+'</a></div></article>'}).join('')+'</div>';
 if(!list.length)h+='<p>'+t('cg_none_f')+'</p><div class="row"><button class="btn ghost" data-act="cgclear">'+t('cg_clear')+'</button></div>';
 return h+cgProto()+'</main>'};
V.catalogo_ficha=function(){var c=S.cg,r=CGR.filter(function(x){return x.k===c.role})[0],h='<main class="narrow">'+cgHead()+'<h1 class="s" id="cg-h" tabindex="-1">'+(r?t('cg_r'+r.n):t('cg_t'))+'</h1></div>';
 var g=cgGate(h);if(g)return g;
 if(!r)return h+'<p role="status">'+t('cg_nf')+'</p>'+cgProto()+'</main>';
 h+='<p>'+t('cg_i'+r.n)+' · '+r.mk+'</p><p class="muted">'+r.lang.map(cgL).join(', ')+' · '+r.mod.map(function(m){return t('cg_'+m)}).join(', ')+'</p><p class="banner" role="note">'+t('cg_synth')+'</p>';
 if(r.rev)h+='<p class="small muted">'+t('cg_review')+' '+cgDate(r.rev)+'</p>';
 if(r.ver)h+='<p class="banner"><b>'+t('cg_ver_t')+'</b></p>';
 var card=function(id,title,body){return'<section class="card" aria-labelledby="cgd-'+id+'"><h2 id="cgd-'+id+'" style="font-size:1.3rem">'+t(title)+'</h2>'+body+'</section>'};
 var s='<div class="stack">';
 s+=card('tasks','cg_tasks',r.tasks.map(function(k){return'<div class="item"><p style="margin:0">'+t('cg_t'+r.n+k[0])+'</p><p class="small muted" style="margin:0">'+t('cg_ai')+': '+t(k[1]==='sourced'?'cg_sourced':'cg_hyp')+(k[2]?' · '+t('cg_'+k[2]):'')+(k[3]?' · '+CGS[k[3]].title:'')+'</p></div>'}).join(''));
 s+=card('bar','cg_barriers',r.bar.length?'<ul>'+r.bar.map(function(b){return'<li>'+t('cg_'+b)+'</li>'}).join('')+'</ul>':'<p>'+t('cg_none')+'</p>')+
  card('caps','cg_caps','<p class="muted">'+t('cg_req')+'</p><ul>'+r.caps.map(function(k){return'<li>'+capName(k[0])+' · '+t(k[1]==='essential'?'cg_essential':'cg_optional')+'</li>'}).join('')+'</ul>');
 if(r.reg)s+='<section class="card" aria-labelledby="cgd-lic"><h2 id="cgd-lic" class="sr">'+t('cg_lic')+'</h2><p class="banner" style="margin:0"><b>'+t('cg_lic')+'</b></p></section>';
 s+=card('src','cg_sources',r.src.map(function(k){var o=CGS[k];return'<article class="item"><p style="margin:0">'+cgExt(o.url,o.title)+'</p><p class="small muted" style="margin:0">'+t('cg_consulted')+' '+cgDate(o.at)+' · '+cgL(o.lang)+'</p>'+(o.stale?'<p class="err" style="margin:0">'+t('cg_stale')+'</p>':'')+'</article>'}).join(''));
 s+=card('off','cg_offers',r.off.length?r.off.map(function(o){var st=o[1];return'<article class="item"><h3 style="font-size:1.1rem;margin:0">'+cgExt('https://oferta-ejemplo.invalid/'+o[0],t('cg_'+o[0]))+'</h3><p class="small" style="margin:0">'+t('cg_org')+' · '+r.mk+' · '+cgL(r.lang[0])+' · '+t('cg_'+r.mod[0])+'</p><p class="small muted" style="margin:0">'+(st==='current'?t('cg_checked')+' '+cgDate(o[2]):t(st==='expired'?'cg_expired':'cg_unver'))+(o[3]?' · '+t('cg_salary'):'')+'</p></article>'}).join(''):'<p>'+t('cg_none')+'</p>');
 s+=card('res','cg_resources','<p class="muted">'+t('cg_course')+'</p>'+(r.res.length?r.res.map(function(k){var o=CGRS[k];return'<article class="item"><h3 style="font-size:1.1rem;margin:0">'+cgExt(o.url,t('cg_'+o.n))+'</h3><p class="small" style="margin:0">'+t('cg_'+o.pv)+' · '+cgL(o.lang)+' · '+t('cg_'+o.lvl)+'</p><p style="margin:0">'+t('cg_purpose')+': '+t('cg_'+o.p)+'</p><p class="small muted" style="margin:0">'+t('cg_duration')+': '+(o.min?o.min+' '+t('cg_min'):t('cg_unknown'))+' · '+t('cg_price')+'</p></article>'}).join(''):'<p>'+t('cg_none')+'</p>'));
 return h+s+'</div>'+cgProto()+'</main>'};
ACTS.cgsim=function(b,v){var c=S.cg;if(v==='nf'){c.role='no-existe';if(location.hash==='#catalogo_ficha')render();else location.hash='catalogo_ficha';return}c.mode=v==='0'?'ok':v;if(S.route==='catalogo_ficha'&&v==='0'&&c.role==='no-existe')c.role='analista';render()};
ACTS.cgretry=function(){var c=S.cg;c.mode='load';render();setTimeout(function(){c.mode=S.mode==='ok'?'ok':'err';render();bjFoc(c.mode==='ok'?'cg-n':'cg-st')},600)};
ACTS.cgopen=function(b,v){S.cg.role=v};
ACTS.cgclear=function(){var c=S.cg;c.mk=c.lg=c.cx='';render();bjFoc('cg-mk')};
CHG['cg-mk']=function(el){S.cg.mk=el.value;render();bjFoc('cg-mk')};CHG['cg-lg']=function(el){S.cg.lg=el.value;render();bjFoc('cg-lg')};CHG['cg-cx']=function(el){S.cg.cx=el.value;render();bjFoc('cg-cx')};
