(() => {
 const auth=window.SimounSync, form=document.getElementById('ownerLogin'), message=document.getElementById('ownerStatus');
 const scripts=["bloqueo.js","app.js?v=20261125-orden-hora-v1","monitoreos.js?v=20261123-6","captura-rapida.js?v=20261019-6","reportes-categorias.js?v=20261123-5","expedientes-resumen.js?v=20261125-orden-automatico-v2","jornada.js?v=20261125-tablero-dinamico","servicios-clientes.js?v=20261125-orden-hora-v1","vendor/html2pdf.bundle.min.js?v=0.14.0","documentos.js?v=20261123-7","simoun-logo-data.js?v=20261117-1","cotizacion-diseno.js?v=20261117-5","recibos.js?v=20261123-7","documentos-unificados.js?v=20261117-2"];
 let started=false;
 function leave(){document.documentElement.style.visibility='hidden';location.reload();}
 window.addEventListener('storage',e=>{if(started && (e.key===null||e.key==='simoun_sync_session_v1')&&!auth.loggedIn())leave()});
 async function enter(){
   if(started||!await auth.verifyOwner())return;
   const res=await fetch('./interfaz-operativa.json?v=2');if(!res.ok)throw Error('Carga');
   const html=await res.json();
   if(!html.includes('id="jornada"')||!auth.loggedIn())throw Error('Acceso');
   started=true;
   document.body.insertAdjacentHTML('beforeend',html);
   for(const url of scripts){
     await new Promise((ok,fail)=>{const script=document.createElement('script');script.src=url;script.onload=ok;script.onerror=fail;document.body.append(script)});
   }
   if(!auth.loggedIn())return leave();
   document.getElementById('privateGate').remove();
   if(document.readyState==='complete')window.dispatchEvent(new Event('load'));
   const check=async()=>{try{if(!await auth.verifyOwner())leave()}catch{leave()}};
   window.addEventListener('pageshow',e=>{if(e.persisted)check()});
   window.addEventListener('focus',check);
   setInterval(check,60000);
 }
 function denied(){if(started)return leave();message.textContent='Acceso denegado. Revisa tus datos y tu conexión.';}
 form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;
   try{await auth.signIn(form.elements.email.value.trim(),form.elements.password.value);form.elements.password.value='';await enter()}catch{form.elements.password.value='';denied()}finally{button.disabled=false}};
 enter().catch(denied);
})();