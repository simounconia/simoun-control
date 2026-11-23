(() => {
  'use strict';
  const key = 'simoun.screen-lock.v1';
  const attemptsKey = key + '.attempts';
  const panel = document.getElementById('screenLock');
  const form = document.getElementById('screenLockForm');
  const password = form.elements.password;
  const repeat = form.elements.repeat;
  const message = document.getElementById('screenLockMessage');
  const submit = form.querySelector('[type=submit]');
  const cancel = document.getElementById('screenLockCancel');
  let setup = false;
  let revision = localStorage.getItem(key);
  let busy = false;

  function show(create) {
    setup = create;
    form.reset();
    message.textContent = '';
    panel.hidden = false;
    if(!panel.open)panel.showModal();
    document.documentElement.classList.add('simoun-screen-locked');
    document.getElementById('screenLockTitle').textContent = create ? 'Crear clave de bloqueo' : 'SIMOUN está bloqueado';
    document.getElementById('screenLockHint').textContent = create ? 'Elige una clave de al menos 6 caracteres para este navegador.' : 'Escribe tu clave para volver al trabajo.';
    repeat.closest('label').hidden = !create;
    repeat.required = create;
    password.autocomplete = create ? 'new-password' : 'current-password';
    cancel.hidden = !create;
    submit.textContent = create ? 'Guardar y bloquear' : 'Desbloquear';
    password.focus();
  }
  function hide() {
    form.reset();
    panel.close();
    panel.hidden = true;
    document.documentElement.classList.remove('simoun-screen-locked');
    document.getElementById('screenLockButton').focus();
  }
  const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  async function verifier(value,salt) {
    const material = await crypto.subtle.importKey('raw',new TextEncoder().encode(value),'PBKDF2',false,['deriveBits']);
    const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:Uint8Array.from(salt.match(/../g),b=>parseInt(b,16)),iterations:600000,hash:'SHA-256'},material,256);
    return hex(new Uint8Array(bits));
  }
  panel.addEventListener('cancel',event=>event.preventDefault());
  function lock() {
    const raw = localStorage.getItem(key);
    if(!raw){ show(true); return; }
    const record = JSON.parse(raw);
    record.generation = crypto.randomUUID();
    revision = JSON.stringify(record);
    localStorage.setItem(key,revision);
    show(false);
  }
  document.getElementById('screenLockButton').addEventListener('click',lock);
  cancel.onclick = () => { if(setup && !busy && !localStorage.getItem(key))hide(); };
  form.onsubmit = async event => {
    event.preventDefault();
    if(busy)return;
    busy = true; submit.disabled = true;
    try {
      const raw = localStorage.getItem(key);
      const value = password.value;
      if(setup && !raw){
        if(value.trim().length<6 || value!==repeat.value){message.textContent='Usa al menos 6 caracteres y repite la misma clave.';return;}
        const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
        const hash=await verifier(value,salt);
        if(localStorage.getItem(key)){show(false);return;}
        revision=JSON.stringify({salt,hash,generation:crypto.randomUUID()});
        localStorage.setItem(key,revision);
        show(false);
        return;
      }
      if(!raw){show(true);return;}
      const attempts=JSON.parse(localStorage.getItem(attemptsKey)||'{}');
      if(Date.now()<attempts.until){message.textContent='Espera '+Math.ceil((attempts.until-Date.now())/1000)+' segundos para volver a intentar.';return;}
      const record=JSON.parse(raw);
      const hash=await verifier(value,record.salt);
      if(raw!==localStorage.getItem(key)){show(false);return;}
      if(hash===record.hash){localStorage.removeItem(attemptsKey);revision=raw;hide();return;}
      const count=(attempts.count||0)+1;
      localStorage.setItem(attemptsKey,JSON.stringify({count,until:count>=5?Date.now()+30000:0}));
      password.value='';password.focus();message.textContent=count>=5?'Espera 30 segundos para volver a intentar.':'Clave incorrecta.';
    } catch { message.textContent='No se pudo comprobar o guardar la clave en este navegador.'; }
    finally {busy=false;submit.disabled=false;}
  };
  function syncLock(){
    const current=localStorage.getItem(key);
    if(current && current!==revision){revision=current;show(false);}
  }
  window.addEventListener('storage',event=>{if(event.key===key)syncLock();});
  window.addEventListener('pageshow',syncLock);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncLock()});
  if(revision)show(false);
})();