// Módulo de Monitoreos / Mensualidades SIMOUN
// Conserva el estado dentro de state.monitors para que la sincronización existente lo respalde.
const MONITOR_START='2026-10';
const MONITOR_FILTERS=['Todos','Activos','Baja','Vencido','Por cobrar','Adelantado'];
const MONITOR_STATUS_META={
  'PAGADO':{label:'Pagado',cls:'paid'},
  'ADELANTADO':{label:'Adelantado',cls:'advance'},
  'PARCIAL':{label:'Parcial',cls:'partial'},
  'VENCIDO':{label:'Vencido',cls:'overdue'},
  'POR COBRAR':{label:'Por cobrar',cls:'due'},
  'FUTURO':{label:'Futuro',cls:'future'},
  'BAJA':{label:'Baja',cls:'inactive'}
};
let monitorFilter='Todos';
let monitorSearch='';
let monitorCalendarStart=MONITOR_START;

function monthKey(v){return (v||'').slice(0,7)}
function currentMonthKey(){return today().slice(0,7)}
function addMonth(key,n){const [y,m]=key.split('-').map(Number);const d=new Date(y,m-1+n,1,12);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
function monthLabel(key,short=false){if(!key)return'';const [y,m]=key.split('-').map(Number);return new Date(y,m-1,1,12).toLocaleDateString('es-MX',{month:short?'short':'long',year:'numeric'})}
function monthRange(from,to){if(!from||!to||from>to)return[];const out=[];let k=from;for(let n=0;n<120&&k<=to;n++,k=addMonth(k,1))out.push(k);return out}
function monitorDefaults(m){
  m.id=m.id||uid();m.name=m.name||'';m.company=m.company||'';m.contact=m.contact||'';m.phone=m.phone||'';m.whatsapp=m.whatsapp||m.phone||'';m.email=m.email||'';m.address=m.address||'';m.notes=m.notes||'';m.clientNotes=m.clientNotes||'';
  m.monthly=Number(m.monthly||0);m.invoice=m.invoice||'No';m.status=m.status||'ACTIVO';m.startMonth=m.startMonth||MONITOR_START;m.endDate=m.endDate||'';m.habitualMethod=m.habitualMethod||'';m.bankEnding=m.bankEnding||'';
  m.payments=Array.isArray(m.payments)?m.payments:[];m.monthlyHistory=Array.isArray(m.monthlyHistory)?m.monthlyHistory:[];
  if(!m.monthlyHistory.length&&m.monthly>0)m.monthlyHistory=[{from:m.startMonth||MONITOR_START,amount:m.monthly}];
  m.payments.forEach(p=>{p.id=p.id||uid();p.date=p.date||today();p.amount=Number(p.amount||0);p.periodFrom=p.periodFrom||currentMonthKey();p.periodTo=p.periodTo||p.periodFrom;p.method=p.method||'';p.destination=p.destination||'';p.invoice=p.invoice||'No';p.reference=p.reference||'';p.notes=p.notes||''});
  return m;
}
function monthlyFor(m,key){monitorDefaults(m);const hist=m.monthlyHistory.filter(h=>h.from<=key).sort((a,b)=>a.from.localeCompare(b.from));return Number(hist.length?hist[hist.length-1].amount:m.monthly||0)}
function monitorActiveInMonth(m,key){monitorDefaults(m);if(key<(m.startMonth||MONITOR_START))return false;if(m.status==='BAJA'){const end=m.endDate?monthKey(m.endDate):currentMonthKey();return key<=end}return true}
function monitorAllocations(m){
  monitorDefaults(m);const out={};
  [...m.payments].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).forEach(p=>{
    let remaining=Number(p.amount||0);const months=monthRange(p.periodFrom,p.periodTo);
    months.forEach(k=>{if(remaining<=0||!monitorActiveInMonth(m,k))return;const due=monthlyFor(m,k);const already=out[k]||0;const missing=Math.max(0,due-already);const put=Math.min(remaining,missing);out[k]=(out[k]||0)+put;remaining-=put});
  });
  return out;
}
function monitorMonthInfo(m,key){
  monitorDefaults(m);if(!monitorActiveInMonth(m,key))return{status:'BAJA',due:0,paid:0,balance:0};
  const due=monthlyFor(m,key),paid=monitorAllocations(m)[key]||0,balance=Math.max(0,due-paid),cur=currentMonthKey();
  let status='FUTURO';if(paid>=due&&due>0)status=key>cur?'ADELANTADO':'PAGADO';else if(paid>0)status='PARCIAL';else if(key<cur)status='VENCIDO';else if(key===cur)status='POR COBRAR';
  return{status,due,paid,balance};
}
function monitorPaidThrough(m){
  monitorDefaults(m);let last='';const stop=addMonth(currentMonthKey(),36);for(let k=m.startMonth||MONITOR_START,n=0;n<120&&k<=stop;n++,k=addMonth(k,1)){const x=monitorMonthInfo(m,k);if(x.status==='PAGADO'||x.status==='ADELANTADO')last=k;else break}return last
}
function monitorDebt(m){let total=0;const cur=currentMonthKey();for(let k=m.startMonth||MONITOR_START,n=0;n<120&&k<cur;n++,k=addMonth(k,1)){const x=monitorMonthInfo(m,k);if(x.status!=='BAJA')total+=x.balance}return total}
function monitorCurrentDue(m){const x=monitorMonthInfo(m,currentMonthKey());return x.status==='BAJA'?0:x.balance}
function monitorHasAdvance(m){const cur=currentMonthKey();return (m.payments||[]).some(p=>p.periodTo>cur&&Number(p.amount||0)>0)}
function monitorSummary(){
  const ms=state.monitors.map(monitorDefaults),active=ms.filter(m=>m.status!=='BAJA');return{
    active:active.length,
    expected:active.reduce((s,m)=>s+monthlyFor(m,currentMonthKey()),0),
    overdue:active.reduce((s,m)=>s+monitorDebt(m),0),
    current:active.reduce((s,m)=>s+monitorCurrentDue(m),0)
  }
}
function monitorMatchesFilter(m){if(monitorFilter==='Todos')return true;if(monitorFilter==='Activos')return m.status!=='BAJA';if(monitorFilter==='Baja')return m.status==='BAJA';if(monitorFilter==='Vencido')return monitorDebt(m)>0;if(monitorFilter==='Por cobrar')return monitorCurrentDue(m)>0;if(monitorFilter==='Adelantado')return monitorHasAdvance(m);return true}
function setMonitorFilter(v){monitorFilter=v;renderMonitors()}
function setMonitorSearch(v){monitorSearch=v;renderMonitors()}
function moveMonitorMonths(n){monitorCalendarStart=addMonth(monitorCalendarStart,n);if(monitorCalendarStart<MONITOR_START)monitorCalendarStart=MONITOR_START;renderMonitors()}
function monitorStatusCell(m,key){const x=monitorMonthInfo(m,key),meta=MONITOR_STATUS_META[x.status]||MONITOR_STATUS_META.FUTURO;return `<div class="month-cell ${meta.cls}" title="${meta.label} · ${money(x.paid)} de ${money(x.due)}"><strong>${monthLabel(key,true)}</strong><span>${meta.label}</span>${x.status==='PARCIAL'?`<small>${money(x.paid)}</small>`:''}</div>`}
function monitorWhatsApp(id){const m=state.monitors.find(x=>x.id===id);if(!m)return;let p=String(m.whatsapp||m.phone||'').replace(/\D/g,'');if(p.length===10)p='52'+p;if(!p)return alert('Este cliente no tiene WhatsApp registrado.');window.open('https://wa.me/'+p,'_blank')}

function renderMonitors(){
  const sum=monitorSummary(),q=monitorSearch.trim().toLowerCase(),months=Array.from({length:12},(_,i)=>addMonth(monitorCalendarStart,i));
  const arr=state.monitors.map(monitorDefaults).filter(m=>[m.name,m.company,m.contact,m.phone,m.whatsapp,m.clientNotes].some(v=>(v||'').toLowerCase().includes(q))).filter(monitorMatchesFilter);
  document.getElementById('monitoreos').innerHTML=`
    <div class="monitor-hero"><div><h2>🖥️ Monitoreos · Mensualidades</h2><div>Control confiable desde octubre de 2026. Pagos, anticipos, adeudos y cobertura por mes.</div></div><button class="btn monitor-primary" onclick="newMonitor()">+ Cliente de monitoreo</button></div>
    <div class="grid monitor-summary"><div class="card"><div class="muted">Servicios activos</div><div class="metric">${sum.active}</div></div><div class="card"><div class="muted">Ingreso mensual esperado</div><div class="metric">${money(sum.expected)}</div></div><div class="card"><div class="muted">Adeudo vencido</div><div class="metric">${money(sum.overdue)}</div></div><div class="card"><div class="muted">Por cobrar mes actual</div><div class="metric">${money(sum.current)}</div></div></div>
    <div class="card monitor-tools"><div class="toolbar"><input class="search" placeholder="Buscar por cliente, empresa, contacto o teléfono" value="${esc(monitorSearch)}" oninput="setMonitorSearch(this.value)"><button class="btn monitor-primary" onclick="newMonitor()">+ Cliente</button></div><div class="filters">${MONITOR_FILTERS.map(f=>`<button class="filter monitor-filter ${monitorFilter===f?'active':''}" onclick="setMonitorFilter(${JSON.stringify(f)})">${f}</button>`).join('')}</div></div>
    <div class="calendar-head monitor-calendar-head"><button class="btn secondary" onclick="moveMonitorMonths(-6)">‹ 6 meses</button><h3>${monthLabel(months[0])} — ${monthLabel(months[months.length-1])}</h3><button class="btn secondary" onclick="moveMonitorMonths(6)">6 meses ›</button></div>
    <div class="monitor-legend"><span class="legend paid">Pagado</span><span class="legend advance">Adelantado</span><span class="legend partial">Parcial</span><span class="legend overdue">Vencido</span><span class="legend due">Por cobrar</span><span class="legend future">Futuro</span><span class="legend inactive">Baja</span></div>
    <div class="list monitor-list">${arr.map(m=>{
      const paidThrough=monitorPaidThrough(m),debt=monitorDebt(m),cur=monitorCurrentDue(m);
      return `<div class="card monitor-card ${m.status==='BAJA'?'monitor-baja':''}"><div class="monitor-card-head"><div><div class="monitor-name">${esc(m.name||'Sin nombre')}</div><div class="muted">${esc(m.company||'')}${m.contact?' · '+esc(m.contact):''}</div>${m.clientNotes?`<div class="notice" style="margin-top:8px"><strong>Notas del cliente:</strong> ${esc(m.clientNotes)}</div>`:''}<div class="badges"><span class="badge ${m.status==='BAJA'?'red':'green'}">${esc(m.status)}</span><span class="badge">${m.invoice==='Sí'?'Factura':'No factura'}</span>${debt>0?`<span class="badge red">Vencido ${money(debt)}</span>`:''}${cur>0?`<span class="badge orange">Mes actual ${money(cur)}</span>`:''}${monitorHasAdvance(m)?'<span class="badge blue">Adelantado</span>':''}</div></div><div class="monitor-money"><small>Mensualidad</small><strong>${money(monthlyFor(m,currentMonthKey()))}</strong><small>Pagado hasta</small><strong>${paidThrough?monthLabel(paidThrough):'Sin pago'}</strong></div></div>
      <div class="split-actions monitor-actions"><button class="btn sm monitor-primary" onclick="newMonitorPayment('${m.id}')">💰 Registrar pago</button><button class="btn sm secondary" onclick="editMonitor('${m.id}')">Editar</button><button class="btn sm light" onclick="monitorWhatsApp('${m.id}')">WhatsApp</button><button class="btn sm danger" onclick="deleteMonitor('${m.id}')">Borrar</button></div>
      <div class="coverage-wrap"><div class="coverage-strip">${months.map(k=>monitorStatusCell(m,k)).join('')}</div></div></div>`
    }).join('')||'<div class="empty">No hay clientes que coincidan con este filtro.</div>'}</div>`;
}
function blankMonitor(){return monitorDefaults({id:uid(),name:'',company:'',contact:'',phone:'',whatsapp:'',email:'',address:'',notes:'',clientNotes:'',monthly:0,invoice:'No',status:'ACTIVO',startMonth:MONITOR_START,endDate:'',habitualMethod:'',bankEnding:'',monthlyHistory:[],payments:[]})}
function newMonitor(){editMonitor(null)}
function editMonitor(id){
  const isNew=!id,m=isNew?blankMonitor():state.monitors.find(x=>x.id===id);if(!m)return;monitorDefaults(m);
  const dlg=document.getElementById('monitorDlg'),body=document.getElementById('monitorDlgBody');document.getElementById('monitorDlgTitle').textContent=isNew?'Nuevo cliente de monitoreo':m.name;
  body.innerHTML=`<form id="monitorForm"><div class="row"><div class="field"><label>Cliente / servicio</label><input name="name" value="${esc(m.name)}" required></div><div class="field"><label>Empresa / razón social</label><input name="company" value="${esc(m.company)}"></div></div><div class="row"><div class="field"><label>Contacto</label><input name="contact" value="${esc(m.contact)}"></div><div class="field"><label>Teléfono</label><input name="phone" value="${esc(m.phone)}"></div></div><div class="row"><div class="field"><label>WhatsApp</label><input name="whatsapp" value="${esc(m.whatsapp)}"></div><div class="field"><label>Correo</label><input type="email" name="email" value="${esc(m.email)}"></div></div><div class="field"><label>Dirección</label><textarea name="address">${esc(m.address)}</textarea></div><div class="row"><div class="field"><label>Mensualidad</label><input type="number" step="0.01" min="0" name="monthly" value="${m.monthly||0}" required></div><div class="field"><label>Aplicar nueva mensualidad desde</label><input type="month" name="feeEffectiveMonth" value="${currentMonthKey()}" min="${MONITOR_START}"></div></div><div class="row"><div class="field"><label>Factura</label><select name="invoice"><option ${m.invoice==='No'?'selected':''}>No</option><option ${m.invoice==='Sí'?'selected':''}>Sí</option></select></div><div class="field"><label>Estado del servicio</label><select name="status"><option ${m.status==='ACTIVO'?'selected':''}>ACTIVO</option><option ${m.status==='BAJA'?'selected':''}>BAJA</option></select></div></div><div class="row"><div class="field"><label>Control desde</label><input type="month" name="startMonth" value="${m.startMonth||MONITOR_START}" min="${MONITOR_START}"></div><div class="field"><label>Fecha de baja</label><input type="date" name="endDate" value="${m.endDate||''}"></div></div><div class="row"><div class="field"><label>Forma de pago habitual</label><input name="habitualMethod" value="${esc(m.habitualMethod)}" placeholder="Transferencia, efectivo, etc."></div><div class="field"><label>Banco / terminación</label><input name="bankEnding" value="${esc(m.bankEnding)}" placeholder="Ej. Factura ····0208"></div></div><div class="field"><label>Observaciones generales</label><textarea name="notes">${esc(m.notes)}</textarea></div><div class="field"><label>Notas del cliente / forma de trabajo</label><textarea name="clientNotes" placeholder="Acuerdos, instrucciones, horarios especiales o detalles de cómo trabajamos con este cliente">${esc(m.clientNotes)}</textarea></div><div class="toolbar"><button class="btn monitor-primary" type="submit">💾 Guardar cliente</button>${!isNew?`<button type="button" class="btn secondary" onclick="monitorDlg.close();newMonitorPayment('${m.id}')">💰 Registrar pago</button><button type="button" class="btn danger" onclick="deleteMonitor('${m.id}',true)">🗑️ Borrar</button>`:''}</div></form>${!isNew?monitorPaymentsHTML(m):''}`;
  document.getElementById('monitorForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target),oldMonthly=Number(m.monthly||0);['name','company','contact','phone','whatsapp','email','address','invoice','status','startMonth','endDate','habitualMethod','bankEnding','notes','clientNotes'].forEach(k=>m[k]=fd.get(k)||'');m.startMonth=m.startMonth||MONITOR_START;const newMonthly=Number(fd.get('monthly')||0),eff=fd.get('feeEffectiveMonth')||currentMonthKey();m.monthly=newMonthly;m.monthlyHistory=m.monthlyHistory||[];if(isNew||newMonthly!==oldMonthly||!m.monthlyHistory.length){m.monthlyHistory=m.monthlyHistory.filter(h=>h.from!==eff);m.monthlyHistory.push({from:eff,amount:newMonthly});m.monthlyHistory.sort((a,b)=>a.from.localeCompare(b.from))}if(isNew)state.monitors.unshift(m);save();dlg.close();};dlg.showModal()
}
function monitorPaymentsHTML(m){const ps=[...(m.payments||[])].sort((a,b)=>(b.date||'').localeCompare(a.date||''));return `<div class="section-title"><h3>Historial de pagos</h3><button class="btn sm monitor-primary" onclick="monitorDlg.close();newMonitorPayment('${m.id}')">+ Pago</button></div><div class="list">${ps.map(p=>`<div class="card payment-row"><div><strong>${fmt(p.date)} · ${money(p.amount)}</strong><div class="muted">${monthLabel(p.periodFrom)}${p.periodTo!==p.periodFrom?' → '+monthLabel(p.periodTo):''} · ${esc(p.method||'Sin método')}${p.invoice==='Sí'?' · Factura':''}</div>${p.notes?`<div class="muted">${esc(p.notes)}</div>`:''}</div><div class="split-actions"><button class="btn sm secondary" onclick="monitorDlg.close();editMonitorPayment('${m.id}','${p.id}')">Editar</button><button class="btn sm danger" onclick="deleteMonitorPayment('${m.id}','${p.id}')">Borrar</button></div></div>`).join('')||'<div class="empty">Aún no hay pagos registrados.</div>'}</div>`}
function newMonitorPayment(mid){editMonitorPayment(mid,null)}
function editMonitorPayment(mid,pid){
  const m=state.monitors.find(x=>x.id===mid);if(!m)return;monitorDefaults(m);const isNew=!pid,p=isNew?{id:uid(),date:today(),amount:monthlyFor(m,currentMonthKey()),periodFrom:currentMonthKey(),periodTo:currentMonthKey(),method:m.habitualMethod||'',destination:'',invoice:m.invoice||'No',reference:'',notes:''}:m.payments.find(x=>x.id===pid);if(!p)return;
  const dlg=document.getElementById('paymentDlg');document.getElementById('paymentDlgTitle').textContent=(isNew?'Registrar pago · ':'Editar pago · ')+m.name;document.getElementById('paymentDlgBody').innerHTML=`<form id="paymentForm"><div class="row"><div class="field"><label>Fecha de pago</label><input type="date" name="date" value="${p.date||today()}" required></div><div class="field"><label>Importe</label><input type="number" step="0.01" min="0" name="amount" value="${p.amount||0}" required></div></div><div class="row"><div class="field"><label>Periodo desde</label><input type="month" name="periodFrom" value="${p.periodFrom||currentMonthKey()}" min="${MONITOR_START}" required></div><div class="field"><label>Periodo hasta</label><input type="month" name="periodTo" value="${p.periodTo||p.periodFrom||currentMonthKey()}" min="${MONITOR_START}" required></div></div><div class="row"><div class="field"><label>Forma de pago</label><input name="method" value="${esc(p.method)}" placeholder="Transferencia, efectivo, depósito..."></div><div class="field"><label>Destino / cuenta</label><select name="destination"><option value="">Sin definir</option>${PAY_DEST.map(x=>`<option ${p.destination===x?'selected':''}>${x}</option>`).join('')}</select></div></div><div class="row"><div class="field"><label>Factura</label><select name="invoice"><option ${p.invoice==='No'?'selected':''}>No</option><option ${p.invoice==='Sí'?'selected':''}>Sí</option></select></div><div class="field"><label>Comprobante / referencia</label><input name="reference" value="${esc(p.reference)}"></div></div><div class="field"><label>Observaciones</label><textarea name="notes">${esc(p.notes)}</textarea></div><div class="notice">Para pagos adelantados, selecciona el primer y último mes que cubre el pago. El calendario mensual se actualiza automáticamente.</div><div class="toolbar" style="margin-top:12px"><button class="btn monitor-primary" type="submit">💾 Guardar pago</button>${!isNew?`<button class="btn danger" type="button" onclick="deleteMonitorPayment('${m.id}','${p.id}',true)">🗑️ Borrar pago</button>`:''}</div></form>`;
  document.getElementById('paymentForm').onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target),from=fd.get('periodFrom'),to=fd.get('periodTo');if(from>to)return alert('El periodo hasta no puede ser anterior al periodo desde.');['date','periodFrom','periodTo','method','destination','invoice','reference','notes'].forEach(k=>p[k]=fd.get(k)||'');p.amount=Number(fd.get('amount')||0);if(isNew)m.payments.push(p);save();dlg.close();};dlg.showModal()
}
function deleteMonitorPayment(mid,pid,fromDialog=false){const m=state.monitors.find(x=>x.id===mid),p=m?.payments?.find(x=>x.id===pid);if(!p)return;if(!confirmDelete(`¿Borrar el pago de ${money(p.amount)} del ${fmt(p.date)}?`))return;m.payments=m.payments.filter(x=>x.id!==pid);save();if(fromDialog)paymentDlg.close();if(document.getElementById('monitorDlg')?.open)editMonitor(mid)}
function deleteMonitor(id,fromModal=false){const m=state.monitors.find(x=>x.id===id);if(!m)return;if(!confirmDelete(`¿Borrar a ${m.name} de Monitoreos y todo su historial de pagos?`))return;state.monitors=state.monitors.filter(x=>x.id!==id);save();if(fromModal)monitorDlg.close()}

// La aplicación base renderiza Monitoreos al cargar. Actualizamos inmediatamente esta vista
// para sustituir la versión preliminar por el control mensual completo.
renderMonitors();
