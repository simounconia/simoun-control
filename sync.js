(function(){
  const CFG_KEY='simoun_sync_config_v1';
  const TOKEN_KEY='simoun_sync_session_v1';
  const META_KEY='simoun_sync_meta_v1';
  const WORKSPACE='simoun';
  const LS='simoun_operativo_v1';
  const DEFAULT_CFG={
    url:'https://jpnexyvpoeyzqrrdixln.supabase.co',
    anonKey:'sb_publishable_VUVaAzr3uC_4c0sFR18qCA_SlBMMm97'
  };

  let getState=()=>null, applyState=()=>{};
  let timer=null, syncBusy=false, adminUidCache='';
  let access={role:'',displayName:'',email:'',workspace:WORKSPACE};
  let activity=[];

  function cfg(){try{return {...DEFAULT_CFG,...(JSON.parse(localStorage.getItem(CFG_KEY)||'null')||{})}}catch{return {...DEFAULT_CFG}}}
  function session(){try{return JSON.parse(localStorage.getItem(TOKEN_KEY)||'null')||{}}catch{return{}}}
  function meta(){try{return JSON.parse(localStorage.getItem(META_KEY)||'null')||{}}catch{return{}}}
  function setMeta(p){localStorage.setItem(META_KEY,JSON.stringify({...meta(),...p}));refreshStatus()}
  function configured(){const c=cfg();return !!(c.url&&c.anonKey)}
  function loggedIn(){const s=session();return !!(s.access_token&&s.user?.id)}
  function role(){return access.role||''}
  function isAdmin(){return role()==='admin'}
  function isOperative(){return role()==='operativo'}
  function currentEmail(){return access.email||session().user?.email||''}
  function displayName(){return access.displayName||currentEmail()||'Usuario'}
  function base(){return (cfg().url||'').replace(/\/$/,'')}
  function headers(auth=true,extra={}){const c=cfg(),s=session();return {'apikey':c.anonKey,'Content-Type':'application/json',...(auth&&s.access_token?{'Authorization':'Bearer '+s.access_token}:{}),...extra}}
  function stateStamp(s){return s?._updatedAt||''}
  function dispatch(name){try{window.dispatchEvent(new CustomEvent(name))}catch{}}

  async function refreshSession(){
    const s=session();
    if(!configured()||!s.refresh_token)return false;
    const r=await fetch(base()+'/auth/v1/token?grant_type=refresh_token',{
      method:'POST',headers:{'apikey':cfg().anonKey,'Content-Type':'application/json'},
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
    const ct=r.headers.get('content-type')||'';
    return ct.includes('json')?r.json():r.blob();
  }

  async function signIn(email,password){
    if(!configured())throw new Error('Falta la configuración de sincronización.');
    const data=await api('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:JSON.stringify({email,password})});
    if(data.expires_in&&!data.expires_at)data.expires_at=Math.floor(Date.now()/1000)+Number(data.expires_in);
    localStorage.setItem(TOKEN_KEY,JSON.stringify(data));
    try{await loadAccess(true)}catch(e){localStorage.removeItem(TOKEN_KEY);access={role:'',displayName:'',email:'',workspace:WORKSPACE};throw e}
    setMeta({status:'connected',lastError:''});
    return data;
  }

  async function signUp(email,password){
    if(!configured())throw new Error('Falta la configuración de sincronización.');
    const data=await api('/auth/v1/signup',{method:'POST',auth:false,body:JSON.stringify({email,password})});
    if(data?.access_token){
      if(data.expires_in&&!data.expires_at)data.expires_at=Math.floor(Date.now()/1000)+Number(data.expires_in);
      localStorage.setItem(TOKEN_KEY,JSON.stringify(data));
      try{await loadAccess(true)}catch(e){localStorage.removeItem(TOKEN_KEY);access={role:'',displayName:'',email:'',workspace:WORKSPACE};throw e}
      setMeta({status:'connected',lastError:''});
    }
    return data;
  }

  function signOut(){
    localStorage.removeItem(TOKEN_KEY);
    access={role:'',displayName:'',email:'',workspace:WORKSPACE};activity=[];adminUidCache='';
    setMeta({status:'offline',lastError:''});refreshStatus();dispatch('simoun-access-change');dispatch('simoun-activity-change');
  }

  async function loadAccess(strict=false){
    if(!loggedIn()){access={role:'',displayName:'',email:'',workspace:WORKSPACE};return access}
    const email=session().user?.email||'';
    const rows=await api('/rest/v1/simoun_workspace_members?workspace_id=eq.'+encodeURIComponent(WORKSPACE)+'&email=eq.'+encodeURIComponent(email)+'&select=email,role,display_name&limit=1',{headers:{'Accept':'application/json'}});
    const row=Array.isArray(rows)?rows[0]:null;
    if(!row){
      access={role:'',displayName:'',email,workspace:WORKSPACE};
      if(strict)throw new Error('Este correo no está autorizado para SIMOUN.');
      return access;
    }
    access={role:row.role||'',displayName:row.display_name||'',email:row.email||email,workspace:WORKSPACE};
    dispatch('simoun-access-change');
    return access;
  }

  async function remoteRow(){
    if(!loggedIn())return null;
    const rows=await api('/rest/v1/simoun_workspace_state?workspace_id=eq.'+encodeURIComponent(WORKSPACE)+'&select=workspace_id,data,updated_at&limit=1',{headers:{'Accept':'application/json'}});
    return Array.isArray(rows)?rows[0]||null:null;
  }

  async function uploadState(s){
    if(!loggedIn()||!isAdmin())return;
    const since=meta().lastServerUpdatedAt||null;
    const merged=await api('/rest/v1/rpc/simoun_admin_save_state',{
      method:'POST',body:JSON.stringify({p_workspace:WORKSPACE,p_data:s,p_since:since})
    });
    if(merged&&typeof merged==='object'){
      applyRemote(merged);
      setMeta({lastServerUpdatedAt:merged._updatedAt||new Date().toISOString()});
    }
    setMeta({lastSync:new Date().toISOString(),status:'connected',lastError:''});
    return merged;
  }

  function applyRemote(data){
    const pulled={...(data||{})};delete pulled._freshInstall;
    localStorage.setItem(LS,JSON.stringify(pulled));applyState(pulled);
  }

  async function refreshActivity(){
    if(!loggedIn()||!role()){activity=[];dispatch('simoun-activity-change');return activity}
    const rows=await api('/rest/v1/simoun_workspace_activity?workspace_id=eq.'+encodeURIComponent(WORKSPACE)+'&select=id,kind,client_id,issue_id,client_name,issue_type,status,note,actor_email,actor_role,created_at,reviewed,reviewed_at,reviewed_by&order=created_at.desc&limit=150',{headers:{'Accept':'application/json'}});
    activity=Array.isArray(rows)?rows:[];
    dispatch('simoun-activity-change');
    return activity;
  }

  async function syncNow(forcePush=false){
    if(syncBusy)return;
    if(!configured())return openSettings('Falta configurar la sincronización privada.');
    if(!loggedIn())return openSettings('Inicia sesión para sincronizar.');
    syncBusy=true;
    try{
      setMeta({status:'syncing'});
      await loadAccess(true);
      const local=getState();const remote=await remoteRow();
      if(!remote)throw new Error('No encontré el espacio compartido de SIMOUN.');

      if(isOperative()){
        applyRemote(remote.data);
        setMeta({lastServerUpdatedAt:remote.updated_at||stateStamp(remote.data)||''});
      }else{
        const l=stateStamp(local),r=stateStamp(remote.data);
        if(local?._freshInstall&&!forcePush){applyRemote(remote.data);setMeta({lastServerUpdatedAt:remote.updated_at||r||''})}
        else if(forcePush||(!r&&local)){await uploadState(local)}
        else if(l&&r&&l>r){await uploadState(local)}
        else if(r>l){applyRemote(remote.data);setMeta({lastServerUpdatedAt:remote.updated_at||r||''})}
        else if(!l&&remote.data){applyRemote(remote.data);setMeta({lastServerUpdatedAt:remote.updated_at||r||''})}
        else setMeta({lastServerUpdatedAt:remote.updated_at||r||meta().lastServerUpdatedAt||''});
      }
      await refreshActivity();
      setMeta({lastSync:new Date().toISOString(),status:'connected',lastError:''});
    }catch(e){setMeta({status:'error',lastError:String(e.message||e)});console.error(e)}
    finally{syncBusy=false;refreshStatus()}
  }

  function queuePush(s){
    if(!loggedIn()||!isAdmin())return;
    clearTimeout(timer);
    timer=setTimeout(()=>uploadState(s).catch(e=>setMeta({status:'error',lastError:String(e.message||e)})),900);
  }

  async function createClient(client){
    if(!loggedIn()||!role())throw new Error('Inicia sesión primero.');
    const data=await api('/rest/v1/rpc/simoun_operativo_create_client',{method:'POST',body:JSON.stringify({p_workspace:WORKSPACE,p_client:client})});
    if(data&&typeof data==='object'){
      applyRemote(data);
      setMeta({lastServerUpdatedAt:data._updatedAt||new Date().toISOString()});
    }
    await refreshActivity();
    setMeta({lastSync:new Date().toISOString(),status:'connected',lastError:''});
    return data;
  }

  async function createIssue(clientId,issue){
    if(!loggedIn()||!role())throw new Error('Inicia sesión primero.');
    const data=await api('/rest/v1/rpc/simoun_operativo_create_issue',{method:'POST',body:JSON.stringify({p_workspace:WORKSPACE,p_client_id:clientId,p_issue:issue})});
    if(data&&typeof data==='object'){
      applyRemote(data);
      setMeta({lastServerUpdatedAt:data._updatedAt||new Date().toISOString()});
    }
    await refreshActivity();
    setMeta({lastSync:new Date().toISOString(),status:'connected',lastError:''});
    return data;
  }

  async function addWorkUpdate(clientId,issueId,status,note){
    if(!loggedIn()||!role())throw new Error('Inicia sesión primero.');
    const out=await api('/rest/v1/rpc/simoun_operativo_add_update',{method:'POST',body:JSON.stringify({p_workspace:WORKSPACE,p_client_id:clientId,p_issue_id:issueId,p_status:status,p_note:note||''})});
    await refreshActivity();
    setMeta({lastSync:new Date().toISOString(),status:'connected',lastError:''});
    return out;
  }

  async function markActivityReviewed(id,reviewed=true){
    if(!isAdmin())return;
    const payload={reviewed:!!reviewed,reviewed_at:reviewed?new Date().toISOString():null,reviewed_by:reviewed?currentEmail():null};
    await api('/rest/v1/simoun_workspace_activity?id=eq.'+encodeURIComponent(id)+'&workspace_id=eq.'+encodeURIComponent(WORKSPACE),{
      method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify(payload)
    });
    await refreshActivity();
  }

  async function workspaceAdminUid(){
    if(adminUidCache)return adminUidCache;
    if(!loggedIn())return '';
    const out=await api('/rest/v1/rpc/simoun_workspace_admin_uid',{method:'POST',body:JSON.stringify({p_workspace:WORKSPACE})});
    adminUidCache=typeof out==='string'?out:'';
    return adminUidCache;
  }

  function activities(){return activity.slice()}
  function issueActivities(clientId,issueId){return activity.filter(a=>a.kind==='actualizacion_trabajo'&&a.client_id===clientId&&a.issue_id===issueId)}
  function unreadCount(){return isAdmin()?activity.filter(a=>!a.reviewed&&a.actor_role==='operativo').length:0}

  async function uploadDocument(id,file,name){
    if(!loggedIn()||!isAdmin())return;
    await ensureSession();
    const uid=session().user.id;const path=`${uid}/${id}/${encodeURIComponent(name)}`;
    const r=await fetch(base()+'/storage/v1/object/simoun-docs/'+path,{method:'POST',headers:{'apikey':cfg().anonKey,'Authorization':'Bearer '+session().access_token,'x-upsert':'true','Content-Type':file.type||'application/octet-stream'},body:file});
    if(!r.ok)throw new Error(await r.text());
  }
  async function downloadDocument(id,name){
    if(!loggedIn())return null;
    await ensureSession();
    const uid=await workspaceAdminUid()||session().user.id;const path=`${uid}/${id}/${encodeURIComponent(name)}`;
    const r=await fetch(base()+'/storage/v1/object/authenticated/simoun-docs/'+path,{headers:{'apikey':cfg().anonKey,'Authorization':'Bearer '+session().access_token}});
    if(!r.ok)return null;return r.blob();
  }
  async function deleteDocument(id,name){
    if(!loggedIn()||!isAdmin())return;
    await ensureSession();
    const uid=session().user.id;const path=`${uid}/${id}/${encodeURIComponent(name)}`;
    await api('/storage/v1/object/simoun-docs',{method:'DELETE',body:JSON.stringify({prefixes:[path]})});
  }

  function roleLabel(){return isAdmin()?'Administradora':isOperative()?'Usuario operativo':''}
  function statusText(){
    const m=meta();if(!configured())return 'Sin configurar';if(!loggedIn())return 'Falta iniciar sesión';
    if(m.status==='syncing')return 'Sincronizando…';if(m.status==='error')return 'Error de sincronización';
    const who=roleLabel();return (m.lastSync?'Sincronizado':'Conectado')+(who?' · '+who:'');
  }
  function statusClass(){const m=meta();return m.status==='error'?'red':loggedIn()?'green':'orange'}
  function refreshStatus(){
    const el=document.getElementById('syncStatus');if(el){el.textContent=statusText();el.className='badge '+statusClass()}
    const err=document.getElementById('syncError');if(err)err.textContent=meta().lastError||'';
  }
  function statusHTML(){return `<span id="syncStatus" class="badge ${statusClass()}">${statusText()}</span>`}

  function openSettings(message=''){
    const d=document.getElementById('syncDlg');if(!d)return;
    const s=session();
    document.getElementById('syncDlgBody').innerHTML=`
      ${message?`<div class="notice" style="margin-bottom:12px">${message}</div>`:''}
      <div class="notice"><strong>SIMOUN compartido</strong><br>Las tres cuentas autorizadas trabajan con la misma información. Cada persona debe usar su propio correo y contraseña.</div>
      ${s.user?`
        <div class="card" style="margin-top:12px"><strong>${displayName()}</strong><div class="muted">${currentEmail()}</div><div style="margin-top:8px"><span class="badge ${isAdmin()?'blue':'green'}">${roleLabel()||'Sin permiso'}</span></div></div>
        <div class="toolbar" style="margin-top:12px"><button class="btn" id="syncNowBtn">Sincronizar ahora</button><button class="btn secondary" id="signOutBtn">Cerrar sesión</button></div>`:
      `<div class="row" style="margin-top:12px"><div class="field"><label>Correo</label><input id="syncEmail" type="email" autocomplete="username"></div><div class="field"><label>Contraseña</label><input id="syncPass" type="password" autocomplete="current-password"></div></div><div class="toolbar" style="margin-top:10px"><button class="btn" id="signInBtn">Iniciar sesión</button><button class="btn secondary" id="signUpBtn">Crear mi cuenta</button></div><div class="muted" style="font-size:12px">Usa únicamente uno de los correos autorizados de SIMOUN.</div>`}
      <div id="syncError" class="muted" style="margin-top:10px;color:#b42318">${meta().lastError||''}</div>`;
    d.showModal();

    document.getElementById('signInBtn')?.addEventListener('click',async()=>{
      const email=document.getElementById('syncEmail').value.trim(),pass=document.getElementById('syncPass').value;
      try{await signIn(email,pass);await syncNow();openSettings('Sesión iniciada. Ya estás usando la información compartida de SIMOUN.')}catch(e){setMeta({status:'error',lastError:String(e.message||e)});openSettings('No se pudo iniciar sesión.')}
    });
    document.getElementById('signUpBtn')?.addEventListener('click',async()=>{
      const email=document.getElementById('syncEmail').value.trim(),pass=document.getElementById('syncPass').value;
      if(pass.length<6)return openSettings('La contraseña necesita al menos 6 caracteres.');
      try{
        const out=await signUp(email,pass);
        if(out?.access_token){await syncNow();openSettings('Cuenta creada y conectada a SIMOUN.');}
        else openSettings('Cuenta creada. Revisa el correo por si Supabase solicita confirmar la dirección y después inicia sesión.');
      }catch(e){setMeta({status:'error',lastError:String(e.message||e)});openSettings('No se pudo crear la cuenta.')}
    });
    document.getElementById('signOutBtn')?.addEventListener('click',()=>{signOut();openSettings('Sesión cerrada.')});
    document.getElementById('syncNowBtn')?.addEventListener('click',async()=>{await syncNow();openSettings('Sincronización finalizada.')});
  }

  function init(opts){
    getState=opts.getState;applyState=opts.applyState;refreshStatus();
    window.addEventListener('online',()=>syncNow());
    window.addEventListener('focus',()=>{if(loggedIn()&&navigator.onLine)syncNow()});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&loggedIn()&&navigator.onLine)syncNow()});
    setInterval(()=>{if(loggedIn()&&navigator.onLine)syncNow()},60000);
    if(loggedIn()&&navigator.onLine)setTimeout(()=>syncNow(),600);
  }

  window.SimounSync={
    init,queuePush,syncNow,openSettings,statusHTML,refreshStatus,uploadDocument,downloadDocument,deleteDocument,
    configured,loggedIn,role,isAdmin,isOperative,currentEmail,displayName,signIn,signUp,signOut,
    createClient,createIssue,addWorkUpdate,activities,issueActivities,unreadCount,markActivityReviewed,refreshActivity
  };
})();

// Carga los permisos operativos después de que todos los módulos existentes hayan terminado de iniciar.
window.addEventListener('load',()=>{
  if(document.querySelector('script[data-simoun-operational]'))return;
  const s=document.createElement('script');
  s.src='./usuarios-operativos.js?v=20261021-1';
  s.dataset.simounOperational='1';
  document.body.appendChild(s);
});
