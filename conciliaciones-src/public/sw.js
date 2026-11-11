// No financial records, credentials or attachments are cached by this worker.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('Necesitas conexión a internet para abrir SIMOUN Conciliaciones. Tus datos siguen guardados en línea.',{headers:{'Content-Type':'text/plain;charset=utf-8'}})))});
