const CACHE='simoun-pwa-v27';
const ASSETS=['./','./index.html','./app.js','./sync.js','./monitoreos.js','./captura-rapida.js','./citas-coordinacion.js','./cobros-facturas.js','./reporte-filtro-jefe.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const req=event.request;
  const url=new URL(req.url);
  if(req.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/')){
    event.respondWith(fetch(req).then(async res=>{
      const type=res.headers.get('content-type')||'';
      if(!type.includes('text/html'))return res;
      let html=await res.text();
      if(!html.includes('reporte-filtro-jefe.js'))html=html.replace('</body>','<script src="./reporte-filtro-jefe.js?v=20261021-1"></script></body>');
      const headers=new Headers(res.headers);headers.delete('content-length');
      return new Response(html,{status:res.status,statusText:res.statusText,headers});
    }).catch(()=>caches.match('./index.html').then(async r=>{
      if(!r)return new Response('Sin conexión',{status:503});
      let html=await r.text();
      if(!html.includes('reporte-filtro-jefe.js'))html=html.replace('</body>','<script src="./reporte-filtro-jefe.js?v=20261021-1"></script></body>');
      return new Response(html,{headers:{'content-type':'text/html;charset=utf-8'}});
    })));
    return;
  }
  event.respondWith(fetch(req).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(req,copy));return res}).catch(()=>caches.match(req).then(r=>r||caches.match('./index.html'))));
});