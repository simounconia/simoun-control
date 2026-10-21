// SIMOUN · permisos compartidos y reportes de campo.
// Cargado al final para respetar la app estable y añadir permisos sin observadores del DOM.
(function(){
'use strict';
if(window.__simounOperationalAccess)return;
window.__simounOperationalAccess=true;

const originals={
  save:window.save,
  dashboard:window.dashboard,
  renderClients:window.renderClients,
  renderMonitors:window.renderMonitors,
  newClient:window.newClient,
  editClient:window.editClient,
  openClient:window.openClient,
  deleteClient:window.deleteClient,
  newIssue:window.newIssue,
  editIssue:window.editIssue,
  deleteIssue:window.deleteIssue,
  finishIssue:window.finishIssue,
  addDoc:window.addDoc,
  deleteDoc:window.deleteDoc
};

const isOp=()=>window.SimounSync?.isOperative?.()===true;
const isAdmin=()=>window.SimounSync?.isAdmin?.()===true;
const sync=()=>window.SimounSync;

function blocked(msg='Esta cuenta es operativa. Puede consultar todo, dar de alta clientes y trabajos, y reportar avances; solo la administradora puede modificar o borrar información existente.'){
  alert(msg);
  if(navigator.onLine)sync()?.syncNow?.();
  return false;
}
function stamp(a){try{return new Date(a.created_at).toLocaleString('es-MX',{dateStyle:'short',timeStyle:'short'})}catch{return''}}
function activityLabel(a){
  if(a.kind==='cliente_nuevo')return '👤 Cliente nuevo';
  if(a.kind==='asunto_nuevo')return '➕ Trabajo nuevo';
  return '🛠️ Reporte de trabajo';
}
function statusClass(status){return status==='Terminado'?'green':status==='Incompleto'?'orange':'blue'}
function latestIssueActivity(cid,iid){return sync()?.issueActivities?.(cid,iid)?.[0]||null}

function renderActivitySignal(){
  const home=document.getElementById('inicio');if(!home||!isAdmin())return;
  if(home.querySelector('[data-simoun-activity-card]'))return;
  const firstGrid=home.querySelector('.grid.cards');
  const count=sync()?.unreadCount?.()||0;
  const card=document.createElement('div');
  card.className='card';card.dataset.simounActivityCard='1';
  card.style.cssText=count?'margin-top:14px;border:2px solid #2e8bc0;cursor:pointer':'margin-top:14px;cursor:pointer';
  card.setAttribute('role','button');card.setAttribute('tabindex','0');
  card.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><div><div class="muted">🔔 Nuevas anotaciones del equipo</div><div class="metric">${count}</div><div class="muted">Reportes del jefe e instalador que aún no has revisado.</div></div><button class="btn sm ${count?'':'secondary'}" type="button">Ver anotaciones</button></div>`;
  card.onclick=()=>window.openSimounActivity();card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();window.openSimounActivity()}};
  if(firstGrid)firstGrid.insertAdjacentElement('afterend',card);else home.prepend(card);
}

function applyOperativeControls(){
  if(!isOp())return;
  const exp=document.getElementById('expedientes');
  if(exp){
    exp.querySelectorAll('button').forEach(b=>{
      const txt=(b.textContent||'').trim().toLowerCase();
      const oc=b.getAttribute('onclick')||'';
      if(txt.includes('borrar')||oc.includes('deleteClient(')||oc.includes('deleteIssue(')||oc.includes('editIssue('))b.remove();
      if(txt.includes('abrir / editar'))b.textContent='Abrir';
    });
  }
  const mon=document.getElementById('monitoreos');
  if(mon){
    mon.querySelectorAll('button').forEach(b=>{
      const oc=b.getAttribute('onclick')||'';
      if(/newMonitor\(|editMonitor\(|deleteMonitor\(|newMonitorPayment\(/.test(oc))b.remove();
    });
  }
  const fab=document.getElementById('fab');if(fab)fab.onclick=()=>window.newClient();
}

window.dashboard=function(){const out=originals.dashboard?.apply(this,arguments);renderActivitySignal();return out};
window.renderClients=function(){const out=originals.renderClients?.apply(this,arguments);applyOperativeControls();return out};
window.renderMonitors=function(){const out=originals.renderMonitors?.apply(this,arguments);applyOperativeControls();return out};

window.save=function(){
  if(isOp())return blocked('Los cambios directos están protegidos en esta sesión. Usa “Nuevo expediente”, “Nuevo asunto” o “Reportar trabajo”.');
  return originals.save?.apply(this,arguments);
};

function operativeClientForm(c){
  document.getElementById('clientDlgTitle').textContent='Nuevo expediente';
  document.getElementById('clientDlgBody').innerHTML=`
    <div class="notice"><strong>Alta operativa</strong><br>Podrás guardar el cliente y después agregar el trabajo. Una vez guardado no podrás modificarlo; la administradora sí podrá corregirlo.</div>
    <form id="opClientForm" style="margin-top:12px">
      <div class="row"><div class="field"><label>Cliente *</label><input name="name" required></div><div class="field"><label>Contacto</label><input name="contact"></div></div>
      <div class="row"><div class="field"><label>Empresa</label><input name="company"></div><div class="field"><label>Teléfono</label><input name="phone"></div></div>
      <div class="field"><label>WhatsApp</label><input name="whatsapp" inputmode="tel"></div>
      <div class="field"><label>Dirección *</label><textarea name="address" required></textarea></div>
      <div class="field"><label>Observaciones generales</label><textarea name="notes"></textarea></div>
      <div class="toolbar"><button class="btn" type="submit">💾 Guardar cliente</button><button class="btn secondary" type="button" onclick="clientDlg.close()">Cancelar</button></div>
    </form>`;
  const form=document.getElementById('opClientForm');
  form.onsubmit=async e=>{
    e.preventDefault();
    const fd=new FormData(form),client=c||blankClient();
    ['name','contact','company','phone','whatsapp','address','notes'].forEach(k=>client[k]=String(fd.get(k)||'').trim());
    client.billing=client.billing||'';client.issues=client.issues||[];client.docs=client.docs||[];
    try{
      form.querySelector('button[type=submit]').disabled=true;
      await sync().createClient(client);clientDlg.close();renderAll();openClient(client.id);
    }catch(err){alert('No se pudo guardar: '+String(err.message||err));form.querySelector('button[type=submit]').disabled=false}
  };
  clientDlg.showModal();
}

function operativeIssueDetails(i){
  const items=[];
  const add=(label,value)=>{const v=String(value??'').trim();if(v)items.push(`<div class="kv"><b>${esc(label)}</b><br>${esc(v)}</div>`)};
  add('Dirección del servicio',i.serviceAddress);
  add('Disponibilidad / ventana',i.clientAvailability||i.appointmentWindow);
  add('Confirmación de cita',i.appointmentConfirmation);
  if(i.type==='Trabajo incompleto'){
    add('Motivo de incompleto',i.incompleteReason);add('Qué falta',i.missingWork);add('Próxima acción',i.nextAction);
  }
  if(i.type==='Trabajo futuro / promesa'){
    add('Promesa / trabajo futuro',i.futurePromise);add('Fecha aproximada',i.futureApproxDate);add('Próximo contacto',i.futureContactDate);
  }
  if(i.type==='Facturación')add('Requiere factura',i.billingYes);
  if(i.type==='Cobro'){
    add('Total',typeof money==='function'?money(i.total||0):i.total);add('Pagado',typeof money==='function'?money(i.paid||0):i.paid);add('Saldo',typeof money==='function'?money(i.balance||0):i.balance);add('Estado de cobro',i.payState);add('Forma de pago',i.paymentMethod);add('Destino del pago',i.paymentDestination);
  }
  return items.length?`<div class="issue-grid">${items.join('')}</div>`:'';
}

function operativeIssueCard(c,i){
  const m=TYPE_META[i.type]||{icon:'•'};const a=latestIssueActivity(c.id,i.id);const dates=issueDates(i);
  return `<div class="card issue" style="${typeStyle(i.type)}">
    <div class="issue-head"><div><div class="type-label">${m.icon} ${esc(i.type)}</div><div class="badges"><span class="badge">${esc(i.state||'Pendiente')}</span>${a?`<span class="badge ${statusClass(a.status)}">Reporte: ${esc(a.status)}</span>`:''}</div></div><button class="btn sm" type="button" onclick="reportSimounWork('${c.id}','${i.id}')">📝 Reportar trabajo</button></div>
    <div style="margin-top:8px"><strong>Trabajo:</strong> ${esc(i.description||'Sin descripción')}</div>
    ${i.notes?`<div class="muted" style="margin-top:6px"><strong>Notas:</strong> ${esc(i.notes)}</div>`:''}
    <div class="issue-grid">${dates.slice(0,8).map(d=>`<div class="kv"><b>${d.label}</b><br>${fmt(d.date)}</div>`).join('')}</div>
    ${operativeIssueDetails(i)}
    ${a?`<div class="notice" style="margin-top:10px"><strong>Último reporte · ${esc(a.status)}</strong><br>${esc(a.note||'Sin nota')}<div class="muted" style="margin-top:4px">${esc(a.actor_email)} · ${stamp(a)}</div></div>`:''}
  </div>`;
}

function operativeClientView(c){
  document.getElementById('clientDlgTitle').textContent=c.name||'Expediente';
  document.getElementById('clientDlgBody').innerHTML=`
    <div class="notice"><strong>Modo operativo</strong><br>Puedes consultar toda la información de este expediente y reportar el resultado de cada trabajo. Los datos originales están protegidos contra edición o borrado.</div>
    <div class="card" style="margin-top:12px">
      <div class="row"><div class="kv"><b>Cliente</b><br>${esc(c.name||'Sin nombre')}</div><div class="kv"><b>Empresa / contacto</b><br>${esc([c.company,c.contact].filter(Boolean).join(' · ')||'Sin dato')}</div></div>
      <div class="row" style="margin-top:8px"><div class="kv"><b>Teléfono / WhatsApp</b><br>${esc(c.whatsapp||c.phone||'Sin dato')}</div><div class="kv"><b>Dirección</b><br>${esc(c.address||'Sin dato')}</div></div>
      ${c.notes?`<div class="kv" style="margin-top:8px"><b>Observaciones generales</b><br>${esc(c.notes)}</div>`:''}
      ${c.billing?`<div class="kv" style="margin-top:8px"><b>Datos de facturación</b><br>${esc(c.billing)}</div>`:''}
    </div>
    <div class="section-title"><h3>Trabajos</h3><button class="btn sm" type="button" onclick="newIssue('${c.id}')">+ Nuevo asunto</button></div>
    <div class="list">${(c.issues||[]).map(i=>operativeIssueCard(c,i)).join('')||'<div class="empty">Todavía no hay trabajos.</div>'}</div>
    ${(c.docs||[]).length?`<div class="section-title"><h3>Documentos</h3></div><div class="list">${c.docs.map(d=>`<div class="doc"><span>📎 ${esc(d.name)}</span><button class="btn sm secondary" type="button" onclick="downloadDoc('${c.id}','${d.id}')">Abrir</button></div>`).join('')}</div>`:''}`;
  clientDlg.showModal();
}

window.newClient=function(){if(isOp())return operativeClientForm(blankClient());return originals.newClient?.apply(this,arguments)};
window.editClient=function(c,isNew){if(isOp())return isNew?operativeClientForm(c):operativeClientView(c);return originals.editClient?.apply(this,arguments)};
window.openClient=function(id){
  if(isOp()){const c=state.clients.find(x=>x.id===id);if(c)return operativeClientView(c);return}
  return originals.openClient?.apply(this,arguments);
};
window.deleteClient=function(){if(isOp())return blocked();return originals.deleteClient?.apply(this,arguments)};
window.deleteIssue=function(){if(isOp())return blocked();return originals.deleteIssue?.apply(this,arguments)};
window.addDoc=function(){if(isOp())return blocked('Los documentos solo los puede agregar la administradora.');return originals.addDoc?.apply(this,arguments)};
window.deleteDoc=function(){if(isOp())return blocked('Los documentos solo los puede borrar la administradora.');return originals.deleteDoc?.apply(this,arguments)};

function operativeNewIssue(cid){
  const c=state.clients.find(x=>x.id===cid);if(!c)return;
  document.getElementById('issueDlgTitle').textContent='Nuevo asunto · '+(c.name||'Cliente');
  document.getElementById('issueDlgBody').innerHTML=`
    <div class="notice">Este trabajo se agregará al expediente. Después quedará protegido contra edición en tu sesión.</div>
    <form id="opIssueForm" style="margin-top:12px">
      <div class="field"><label>Tipo de servicio</label><select name="type">${ISSUE_TYPES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div>
      <div class="field"><label>Descripción del trabajo *</label><textarea name="description" required></textarea></div>
      <div class="field"><label>Notas</label><textarea name="notes"></textarea></div>
      <div class="row"><div class="field"><label>Fecha de seguimiento</label><input type="date" name="followupDate"></div><div class="field"><label>Fecha de cita</label><input type="date" name="appointmentDate"></div></div>
      <div class="field"><label>Ventana de atención</label><input name="appointmentWindow" placeholder="Ej. martes de 12:00 a 17:00"></div>
      <div class="toolbar"><button class="btn" type="submit">💾 Guardar trabajo</button><button class="btn secondary" type="button" onclick="issueDlg.close()">Cancelar</button></div>
    </form>`;
  const form=document.getElementById('opIssueForm');
  form.onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(form),i=blankIssue();
    i.type=String(fd.get('type')||'Seguimiento');i.state='Pendiente';i.description=String(fd.get('description')||'').trim();i.notes=String(fd.get('notes')||'').trim();i.followupDate=String(fd.get('followupDate')||'');i.appointmentDate=String(fd.get('appointmentDate')||'');i.appointmentWindow=String(fd.get('appointmentWindow')||'').trim();
    try{form.querySelector('button[type=submit]').disabled=true;await sync().createIssue(cid,i);issueDlg.close();renderAll();openClient(cid)}catch(err){alert('No se pudo guardar: '+String(err.message||err));form.querySelector('button[type=submit]').disabled=false}
  };
  issueDlg.showModal();
}

window.newIssue=function(cid){if(isOp())return operativeNewIssue(cid);return originals.newIssue?.apply(this,arguments)};
window.editIssue=function(cid,iid){if(isOp())return iid?window.reportSimounWork(cid,iid):operativeNewIssue(cid);return originals.editIssue?.apply(this,arguments)};
window.finishIssue=function(cid,iid){if(isOp())return window.reportSimounWork(cid,iid,'Terminado');return originals.finishIssue?.apply(this,arguments)};

window.reportSimounWork=function(cid,iid,preset=''){
  const c=state.clients.find(x=>x.id===cid),i=c?.issues?.find(x=>x.id===iid);if(!i)return;
  const acts=sync()?.issueActivities?.(cid,iid)||[];
  document.getElementById('issueDlgTitle').textContent='Reportar trabajo · '+(c.name||'Cliente');
  document.getElementById('issueDlgBody').innerHTML=`
    <div class="card" style="${typeStyle(i.type)};border-left:5px solid var(--type)"><strong>${esc(i.type)}</strong><div style="margin-top:6px">${esc(i.description||'Sin descripción')}</div><div class="muted" style="margin-top:5px">${esc(i.serviceAddress||c.address||'')}</div></div>
    <form id="opWorkReportForm" style="margin-top:12px">
      <div class="field"><label>Resultado del trabajo</label><select name="status"><option ${preset==='Terminado'?'selected':''}>Terminado</option><option ${preset==='Incompleto'?'selected':''}>Incompleto</option><option ${preset==='Pendiente'||!preset?'selected':''}>Pendiente</option></select></div>
      <div class="field"><label>Nota del instalador / seguimiento</label><textarea name="note" required placeholder="Ej. Falta internet del cliente para continuar."></textarea></div>
      <div class="toolbar"><button class="btn" type="submit">📤 Enviar reporte</button><button class="btn secondary" type="button" onclick="issueDlg.close()">Cancelar</button></div>
    </form>
    ${acts.length?`<div class="section-title"><h3>Reportes anteriores</h3></div><div class="history">${acts.slice(0,12).map(a=>`<div class="history-item"><strong>${esc(a.status)}</strong> · ${esc(a.actor_email)}<br>${esc(a.note||'Sin nota')}<br><span class="muted">${stamp(a)}</span></div>`).join('')}</div>`:''}`;
  const form=document.getElementById('opWorkReportForm');
  form.onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(form),status=String(fd.get('status')),note=String(fd.get('note')||'').trim();
    if(!note)return alert('Escribe una nota breve de lo que ocurrió.');
    try{form.querySelector('button[type=submit]').disabled=true;await sync().addWorkUpdate(cid,iid,status,note);issueDlg.close();renderAll();openClient(cid)}catch(err){alert('No se pudo enviar: '+String(err.message||err));form.querySelector('button[type=submit]').disabled=false}
  };
  issueDlg.showModal();
};

window.openSimounActivity=function(){
  if(!isAdmin())return;
  const rows=(sync()?.activities?.()||[]).filter(a=>a.actor_role==='operativo');
  const unread=rows.filter(a=>!a.reviewed).length;
  dayDlgTitle.textContent='🔔 Anotaciones del equipo'+(unread?' · '+unread+' nuevas':'');
  dayDlgBody.innerHTML=rows.length?rows.map(a=>`<div class="card" style="margin-bottom:10px;${!a.reviewed?'border:2px solid #2e8bc0':''}">
    <div class="issue-head"><div><strong>${activityLabel(a)} · ${esc(a.client_name||'Sin cliente')}</strong><div class="muted">${esc(a.issue_type||'')}${a.status?' · '+esc(a.status):''}</div></div>${a.reviewed?'<span class="badge green">Revisada</span>':'<span class="badge blue">Nueva</span>'}</div>
    ${a.note?`<div style="margin-top:8px">${esc(a.note)}</div>`:''}
    <div class="muted" style="margin-top:7px">${esc(a.actor_email)} · ${stamp(a)}</div>
    <div class="toolbar" style="margin-top:9px;margin-bottom:0">${a.client_id?`<button class="btn sm secondary" type="button" onclick="dayDlg.close();openClient('${a.client_id}')">Abrir expediente</button>`:''}${!a.reviewed?`<button class="btn sm" type="button" onclick="markSimounActivity(${Number(a.id)})">✓ Marcar revisada</button>`:''}</div>
  </div>`).join(''):'<div class="empty">Todavía no hay anotaciones del equipo.</div>';
  dayDlg.showModal();
};
window.markSimounActivity=async function(id){try{await sync().markActivityReviewed(id,true);window.openSimounActivity();window.dashboard()}catch(err){alert('No se pudo marcar como revisada: '+String(err.message||err))}};

// Solicitud rápida: para cuentas operativas la guardamos mediante las funciones protegidas del servidor.
document.addEventListener('submit',async e=>{
  if(!isOp())return;
  const form=e.target;if(!(form instanceof HTMLFormElement))return;
  const allowed=new Set(['opClientForm','opIssueForm','opWorkReportForm']);
  if(form.id==='quickIntakeForm'){
    e.preventDefault();e.stopImmediatePropagation();
    const f=new FormData(form),name=String(f.get('cliente')||'').trim(),whatsapp=String(f.get('whatsapp')||'').trim(),address=String(f.get('direccion')||'').trim();
    if(!name||!address)return alert('Necesito cliente y dirección.');
    const matches=state.clients.filter(c=>String(c.name||'').trim().toLocaleLowerCase('es')===name.toLocaleLowerCase('es'));
    if(matches.length>1)return alert('Hay varios clientes con ese nombre. Abre el expediente correcto para evitar duplicados.');
    try{
      let client=matches[0];
      if(!client){client=blankClient();client.name=name;client.address=address;client.whatsapp=whatsapp;await sync().createClient(client)}
      const issue=blankIssue();issue.type=String(f.get('tipo')||'Seguimiento');issue.description=String(f.get('motivo')||'').trim()||'Trabajo por confirmar con técnicos';issue.notes=String(f.get('nota')||'').trim();issue.appointmentWindow=String(f.get('horario')||'').trim();issue.clientAvailability=issue.appointmentWindow;issue.serviceAddress=address;issue.appointmentConfirmation='Pendiente de coordinar';
      await sync().createIssue(client.id,issue);
      form.closest('dialog')?.close();form.reset();renderAll();alert('Solicitud guardada y compartida con SIMOUN.');openClient(client.id);
    }catch(err){alert('No se pudo guardar: '+String(err.message||err))}
    return;
  }
  if(!allowed.has(form.id)){
    e.preventDefault();e.stopImmediatePropagation();blocked();
  }
},true);

// Protecciones adicionales para botones que no pasan por formularios.
['newMonitor','editMonitor','deleteMonitor','newMonitorPayment','deleteMonitorPayment','deletePayment','editPayment'].forEach(name=>{
  if(typeof window[name]!=='function')return;
  const fn=window[name];window[name]=function(){if(isOp())return blocked('Monitoreos es de consulta en esta sesión.');return fn.apply(this,arguments)};
});

function refreshAccessUI(){
  try{window.dashboard();window.renderClients(document.getElementById('clientSearch')?.value||'');window.renderMonitors();applyOperativeControls()}catch(e){console.warn(e)}
}
window.addEventListener('simoun-access-change',refreshAccessUI);
window.addEventListener('simoun-activity-change',()=>{try{window.dashboard();if(isOp()&&clientDlg?.open){const title=clientDlgTitle?.textContent||'';const c=state.clients.find(x=>x.name===title);if(c)operativeClientView(c)}}catch(e){console.warn(e)}});

// La app ya se renderizó antes de cargar este archivo: aplicamos el modo correcto una vez.
setTimeout(refreshAccessUI,0);
})();
