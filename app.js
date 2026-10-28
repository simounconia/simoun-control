const PAGES=[['inicio','Inicio'],['expedientes','Expedientes'],['calendario','Calendario'],['pendientes','Pendientes'],['monitoreos','Monitoreos'],['jornada','Jornada']];
const ISSUE_TYPES=['Pregunta','Seguimiento','Reparación','Instalación','Mantenimiento','Cotización','Facturación','Cobro','Trabajo incompleto','Trabajo futuro / promesa'];
const TYPE_META={
  'Pregunta':{icon:'❓',color:'#7c3aed',bg:'#f3e8ff',ink:'#6d28d9'},
  'Seguimiento':{icon:'🔁',color:'#2563eb',bg:'#eaf2ff',ink:'#1d4ed8'},
  'Reparación':{icon:'🛠️',color:'#dc2626',bg:'#fff0f0',ink:'#b91c1c'},
  'Instalación':{icon:'🔧',color:'#15803d',bg:'#eaf8ef',ink:'#166534'},
  'Mantenimiento':{icon:'⚙️',color:'#0f766e',bg:'#e9f8f6',ink:'#115e59'},
  'Cotización':{icon:'🧾',color:'#4f46e5',bg:'#eeedff',ink:'#4338ca'},
  'Facturación':{icon:'📄',color:'#b45309',bg:'#fff7e6',ink:'#92400e'},
  'Cobro':{icon:'💰',color:'#ca8a04',bg:'#fff9db',ink:'#854d0e'},
  'Trabajo incompleto':{icon:'⚠️',color:'#e11d48',bg:'#fff0f4',ink:'#be123c'},
  'Trabajo futuro / promesa':{icon:'📌',color:'#c026d3',bg:'#fff0ff',ink:'#a21caf'}
};
const STATES=['Pendiente','En proceso','Esperando al cliente','Esperando autorización','Programado','Terminado','Cancelado'];
const PAY_STATES=['Pendiente','En proceso de pago','Pago parcial','Pagado'];
const PAY_DEST=['Efectivo','Depósito/transferencia — Cta. Factura ····0208','Depósito/transferencia — Cta. Remisión ····9615','Otro'];
const LS='simoun_operativo_v1';
const _rawLocalState=localStorage.getItem(LS);
let state=JSON.parse(_rawLocalState||'null')||{clients:[],monitors:[],history:[],_freshInstall:true};
let calCursor=new Date(); calCursor.setDate(1);
let issueTypeFilter='Todos';
let pendingFilter='Todos';
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;dashboard()});

function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
function save(){delete state._freshInstall;state._updatedAt=new Date().toISOString();localStorage.setItem(LS,JSON.stringify(state));renderAll();window.SimounSync?.queuePush(state)}
function esc(s=''){return String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]))}
function fmt(d){if(!d)return'';const x=new Date(d+'T12:00:00');return x.toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'})}
function today(){return new Date().toISOString().slice(0,10)}
function money(n){return Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'})}
function typeStyle(type){const m=TYPE_META[type]||{color:'#2e8bc0',bg:'#e9f4fb',ink:'#146b96'};return `--type:${m.color};--type-bg:${m.bg};--type-ink:${m.ink}`}
function typeTitle(type){const m=TYPE_META[type]||{icon:'•'};return `${m.icon} ${type}`}
function confirmDelete(message){return confirm(message+'\n\nEsta acción no se puede deshacer.')}

// Los datos reales no se incrustan en el sitio público. El expediente inicial de prueba
// se crea únicamente después de iniciar sesión, si la cuenta aún no tiene datos remotos.
window.SimounPrivateInitialState=function(){
  return {
    clients:[{id:uid(),name:'Ismael Soto',contact:'Arquitecto Santos',company:'5ta Cantera',address:'Andalucia 1 Blvd. García de León 1808 interior B, Chapultepec Sur, 58260',phone:'443 230 0254',whatsapp:'443 230 0254',notes:'',billing:'',issues:[],docs:[]}],
    monitors:[],history:[],_updatedAt:new Date().toISOString()
  };
};

function nav(){
  document.getElementById('nav').innerHTML=PAGES.map(([id,n],i)=>`<button data-page="${id}" class="${i===0?'active':''}">${n}</button>`).join('');
  document.querySelectorAll('#nav button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
}
function showPage(id){
  document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));
  document.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));
  document.getElementById('fab').style.display=id==='expedientes'?'block':'none';
  if(id==='expedientes')renderClients(document.getElementById('clientSearch')?.value||'');
  if(id==='calendario')renderCalendar();
  if(id==='pendientes')renderPendientes();
  if(id==='jornada'&&typeof renderJornada==='function')renderJornada();
}
function allIssues(){return state.clients.flatMap(c=>(c.issues||[]).map(i=>({...i,client:c})))}
function issueDates(i){
  const a=[];
  const followMode=i.followupMode||(i.followupDate?'Fecha':'Sin fecha');
  if(followMode==='Fecha'&&i.followupDate)a.push({date:i.followupDate,label:'Seguimiento'});
  const attention=i.attentionDate||i.appointmentDate;
  if(attention&&(!i.appointmentConfirmation||i.appointmentConfirmation==='Confirmada'))a.push({date:attention,label:'Atención / seguimiento / cita'});
  return a;
}
function activeIssues(){return allIssues().filter(x=>x.active!==false&&!['Terminado','Cancelado'].includes(x.state))}

function dashboard(){
  const issues=activeIssues();
  const ev=issues.flatMap(i=>issueDates(i).map(d=>({...d,issue:i})));
  const t=today();
  const overdue=ev.filter(e=>e.date<t).length, td=ev.filter(e=>e.date===t).length;
  document.getElementById('inicio').innerHTML=`
    <div class="grid cards">
      <div class="card"><div class="muted">Clientes</div><div class="metric">${state.clients.length}</div></div>
      <div class="card"><div class="muted">Asuntos activos</div><div class="metric">${issues.length}</div></div>
      <div class="card"><div class="muted">Vencidos</div><div class="metric">${overdue}</div></div>
      <div class="card"><div class="muted">Para hoy</div><div class="metric">${td}</div></div>
    </div>
    <div class="section-title"><h2>App y respaldo</h2></div>
    <div class="grid cards">
      <div class="card"><h3>☁️ Sincronización</h3><div style="margin:8px 0">${window.SimounSync?.statusHTML?.()||'<span class="badge orange">Local</span>'}</div><div class="muted">Mismos datos y documentos en PC y celular.</div><div class="toolbar" style="margin-top:10px"><button class="btn sm" onclick="SimounSync.openSettings()">Configurar</button><button class="btn sm secondary" onclick="SimounSync.syncNow()">Sincronizar</button></div></div>
      <div class="card"><h3>📲 Instalar SIMOUN</h3><div class="muted">Ábrela como una app independiente, sin pestañas del navegador.</div><div class="toolbar" style="margin-top:10px"><button class="btn sm" onclick="installPWA()">Instalar app</button></div></div>
    </div>`;
}

function typeFilterPanel(){
  const counts=Object.fromEntries(ISSUE_TYPES.map(t=>[t,allIssues().filter(i=>i.type===t).length]));
  const total=allIssues().length;
  return `<div class="card type-panel"><h3>Revisar asuntos en grupo</h3><div class="muted" style="margin-bottom:10px">Toca una categoría para ver juntos todos los asuntos de ese tipo.</div><div class="type-filters">
    <button class="type-filter ${issueTypeFilter==='Todos'?'active':''}" style="--type:#0b2c55" onclick="setIssueTypeFilter('Todos')"><strong>📚 Todos</strong><small>${total} asunto${total===1?'':'s'}</small></button>
    ${ISSUE_TYPES.map(t=>{const m=TYPE_META[t];return `<button class="type-filter ${issueTypeFilter===t?'active':''}" style="${typeStyle(t)}" onclick="setIssueTypeFilter(${JSON.stringify(t)})"><strong>${m.icon} ${esc(t)}</strong><small>${counts[t]} asunto${counts[t]===1?'':'s'}</small></button>`}).join('')}
  </div></div>`;
}
function setIssueTypeFilter(type){issueTypeFilter=type;renderClients(document.getElementById('clientSearch')?.value||'')}

function groupedReview(){
  if(issueTypeFilter==='Todos')return '';
  const rows=allIssues().filter(i=>i.type===issueTypeFilter);
  return `<div class="section-title"><h2>${typeTitle(issueTypeFilter)} <span class="muted">(${rows.length})</span></h2></div>
  <div class="review-list">${rows.map(i=>`<div class="card review-card" style="${typeStyle(i.type)}"><div class="issue-head"><div><strong>${esc(i.client.name||'Sin nombre')}</strong><div class="muted">${esc(i.client.company||'')}${i.client.contact?' · '+esc(i.client.contact):''}</div></div><span class="badge">${esc(i.state||'Pendiente')}</span></div><div style="margin:9px 0">${esc(i.description||'Sin descripción')}</div><div class="split-actions"><button class="btn sm secondary" onclick="openClient('${i.client.id}')">Abrir expediente</button><button class="btn sm" onclick="editIssue('${i.client.id}','${i.id}')">Editar</button><button class="btn sm danger" onclick="deleteIssue('${i.client.id}','${i.id}',true)">Borrar</button></div></div>`).join('')||'<div class="empty">No hay asuntos de este tipo.</div>'}</div>`;
}

function renderClients(q=''){
  const s=q.trim().toLowerCase();
  const arr=state.clients.filter(c=>[c.name,c.contact,c.company,c.address,c.phone,c.whatsapp].some(v=>(v||'').toLowerCase().includes(s)));
  document.getElementById('expedientes').innerHTML=`
    <div class="toolbar"><input id="clientSearch" class="search" placeholder="Buscar por cliente, empresa, teléfono o dirección" value="${esc(q)}"><button class="btn" onclick="newClient()">+ Nuevo expediente</button></div>
    ${typeFilterPanel()}
    ${groupedReview()}
    <div class="section-title"><h2>Expedientes</h2><span class="muted">${arr.length} cliente${arr.length===1?'':'s'}</span></div>
    <div class="list">${arr.map(c=>{
      const active=(c.issues||[]).filter(i=>i.active!==false&&!['Terminado','Cancelado'].includes(i.state));
      return `<div class="card client"><div><strong>${esc(c.name||'Sin nombre')}</strong><div class="muted">${esc(c.company||'')} ${c.contact?'· '+esc(c.contact):''}</div><div class="muted">${esc(c.phone||'')}</div><div class="badges">${active.slice(0,7).map(i=>`<span class="badge" style="${typeStyle(i.type)};background:var(--type-bg);color:var(--type-ink)">${esc(i.type)}</span>`).join('')}${active.length>7?`<span class="badge">+${active.length-7}</span>`:''}</div></div><div class="split-actions"><button class="btn sm" onclick="openClient('${c.id}')">Abrir / editar</button><button class="btn sm danger" onclick="deleteClient('${c.id}')">Borrar</button></div></div>`
    }).join('')||'<div class="empty">No encontré expedientes.</div>'}</div>`;
  document.getElementById('clientSearch').oninput=e=>renderClients(e.target.value);
}

function blankClient(){return{id:uid(),name:'',contact:'',company:'',address:'',phone:'',whatsapp:'',visitHours:'',notes:'',issues:[],docs:[]}}
function newClient(){editClient(blankClient(),true)}
function openClient(id){const c=state.clients.find(x=>x.id===id);if(c)editClient(c,false)}
function editClient(c,isNew){
  document.getElementById('clientDlgTitle').textContent=isNew?'Nuevo expediente':(c.name||'Expediente');
  document.getElementById('clientDlgBody').innerHTML=`
    <form id="clientForm">
      <div class="row"><div class="field"><label>Cliente</label><input name="name" value="${esc(c.name)}" required></div><div class="field"><label>Relación</label><input name="contact" value="${esc(c.contact)}"></div></div>
      <div class="row"><div class="field"><label>Empresa</label><input name="company" value="${esc(c.company)}"></div><div class="field"><label>Teléfono</label><input name="phone" value="${esc(c.phone)}"></div></div>
      <div class="field"><label>WhatsApp</label><input name="whatsapp" value="${esc(c.whatsapp)}"></div>
      <div class="field"><label>Dirección</label><textarea name="address">${esc(c.address)}</textarea></div>
      <div class="field"><label>Horarios generales de visita del cliente</label><input name="visitHours" value="${esc(c.visitHours||'')}" placeholder="Ej. Lunes a viernes de 10:00 a 14:00"></div>
      <div class="field"><label>Observaciones generales del cliente</label><textarea name="notes">${esc(c.notes)}</textarea></div>
      <div class="toolbar"><button class="btn" type="submit">💾 Guardar expediente</button>${!isNew?`<button type="button" class="btn secondary" onclick="newIssue('${c.id}')">+ Nuevo asunto</button><button type="button" class="btn danger" onclick="deleteClient('${c.id}',true)">🗑️ Borrar expediente</button>`:''}</div>
    </form>
    ${!isNew?`<div class="section-title"><h3>Asuntos</h3><span class="muted">${(c.issues||[]).length}</span></div><div class="list">${(c.issues||[]).map(i=>issueCard(c,i)).join('')||'<div class="empty">Todavía no hay asuntos.</div>'}</div>
    <div class="section-title"><h3>Documentos</h3></div><div class="notice">Los archivos se guardan localmente en este dispositivo.</div><div class="toolbar" style="margin-top:8px"><input type="file" id="docFile"><button class="btn secondary" type="button" onclick="addDoc('${c.id}')">Adjuntar</button></div><div id="docsList">${(c.docs||[]).map(d=>`<div class="doc"><span>📎 ${esc(d.name)} <small class="muted">${Math.round(d.size/1024)} KB</small></span><div class="split-actions"><button class="btn sm light" onclick="downloadDoc('${c.id}','${d.id}')">Abrir</button><button class="btn sm danger" onclick="deleteDoc('${c.id}','${d.id}')">Borrar</button></div></div>`).join('')}</div>`:''}`;
  document.getElementById('clientForm').onsubmit=e=>{
    e.preventDefault();const fd=new FormData(e.target);['name','contact','company','phone','whatsapp','address','visitHours','notes'].forEach(k=>c[k]=fd.get(k));
    if(isNew)state.clients.unshift(c);save();clientDlg.close();openClient(c.id);
  };
  clientDlg.showModal();
}
function deleteClient(cid,fromModal=false){
  const c=state.clients.find(x=>x.id===cid);if(!c)return;
  if(!confirmDelete(`¿Borrar el expediente de ${c.name||'este cliente'} y todos sus asuntos?`))return;
  state.clients=state.clients.filter(x=>x.id!==cid);save();if(fromModal)clientDlg.close();
}

function issueCard(c,i){
  const dates=issueDates(i);const m=TYPE_META[i.type]||{icon:'•'};
  return `<div class="card issue ${i.state==='Terminado'?'done':''} ${i.active===false?'disabled':''}" style="${typeStyle(i.type)}"><div class="issue-head"><div><div class="type-label">${m.icon} ${esc(i.type)}</div><div class="badges"><span class="badge">${esc(i.state)}</span>${i.active===false?'<span class="badge red">Desactivado</span>':''}</div></div><div class="split-actions"><button class="btn sm secondary" onclick="editIssue('${c.id}','${i.id}')">Editar</button><button class="btn sm danger" onclick="deleteIssue('${c.id}','${i.id}')">Borrar</button></div></div><div class="muted" style="margin-top:8px">${esc(i.description||'Sin descripción')}</div><div class="issue-grid">${dates.slice(0,5).map(d=>`<div class="kv"><b>${d.label}</b><br>${fmt(d.date)}</div>`).join('')}${i.type==='Cobro'?`<div class="kv"><b>Saldo</b><br>${money(i.balance||0)}</div>`:''}</div></div>`;
}
function blankIssue(){return{id:uid(),type:'Seguimiento',state:'Pendiente',description:'',notes:'',clientContactDate:today(),followupDate:'',followupMode:'Sin fecha',attentionDate:'',appointmentWindow:'',reported:false,incompleteReason:'',missingWork:'',nextAction:'',futurePromise:'',billingYes:'',productsServices:'',servicePrice:0,billingStatus:'',chargeNotes:'',actionNote:'',invoiced:'No',remisionada:'No',adminNote:'',total:0,paid:0,balance:0,payState:'Pendiente',paymentMethod:'',paymentDestination:'',active:true,history:[]}}
function newIssue(cid){editIssue(cid,null)}
function editIssue(cid,iid){
  const c=state.clients.find(x=>x.id===cid);if(!c)return;
  const isNew=!iid;let i=isNew?blankIssue():(c.issues||[]).find(x=>x.id===iid);if(!i)return;
  document.getElementById('issueDlgTitle').textContent=isNew?'Nuevo asunto':'Editar asunto';
  document.getElementById('issueDlgBody').innerHTML=`<form id="issueForm">
    <div class="row"><div class="field"><label>Tipo de asunto</label><select name="type">${ISSUE_TYPES.map(x=>`<option ${x===i.type?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Estado</label><select name="state">${STATES.map(x=>`<option ${x===i.state?'selected':''}>${x}</option>`).join('')}</select></div></div>
    <div class="switch-line"><input type="checkbox" id="activeIssue" name="active" ${i.active!==false?'checked':''}><label for="activeIssue"><strong>Asunto activo</strong><div class="muted">Desactívalo si quieres conservarlo sin que aparezca como pendiente activo.</div></label></div>
    <div class="field"><label>Descripción detallada</label><textarea name="description">${esc(i.description)}</textarea></div><div class="field"><label>Notas</label><textarea name="notes">${esc(i.notes)}</textarea></div><div class="field"><label>Productos y servicios</label><textarea name="productsServices" placeholder="Equipo, materiales y servicio">${esc(i.productsServices||'')}</textarea></div><div class="row"><div class="field"><label>Total del precio del servicio</label><input type="number" step="0.01" min="0" name="servicePrice" value="${i.servicePrice||0}"></div><div class="field"><label>Cobranza</label><select name="billingStatus"><option value="" ${!i.billingStatus?'selected':''}>Sin registrar</option><option value="Cuenta por cobrar" ${i.billingStatus==='Cuenta por cobrar'?'selected':''}>Cuenta por cobrar</option><option value="Pagada parcialmente" ${i.billingStatus==='Pagada parcialmente'?'selected':''}>Pagada parcialmente</option><option value="Pagada en su totalidad" ${i.billingStatus==='Pagada en su totalidad'?'selected':''}>Pagada en su totalidad</option></select></div></div><div class="field"><label>Notas sobre el cobro</label><textarea name="chargeNotes" placeholder="Forma de pago, acuerdos o aclaraciones">${esc(i.chargeNotes||'')}</textarea></div><div class="row"><div class="field"><label>Administrativo · Facturada</label><select name="invoiced"><option value="No" ${i.invoiced!=='Sí'?'selected':''}>No</option><option value="Sí" ${i.invoiced==='Sí'?'selected':''}>Sí</option></select></div><div class="field"><label>Administrativo · Remisionada</label><select name="remisionada"><option value="No" ${i.remisionada!=='Sí'?'selected':''}>No</option><option value="Sí" ${i.remisionada==='Sí'?'selected':''}>Sí</option></select></div></div><div class="field"><label>Nota interna administrativa</label><textarea name="adminNote" placeholder="Nota interna">${esc(i.adminNote||'')}</textarea></div>
    <div class="row"><div class="field"><label>Fecha de contacto del cliente</label><input type="date" name="clientContactDate" value="${i.clientContactDate||i.createdDate||today()}"></div><div class="field"><label>Fecha de seguimiento</label><select name="followupMode"><option value="Fecha" ${i.followupMode==='Fecha'||(!i.followupMode&&i.followupDate)?'selected':''}>Elegir fecha</option><option value="Diariamente" ${i.followupMode==='Diariamente'?'selected':''}>Diariamente</option><option value="Sin fecha" ${(!i.followupMode&&!i.followupDate)||i.followupMode==='Sin fecha'?'selected':''}>Sin fecha</option></select><div class="field" data-followup-date style="display:none"><label>Fecha de seguimiento</label><input type="date" name="followupDate" value="${i.followupDate||''}"></div></div></div>
    <div class="row"><div class="field"><label>Fecha de atención, seguimiento o cita</label><input type="date" name="attentionDate" value="${i.attentionDate||i.appointmentDate||''}"></div><div class="field"><label>Hora / ventana de cita</label><input name="appointmentWindow" value="${esc(i.appointmentWindow)}" placeholder="Ej. 10:00–13:00"></div></div>
    <div class="field"><label>Acción</label><input name="actionNote" value="${esc(i.actionNote||i.nextAction||'')}" placeholder="Llamar, cotizar, confirmar, dar seguimiento…"></div>
    <div id="conditional"></div>
    <div class="toolbar"><button class="btn" type="submit">💾 Guardar asunto</button>${!isNew?`<button class="btn secondary" type="button" onclick="finishIssue('${cid}','${i.id}')">✓ Marcar terminado</button><button class="btn danger" type="button" onclick="deleteIssue('${cid}','${i.id}')">🗑️ Borrar asunto</button>`:''}</div>
    ${!isNew&&i.history?.length?`<div class="section-title"><h3>Historial</h3></div><div class="history">${i.history.slice().reverse().map(h=>`<div class="history-item"><strong>${esc(h.action)}</strong><br>${new Date(h.date).toLocaleString('es-MX')}</div>`).join('')}</div>`:''}
  </form>`;
  const form=document.getElementById('issueForm');
  function cond(){
    const t=form.elements.type.value;let html='';
    if(t==='Trabajo incompleto')html=`<div class="card"><h3>Trabajo incompleto</h3><div class="field"><label>Motivo</label><textarea name="incompleteReason">${esc(i.incompleteReason)}</textarea></div><div class="field"><label>Qué falta</label><textarea name="missingWork">${esc(i.missingWork)}</textarea></div><div class="field"><label><input type="checkbox" name="reported" ${i.reported?'checked':''}> Ya fue reportado</label></div><div class="field"><label>Próxima acción</label><textarea name="nextAction">${esc(i.nextAction)}</textarea></div></div>`;
    if(t==='Trabajo futuro / promesa')html=`<div class="card"><h3>Trabajo futuro / promesa</h3><div class="field"><label>Qué ocurrirá posteriormente / promesa del cliente</label><textarea name="futurePromise">${esc(i.futurePromise)}</textarea></div></div>`;
    if(t==='Facturación')html=`<div class="card"><h3>Facturación</h3><div class="field"><label>¿Requiere factura?</label><select name="billingYes"><option value="">Sin definir</option><option ${i.billingYes==='Sí'?'selected':''}>Sí</option><option ${i.billingYes==='No'?'selected':''}>No</option></select></div><div class="notice">Los datos fiscales completos se guardan en la ficha general del cliente.</div></div>`;
    if(t==='Cobro')html=`<div class="card"><h3>Cobro</h3><div class="row"><div class="field"><label>Total a cobrar</label><input type="number" step="0.01" min="0" name="total" value="${i.total||0}"></div><div class="field"><label>Cantidad pagada</label><input type="number" step="0.01" min="0" name="paid" value="${i.paid||0}"></div></div><div class="field"><label>Estado del cobro</label><select name="payState">${PAY_STATES.map(x=>`<option ${x===i.payState?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Forma de pago</label><input name="paymentMethod" value="${esc(i.paymentMethod)}" placeholder="Transferencia, efectivo, etc."></div><div class="field"><label>Destino del pago</label><select name="paymentDestination"><option value="">Seleccionar</option>${PAY_DEST.map(x=>`<option ${x===i.paymentDestination?'selected':''}>${x}</option>`).join('')}</select></div></div>`;
    document.getElementById('conditional').innerHTML=html;
  }
  form.elements.type.onchange=cond;cond();
  const syncFollowupMode=()=>{const box=form.querySelector('[data-followup-date]'),mode=form.elements.followupMode.value;box.style.display=mode==='Fecha'?'grid':'none';if(mode!=='Fecha')form.elements.followupDate.value=''};
  form.elements.followupMode.onchange=syncFollowupMode;syncFollowupMode();
  form.onsubmit=e=>{
    e.preventDefault();const fd=new FormData(form);
    for(const [k,v] of fd.entries())i[k]=v;
    i.active=form.elements.active.checked;
    if(i.followupMode!=='Fecha')i.followupDate='';
    ['createdDate','actionDate','actionFrequency','appointmentDate','plannedEndDate','realEndDate','reportedDate','futureApproxDate','futureContactDate','paymentDate','proposedAppointmentDate'].forEach(k=>delete i[k]);
    i.reported=!!form.elements.reported?.checked;
    if(i.type==='Cobro'){i.total=Number(i.total||0);i.paid=Number(i.paid||0);i.balance=Math.max(0,i.total-i.paid)}
    i.history=i.history||[];i.history.push({date:new Date().toISOString(),action:isNew?'Creación':'Actualización'});
    if(isNew)c.issues.push(i);save();issueDlg.close();openClient(c.id);
  };
  issueDlg.showModal();
}
function finishIssue(cid,iid){const c=state.clients.find(x=>x.id===cid),i=c?.issues?.find(x=>x.id===iid);if(!i)return;i.state='Terminado';i.history=i.history||[];i.history.push({date:new Date().toISOString(),action:'Marcado como terminado'});save();issueDlg.close();openClient(cid)}
function deleteIssue(cid,iid,fromGroup=false){const c=state.clients.find(x=>x.id===cid),i=c?.issues?.find(x=>x.id===iid);if(!i)return;if(!confirmDelete(`¿Borrar este asunto de ${i.type}?`))return;c.issues=c.issues.filter(x=>x.id!==iid);save();if(!fromGroup){issueDlg.close();openClient(cid)}}

function events(){return allIssues().filter(i=>i.active!==false).flatMap(i=>issueDates(i).map(d=>({date:d.date,label:d.label+' · '+i.type,client:i.client,issue:i}))).sort((a,b)=>a.date.localeCompare(b.date))}
function renderCalendar(){
  const y=calCursor.getFullYear(),m=calCursor.getMonth();const first=new Date(y,m,1);let start=new Date(first);start.setDate(first.getDate()-((first.getDay()+6)%7));const ev=events();let cells='';
  for(let n=0;n<42;n++){const d=new Date(start);d.setDate(start.getDate()+n);const iso=d.toISOString().slice(0,10);const des=ev.filter(e=>e.date===iso);cells+=`<div class="day ${d.getMonth()!==m?'other':''} ${iso===today()?'today':''}" onclick="openDay('${iso}')"><div class="day-num">${d.getDate()}</div>${des.slice(0,3).map(e=>`<span class="event-dot">${esc(e.client.name)} · ${esc(e.issue.type)}</span>`).join('')}${des.length>3?`<span class="event-dot">+${des.length-3}</span>`:''}</div>`}
  document.getElementById('calendario').innerHTML=`<div class="calendar-head"><button class="btn secondary" onclick="moveMonth(-1)">‹</button><h2>${calCursor.toLocaleDateString('es-MX',{month:'long',year:'numeric'})}</h2><button class="btn secondary" onclick="moveMonth(1)">›</button></div><div class="calendar">${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(x=>`<div class="dow">${x}</div>`).join('')}${cells}</div>`;
}
function moveMonth(x){calCursor.setMonth(calCursor.getMonth()+x);renderCalendar()}
function openDay(iso){const es=events().filter(e=>e.date===iso);document.getElementById('dayDlgTitle').textContent='Agenda · '+fmt(iso);document.getElementById('dayDlgBody').innerHTML=es.map(e=>`<div class="card" style="${typeStyle(e.issue.type)};border-left:5px solid var(--type)"><strong>${esc(e.client.name)} · ${esc(e.issue.type)}</strong><div class="muted">${esc(e.label)} ${e.issue.appointmentWindow?'· '+esc(e.issue.appointmentWindow):''}</div><div style="margin-top:8px"><button class="btn sm" onclick="dayDlg.close();openClient('${e.client.id}')">Abrir expediente</button></div></div>`).join('')||'<div class="empty">No hay eventos este día.</div>';dayDlg.showModal()}

function pendingRows(){
  const t=today(),rows=[];
  activeIssues().forEach(i=>{const ds=issueDates(i);if(!ds.length)rows.push({group:'Sin fecha',date:'',issue:i,label:'Sin fecha asignada'});ds.forEach(d=>rows.push({group:d.date<t?'Vencidos':d.date===t?'Hoy':'Próximos',date:d.date,issue:i,label:d.label}));if(i.state==='Esperando al cliente')rows.push({group:'Esperando al cliente',date:'',issue:i,label:'Estado'});if(i.state==='Esperando autorización')rows.push({group:'Esperando autorización',date:'',issue:i,label:'Estado'});if(i.type==='Trabajo incompleto')rows.push({group:'Trabajo incompleto',date:i.attentionDate||(i.followupMode==='Fecha'?i.followupDate:'')||'',issue:i,label:'Trabajo incompleto'});if(i.type==='Cobro'&&i.payState!=='Pagado')rows.push({group:'Cobros pendientes',date:i.attentionDate||(i.followupMode==='Fecha'?i.followupDate:'')||'',issue:i,label:'Cobro · '+money(i.balance||0)})});
  return rows;
}
let pendingPriorityFilter='Todos', pendingOrder='manual', pendingDrag=null;
function pendingKey(i){return JSON.stringify([i.client.id,i.id])}
function pendingOrdered(){
  const list=activeIssues(), rank={Urgente:0,Importante:1,Normal:2};
  return list.sort((a,b)=>pendingOrder==='priority'?(rank[a.pendingPriority||'Normal']-rank[b.pendingPriority||'Normal']||((a.pendingRank??1e12)-(b.pendingRank??1e12))):((a.pendingRank??1e12)-(b.pendingRank??1e12)));
}
function pendingMove(from,to){
  const list=pendingOrdered(),a=list.findIndex(i=>pendingKey(i)===from),b=list.findIndex(i=>pendingKey(i)===to);
  if(a<0||b<0||a===b)return;
  const [item]=list.splice(a,1);list.splice(b,0,item);
  list.forEach((i,n)=>{state.clients.find(c=>c.id===i.client.id).issues.find(x=>x.id===i.id).pendingRank=n});
  pendingOrder='manual';save();
}
function renderPendientes(){
  const groups=['Todos','Vencidos','Hoy','Próximos','Sin fecha','Esperando al cliente','Esperando autorización','Trabajo incompleto','Cobros pendientes'];
  let rows=pendingRows();if(pendingFilter!=='Todos')rows=rows.filter(r=>r.group===pendingFilter);
  const grouped=new Map();rows.forEach(r=>{const k=pendingKey(r.issue);if(!grouped.has(k))grouped.set(k,{issue:r.issue,details:[]});grouped.get(k).details.push(r)});
  const visible=pendingOrdered().filter(i=>grouped.has(pendingKey(i))).filter(i=>pendingPriorityFilter==='Todos'||(pendingPriorityFilter==='Rápidos'?i.pendingQuick:pendingPriorityFilter==='Primero'?i.pendingFirst:(i.pendingPriority||'Normal')===pendingPriorityFilter));
  const root=document.getElementById('pendientes');
  root.innerHTML=`<div class="filters">${groups.map(g=>`<button class="filter ${g===pendingFilter?'active':''}" data-group="${esc(g)}">${g}</button>`).join('')}</div><div class="toolbar" style="margin:12px 0;display:flex;flex-wrap:wrap;gap:8px"><label>Mostrar <select id="pendingPriorityFilter">${['Todos','Urgente','Importante','Normal','Rápidos','Primero'].map(g=>`<option ${g===pendingPriorityFilter?'selected':''}>${g}</option>`).join('')}</select></label><label>Orden <select id="pendingOrder"><option value="manual" ${pendingOrder==='manual'?'selected':''}>Mi orden</option><option value="priority" ${pendingOrder==='priority'?'selected':''}>Por prioridad</option></select></label></div><p class="muted">Arrastra desde ↕ o usa las flechas. Las marcas y el siguiente paso se guardan automáticamente.</p><div class="list" id="pendingCards"></div>`;
  root.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{pendingFilter=b.dataset.group;renderPendientes()});
  root.querySelector('#pendingPriorityFilter').onchange=e=>{pendingPriorityFilter=e.target.value;renderPendientes()};
  root.querySelector('#pendingOrder').onchange=e=>{pendingOrder=e.target.value;renderPendientes()};
  const container=root.querySelector('#pendingCards');
  visible.forEach((i,index)=>{
    const real=()=>state.clients.find(c=>c.id===i.client.id)?.issues.find(x=>x.id===i.id);
    const update=(k,v)=>{const item=real();if(item){item[k]=v;save()}};
    const details=[...new Set(grouped.get(pendingKey(i)).details.map(r=>r.label+(r.date?' · '+fmt(r.date):'')))];
    const serviceCard=typeof exrService==='function'?exrService(i.client,i):issueCard(i.client,i);
    const card=document.createElement('div');card.className='card pending-item';card.style.cssText=typeStyle(i.type)+';border-left:5px solid var(--type)';
    card.innerHTML=`<div class="pending-client-head"><div><strong>${esc(i.client.name)}</strong><div class="muted">${esc(i.client.company||'')}</div></div><button class="btn sm secondary" type="button" data-open-client>Ver cliente</button></div><div class="pending-context">${details.map(d=>'<span class="badge orange">'+esc(d)+'</span>').join('')}</div><div class="pending-service-shell">${serviceCard}</div><div class="pending-controls"><div class="pending-actions"></div><label class="pending-next-step">Siguiente paso<input class="pending-note" style="width:100%;box-sizing:border-box;margin-top:6px" maxlength="500" placeholder="Ej. Llamarle hoy para acordar cita" value="${esc(i.pendingNote||'')}"></label><div class="pending-note-actions" style="display:flex;align-items:center;gap:8px;margin-top:6px"><button class="btn sm" type="button">✓ Guardar nota</button><small class="pending-saved" aria-live="polite">${i.pendingNote?'Nota guardada':''}</small></div></div>`;
    card.querySelector('[data-open-client]').onclick=()=>openClient(i.client.id);
    const actions=card.querySelector('.pending-actions');
    function button(text,fn,active=false){const b=document.createElement('button');b.type='button';b.className='btn sm '+(active?'':'secondary');b.textContent=text;b.onclick=fn;actions.append(b);return b}
    [['Urgente','🔴'],['Importante','🟠'],['Normal','⚪']].forEach(([v,icon])=>{const active=(i.pendingPriority||'Normal')===v;button(icon+' '+v,()=>update('pendingPriority',v),active).setAttribute('aria-pressed',active)});
    button('⚡ Rápido',()=>update('pendingQuick',!i.pendingQuick),!!i.pendingQuick).setAttribute('aria-pressed',!!i.pendingQuick);
    button('📌 Primero',()=>{const item=real();if(!item)return;item.pendingFirst=!item.pendingFirst;if(item.pendingFirst)item.pendingRank=Math.min(0,...activeIssues().map(x=>x.pendingRank??0))-1;pendingOrder='manual';save()},!!i.pendingFirst).setAttribute('aria-pressed',!!i.pendingFirst);
    const handle=button('↕ Arrastrar',()=>{});handle.draggable=true;handle.style.cursor='grab';handle.ondragstart=e=>{pendingDrag=pendingKey(i);e.dataTransfer.setData('text/plain',pendingDrag);e.dataTransfer.effectAllowed='move'};handle.ondragend=()=>{pendingDrag=null};
    card.ondragover=e=>{if(pendingDrag){e.preventDefault();e.dataTransfer.dropEffect='move'}};card.ondrop=e=>{e.preventDefault();if(pendingDrag)pendingMove(pendingDrag,pendingKey(i));pendingDrag=null};
    button('↑',()=>pendingMove(pendingKey(i),pendingKey(visible[index-1]))).disabled=index===0;
    button('↓',()=>pendingMove(pendingKey(i),pendingKey(visible[index+1]))).disabled=index===visible.length-1;
    button('Abrir',()=>openClient(i.client.id));
    const input=card.querySelector('.pending-note'),saveNote=card.querySelector('.pending-note-actions button'),saved=card.querySelector('.pending-saved');input.oninput=()=>{saved.textContent='Cambios sin guardar'};saveNote.onclick=()=>{const item=real();if(!item)return;item.pendingNote=input.value;try{delete state._freshInstall;state._updatedAt=new Date().toISOString();localStorage.setItem(LS,JSON.stringify(state));window.SimounSync?.queuePush(state);saved.textContent='✓ Nota guardada'}catch{saved.textContent='No se pudo guardar. Intenta de nuevo.'}};
    container.append(card);
  });
  if(!visible.length)container.innerHTML='<div class="empty">No hay pendientes en esta categoría.</div>';
}

function renderMonitors(){document.getElementById('monitoreos').innerHTML=`<div class="notice">Módulo separado dentro de la misma aplicación. Esta versión permite guardar, editar y borrar clientes de monitoreo.</div><div class="section-title"><h2>Monitoreos</h2><button class="btn" onclick="addMonitor()">+ Cliente</button></div><div class="list">${state.monitors.map(m=>`<div class="card monitor-row"><div class="wide"><strong>${esc(m.name)}</strong><div class="muted">${esc(m.company||'')}</div></div><div><small class="muted">Mensualidad</small><br>${money(m.monthly||0)}</div><div><small class="muted">Cubierto hasta</small><br>${esc(m.coveredThrough||'Sin dato')}</div><div class="split-actions"><button class="btn sm secondary" onclick="editMonitor('${m.id}')">Editar</button><button class="btn sm danger" onclick="deleteMonitor('${m.id}')">Borrar</button></div></div>`).join('')||'<div class="empty">Aún no hay clientes de monitoreo.</div>'}</div>`}
function addMonitor(){const name=prompt('Nombre del cliente de monitoreo');if(!name)return;state.monitors.push({id:uid(),name,company:'',monthly:0,coveredThrough:'',payments:[]});save()}
function editMonitor(id){const m=state.monitors.find(x=>x.id===id);if(!m)return;const company=prompt('Empresa',m.company||'');if(company===null)return;const monthly=prompt('Mensualidad',m.monthly||0);if(monthly===null)return;const cov=prompt('Cubierto hasta (ej. Octubre 2026)',m.coveredThrough||'');if(cov===null)return;m.company=company;m.monthly=Number(monthly||0);m.coveredThrough=cov;save()}
function deleteMonitor(id){const m=state.monitors.find(x=>x.id===id);if(!m)return;if(!confirmDelete(`¿Borrar a ${m.name} de Monitoreos?`))return;state.monitors=state.monitors.filter(x=>x.id!==id);save()}

function db(){return new Promise((res,rej)=>{const r=indexedDB.open('simoun_docs',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function addDoc(cid){
  const f=document.getElementById('docFile').files[0];if(!f)return alert('Selecciona un archivo.');
  const id=uid(),d=await db(),tx=d.transaction('files','readwrite');tx.objectStore('files').put({id,blob:f});
  await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});
  const c=state.clients.find(x=>x.id===cid);c.docs=c.docs||[];c.docs.push({id,name:f.name,size:f.size,type:f.type});save();
  try{await window.SimounSync?.uploadDocument?.(id,f,f.name)}catch(e){console.warn('Documento pendiente de sincronizar',e)}
  openClient(cid)
}
async function downloadDoc(cid,id){
  const c=state.clients.find(x=>x.id===cid),doc=c?.docs?.find(x=>x.id===id);if(!doc)return;
  const d=await db();let blob=await new Promise((res,rej)=>{const tx=d.transaction('files','readonly'),r=tx.objectStore('files').get(id);r.onsuccess=()=>res(r.result?.blob||null);r.onerror=()=>rej(r.error)});
  if(!blob){try{blob=await window.SimounSync?.downloadDocument?.(id,doc.name);if(blob){const tx=d.transaction('files','readwrite');tx.objectStore('files').put({id,blob});await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}}catch(e){console.warn(e)}}
  if(!blob)return alert('Archivo no disponible en este dispositivo y no pudo descargarse del respaldo.');
  const url=URL.createObjectURL(blob);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),60000)
}
async function deleteDoc(cid,id){
  const c=state.clients.find(x=>x.id===cid),doc=c?.docs?.find(x=>x.id===id);if(!doc)return;if(!confirmDelete(`¿Borrar el documento ${doc.name}?`))return;
  try{const d=await db(),tx=d.transaction('files','readwrite');tx.objectStore('files').delete(id);await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}catch{}
  try{await window.SimounSync?.deleteDocument?.(id,doc.name)}catch(e){console.warn(e)}
  c.docs=c.docs.filter(x=>x.id!==id);save();openClient(cid)
}

async function installPWA(){
  if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;dashboard();return}
  alert('Si no aparece el instalador automático, abre el menú del navegador y elige “Instalar app” o “Agregar a pantalla principal”.')
}

function renderAll(){dashboard();renderClients();renderCalendar();renderPendientes();renderMonitors();if(typeof renderJornada==='function')renderJornada()}
nav();renderAll();document.getElementById('fab').onclick=newClient;showPage('inicio');
window.SimounSync?.init({getState:()=>state,applyState:(remote)=>{state=remote;renderAll()}});
if('serviceWorker' in navigator && location.protocol!=='file:'){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(console.warn))}
window.addEventListener('online',()=>window.SimounSync?.refreshStatus?.());window.addEventListener('offline',()=>window.SimounSync?.refreshStatus?.());
