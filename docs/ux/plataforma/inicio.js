/* Arranque: va al final, cuando todas las pantallas ya se registraron. */
(function(){var m=['auto','light','dark'],i=0,b=document.getElementById('th');
 b.addEventListener('click',function(){i=(i+1)%3;var r=document.documentElement;if(m[i]==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',m[i]);b.textContent='Tema: '+(m[i]==='auto'?'auto':m[i]==='light'?'claro':'oscuro');drawAll()})})();
addRoutes('g_pub',['portada','registro','entrar','recuperar']);addRoutes('g_per',['inicio','evidencias','chat','planes']);addRoutes('g_sys',['estados']);
route();
