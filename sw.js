const CACHE='simoun-owner-gate-v5';
const ASSETS=['./','./index.html','./acceso.js?v=10','./sync.js?v=owner2','./bloqueo.js','./app.js','./sync.js','./monitoreos.js','./captura-rapida.js','./reportes-categorias.js','./jornada.js','./expedientes-resumen.js','./servicios-clientes.js','./documentos.js','./simoun-logo-data.js','./cotizacion-diseno.js','./recibos.js','./documentos-unificados.js','./vendor/html2pdf.bundle.min.js','./guardado-flexible.js','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('simoun-owner-gate-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname.includes('/conciliaciones/'))return;
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return res}).catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html'))));
});