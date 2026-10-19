(function(){
  const CFG_KEY='simoun_sync_config_v1';
  const TOKEN_KEY='simoun_sync_session_v1';
  const META_KEY='simoun_sync_meta_v1';
  // Configuración pública del proyecto. Esta clave publishable es segura para clientes web;
  // la seguridad real de los datos la aplican Auth + RLS en Supabase.
  const DEFAULT_CFG={
    url:'https://jpnexyvpoeyzqrrdixln.supabase.co',
    anonKey:'sb_publishable_VUVaAzr3uC_4c0sFR18qCA_SlBMMm97'
  };
  let getState=()=>null, applyState=()=>{};
  let timer=null;

  function cfg(){try{return {...DEFAULT_CFG,...(JSON.parse(localStorage.getItem(CFG_KEY)||'null')||{})}}catch{return {...DEFAULT_CFG}}}
  function session(){try{return JSON.parse(localStorage.getItem(TOKEN_KEY)||'null')||{}}catch{return{}}}
  function meta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'null')||{}}catch{return{}}}
  function setMeta(p){localStorage.setItem(META_KEY,JSON.stringify({...meta(),...p}));refreshStatus()}
  function configured(){const c=cfg();return !!(c.url&&c.anonKey)}
  function loggedIn(){const s=session();return !!(s.access_token&&s.user?.id)}
  function base(){return (cfg().url||'').replace(/\/$/,'')}
  function headers(auth=true,extra={}){const c=cfg(),s=session();return {'apikey':c.anonKey,'Content-Type':'application/json',...(auth&&s.access_token?{'Authorization':'Bearer '+s.access_token}:{}),...extra}}
  function stateStamp(s){return s?._updatedAt||''}

  async function refreshSession(){
    const s=session();
    if(!configured()||!s.refresh_token)return false;
    const r=await fetch(base()+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',
      headers:{'apikey':cfg().anonKey,'Content-Type':'application/json'},
      body:JSON.stringify({refresh_token:s.refresh_token})
    });
    if(!r.ok)return false;
    const data=await r.json();
    if(data.expires_in&&!data.expires_at)data.expires_at=Math.floor(Date.now()/1000)+Number(data.expires_in);
    localStorage.setItem(TOKEN_KEY,JSON.stringify(data));
    return true;
  }

  async function ensureSession(){
    const s=session();
    if(!s.access_token)return false;
    const exp=Number(s.expires_at||0);
    if(!exp||exp-Math.floor(Date.now()/1000)>60)return true;
    return refreshSession();
  }

  async function api(path,options={}){
    const useAuth=options.auth!==false;
    if(useAuth)await ensureSession();
    const doFetch=()=>fetch(base()+path,{...options,headers:{...headers(useAuth,options.headers||{}),...(options.headers||{})}});
    let r=await doFetch();
    if(useAuth&&r.status===401&&await refreshSession())r=await doFetch();
    if(!r.ok){let t='';try{t=await r.text()}catch{};throw new Error(t||`Error ${r.status}`)}
    if(r.status===204)return null;
    const ct=r.headers.get('content-type')||'';return ct.includes('json')?r.json():r.blob();
  }

  async function signIn(email,password){
    if(!configured())throw new Error('Primero configura URL y clave pública de Supabase.');
    const data=await api('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:JSON.stringify({email,password})});
    if(data.expires_in&&!data.expires_at)data.expires_at=Math.floor(Date.now()/1000)+Number(data.expires_in);
    localStorage.setItem(TOKEN_KEY,JSON.stringify(data));setMeta({status:'connected',lastError:''});return data;
  }
  function signOut(){localStorage.removeItem(TOKEN_KEY);setMeta({status:'offline'});refreshStatus()}

  async function remoteRow(){
    if(!loggedIn())return null;
    const uid=session().user.id;
    const data=await api('/rest/v1/simoun_state?user_id=eq.'+encodeURIComponent(uid)+'&select=user_id,data,updated_at',{headers:{'Accept':'application/json'}});
    return Array.isArray(data)?data[0]||null:null;
  }
  async function uploadState(s){
    if(!loggedIn())return;
    const uid=session().user.id;
    const payload={user_id:uid,data:s,updated_at:new Date().toISOString()};
    await api('/rest/v1/simoun_state?on_conflict=user_id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(payload)});
    setMeta({lastSync:new Date().toISOString(),status:'connected',lastError:''});
  }
  async function syncNow(forcePush=false){
    if(!configured())return openSettings('Falta configurar la sincronización privada.');
    if(!loggedIn())return openSettings('Inicia sesión para sincronizar.');
    try{
      setMeta({status:'syncing'});
      const local=getState();const remote=await remoteRow();
      // En una instalación nueva, si ya hay datos remotos, el servidor gana.
      // Así un celular recién instalado nunca pisa por accidente lo capturado en la PC.
      if(remote&&local?._freshInstall&&!forcePush){
        const pulled={...remote.data};delete pulled._freshInstall;
        localStorage.setItem('simoun_operativo_v1',JSON.stringify(pulled));applyState(pulled);
        setMeta({lastSync:new Date().toISOString(),status:'connected',lastError:''});return refreshStatus();
      }
      if(!remote){
        let first={...local};
        if(first._freshInstall && (!first.clients || first.clients.length===0) && typeof window.SimounPrivateInitialState==='function'){
          first=window.SimounPrivateInitialState();
        }
        delete first._freshInstall;
        first._updatedAt=first._updatedAt||new Date().toISOString();
        localStorage.setItem('simoun_operativo_v1',JSON.stringify(first));applyState(first);
        await uploadState(first);return refreshStatus();
      }
      const l=stateStamp(local),r=stateStamp(remote.data);
      if(forcePush||!r||l>r){await uploadState(local)}
      else if(r>l){const pulled={...remote.data};delete pulled._freshInstall;localStorage.setItem('simoun_operativo_v1',JSON.stringify(pulled));applyState(pulled);setMeta({lastSync:new Date().toISOString(),status:'connected',lastError:''})}
      else setMeta({lastSync:new Date().toISOString(),status:'connected',lastError:''});
    }catch(e){setMeta({status:'error',lastError:String(e.message||e)});console.error(e)}
    refreshStatus();
  }
  function queuePush(s){
    if(!loggedIn())return;clearTimeout(timer);timer=setTimeout(()=>uploadState(s).catch(e=>setMeta({status:'error',lastError:String(e.message||e)})),900);
  }

  async function uploadDocument(id,file,name){
    if(!loggedIn())return;
    await ensureSession();
    const uid=session().user.id;const path=`${uid}/${id}/${encodeURIComponent(name)}`;
    const r=await fetch(base()+'/storage/v1/object/simoun-docs/'+path,{method:'POST',headers:{'apikey':cfg().anonKey,'Authorization':'Bearer '+session().access_token,'x-upsert':'true','Content-Type':file.type||'application/octet-stream'},body:file});
    if(!r.ok)throw new Error(await r.text());
  }
  async function downloadDocument(id,name){
    if(!loggedIn())return null;
    await ensureSession();
    const uid=session().user.id;const path=`${uid}/${id}/${encodeURIComponent(name)}`;
    const r=await fetch(base()+'/storage/v1/object/authenticated/simoun-docs/'+path,{headers:{'apikey':cfg().anonKey,'Authorization':'Bearer '+session().access_token}});
    if(!r.ok)return null;return r.blob();
  }
  async function deleteDocument(id,name){
    if(!loggedIn())return;
    await ensureSession();
    const uid=session().user.id;const path=`${uid}/${id}/${encodeURIComponent(name)}`;
    await api('/storage/v1/object/simoun-docs',{method:'DELETE',body:JSON.stringify({prefixes:[path]})});
  }

  function statusText(){
    const m=meta();if(!configured())return 'Sin configurar';if(!loggedIn())return 'Configurado · falta iniciar sesión';
    if(m.status==='syncing')return 'Sincronizando…';if(m.status==='error')return 'Error de sincronización';
    return m.lastSync?'Sincronizado · '+new Date(m.lastSync).toLocaleString('es-MX'):'Conectado';
  }
  function statusClass(){const m=meta();return m.status==='error'?'red':loggedIn()?'green':'orange'}
  function refreshStatus(){
    const el=document.getElementById('syncStatus');if(el){el.textContent=statusText();el.className='badge '+statusClass()}
    const err=document.getElementById('syncError');if(err)err.textContent=meta().lastError||'';
  }
  function statusHTML(){return `<span id="syncStatus" class="badge ${statusClass()}">${statusText()}</span>`}

  function openSettings(message=''){
    const d=document.getElementById('syncDlg');if(!d)return;
    const c=cfg(),s=session();
    document.getElementById('syncDlgBody').innerHTML=`
      ${message?`<div class="notice" style="margin-bottom:12px">${message}</div>`:''}
      <div class="notice">La app funciona sin internet. Para compartir los mismos datos entre PC y celular, conecta un proyecto privado de Supabase.</div>
      <div class="field" style="margin-top:12px"><label>URL del proyecto Supabase</label><input id="syncUrl" value="${c.url||''}" placeholder="https://xxxxx.supabase.co"></div>
      <div class="field" style="margin-top:10px"><label>Clave pública publishable</label><input id="syncKey" value="${c.anonKey||''}" placeholder="Clave pública del proyecto"></div>
      <div class="toolbar" style="margin-top:12px"><button class="btn secondary" id="saveSyncCfg">Guardar configuración</button><button class="btn light" id="clearSyncCfg">Quitar configuración</button></div>
      <hr style="border:0;border-top:1px solid #dce4ef;margin:18px 0">
      ${s.user?`<div class="notice">Sesión: ${s.user.email||s.user.id}</div><div class="toolbar" style="margin-top:10px"><button class="btn" id="syncNowBtn">Sincronizar ahora</button><button class="btn secondary" id="signOutBtn">Cerrar sesión</button></div>`:
      `<div class="row"><div class="field"><label>Correo</label><input id="syncEmail" type="email"></div><div class="field"><label>Contraseña</label><input id="syncPass" type="password"></div></div><div class="toolbar" style="margin-top:10px"><button class="btn" id="signInBtn">Iniciar sesión</button></div>`}
      <div id="syncError" class="muted" style="margin-top:10px;color:#b42318">${meta().lastError||''}</div>`;
    d.showModal();
    document.getElementById('saveSyncCfg').onclick=()=>{localStorage.setItem(CFG_KEY,JSON.stringify({url:document.getElementById('syncUrl').value.trim(),anonKey:document.getElementById('syncKey').value.trim()}));setMeta({status:'offline',lastError:''});openSettings('Configuración guardada.')};
    document.getElementById('clearSyncCfg').onclick=()=>{localStorage.removeItem(CFG_KEY);localStorage.removeItem(TOKEN_KEY);setMeta({status:'offline',lastError:''});d.close();refreshStatus()};
    document.getElementById('signInBtn')?.addEventListener('click',async()=>{try{await signIn(document.getElementById('syncEmail').value.trim(),document.getElementById('syncPass').value);await syncNow();openSettings('Sesión iniciada y sincronización realizada.')}catch(e){setMeta({status:'error',lastError:String(e.message||e)});openSettings('No se pudo iniciar sesión.')}});
    document.getElementById('signOutBtn')?.addEventListener('click',()=>{signOut();openSettings('Sesión cerrada.')});
    document.getElementById('syncNowBtn')?.addEventListener('click',async()=>{await syncNow();openSettings('Sincronización finalizada.')});
  }

  function init(opts){getState=opts.getState;applyState=opts.applyState;refreshStatus();window.addEventListener('online',()=>syncNow());if(loggedIn()&&navigator.onLine)setTimeout(()=>syncNow(),600)}

  window.SimounSync={init,queuePush,syncNow,openSettings,statusHTML,refreshStatus,uploadDocument,downloadDocument,deleteDocument,configured,loggedIn};
})();
