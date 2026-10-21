// SIMOUN: reporte para jefe según la categoría seleccionada en "Revisar asuntos en grupo".
(function(){
'use strict';
if(window.__simounBossReportByType)return;
window.__simounBossReportByType=true;

function clean(value,fallback='No registrado'){
  const text=String(value??'').trim();
  return text||fallback;
}
function localDate(){
  return new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});
}
function safeFilePart(value){
  return String(value||'Todos').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'Todos';
}
function issueListForType(type){
  const rows=typeof allIssues==='function'?allIssues():[];
  return type==='Todos'?rows:rows.filter(i=>i.type===type);
}
function addDate(lines,label,value){
  if(!value)return;
  lines.push(`   ${label}: ${typeof fmt==='function'?fmt(value):value}`);
}
function serviceLines(issue,index){
  const lines=[
    `   Servicio ${index+1}`,
    `   Tipo de servicio: ${clean(issue.type,'Sin tipo')}`,
    `   Estatus: ${clean(issue.state,'Pendiente')}`
  ];
  const serviceAddress=String(issue.serviceAddress||'').trim();
  if(serviceAddress)lines.push(`   Dirección del servicio: ${serviceAddress}`);
  const windowText=String(issue.clientAvailability||issue.appointmentWindow||issue.proposedAppointmentWindow||'').trim();
  if(windowText)lines.push(`   Ventana de atención: ${windowText}`);
  if(String(issue.appointmentConfirmation||'').trim())lines.push(`   Estado de cita: ${String(issue.appointmentConfirmation).trim()}`);
  lines.push(`   Descripción del trabajo: ${clean(issue.description,'Sin descripción')}`);
  lines.push(`   Notas: ${clean(issue.notes,'Sin notas')}`);
  addDate(lines,'Fecha de creación',issue.createdDate);
  addDate(lines,'Seguimiento',issue.followupDate);
  addDate(lines,'Acción',issue.actionDate);
  addDate(lines,'Cita',issue.appointmentDate||issue.proposedAppointmentDate);
  addDate(lines,'Término previsto',issue.plannedEndDate);
  addDate(lines,'Término real',issue.realEndDate);
  addDate(lines,'Contacto futuro',issue.futureContactDate);
  addDate(lines,'Fecha reportada',issue.reportedDate);
  addDate(lines,'Fecha de pago',issue.paymentDate);
  if(issue.type==='Trabajo incompleto'){
    if(String(issue.incompleteReason||'').trim())lines.push(`   Motivo de trabajo incompleto: ${String(issue.incompleteReason).trim()}`);
    if(String(issue.missingWork||'').trim())lines.push(`   Qué falta: ${String(issue.missingWork).trim()}`);
    if(String(issue.nextAction||'').trim())lines.push(`   Próxima acción: ${String(issue.nextAction).trim()}`);
  }
  if(issue.type==='Trabajo futuro / promesa'){
    if(String(issue.futurePromise||'').trim())lines.push(`   Promesa / trabajo futuro: ${String(issue.futurePromise).trim()}`);
    addDate(lines,'Fecha aproximada',issue.futureApproxDate);
  }
  if(issue.type==='Facturación'&&String(issue.billingYes||'').trim()){
    lines.push(`   Requiere factura: ${String(issue.billingYes).trim()}`);
  }
  if(issue.type==='Cobro'){
    if(Number(issue.total||0))lines.push(`   Total a cobrar: ${typeof money==='function'?money(issue.total):issue.total}`);
    if(Number(issue.paid||0))lines.push(`   Pagado: ${typeof money==='function'?money(issue.paid):issue.paid}`);
    lines.push(`   Saldo pendiente: ${typeof money==='function'?money(issue.balance||0):(issue.balance||0)}`);
    if(String(issue.payState||'').trim())lines.push(`   Estado del cobro: ${String(issue.payState).trim()}`);
    if(String(issue.paymentMethod||'').trim())lines.push(`   Forma de pago: ${String(issue.paymentMethod).trim()}`);
    if(String(issue.paymentDestination||'').trim())lines.push(`   Destino del pago: ${String(issue.paymentDestination).trim()}`);
  }
  if(issue.active===false)lines.push('   Asunto activo: No');
  return lines;
}
function buildReport(type){
  const issues=issueListForType(type);
  const grouped=new Map();
  issues.forEach(issue=>{
    const client=issue.client||{};
    const key=String(client.id||client.name||'sin-cliente');
    if(!grouped.has(key))grouped.set(key,{client,issues:[]});
    grouped.get(key).issues.push(issue);
  });
  const clients=Array.from(grouped.values()).sort((a,b)=>String(a.client.name||'').localeCompare(String(b.client.name||''),'es'));
  const lines=[
    'REPORTE PARA JEFE · SIMOUN',
    `Categoría de asunto: ${type}`,
    `Fecha: ${localDate()}`,
    `Clientes: ${clients.length} · Asuntos: ${issues.length}`,
    ''
  ];
  if(!issues.length){
    lines.push(`No hay asuntos en la categoría “${type}”.`);
    return {text:lines.join('\n'),count:0};
  }
  clients.forEach((entry,clientIndex)=>{
    if(clientIndex)lines.push('','────────────────────────','');
    const c=entry.client;
    const fallbackAddress=entry.issues.map(i=>String(i.serviceAddress||'').trim()).find(Boolean)||'';
    lines.push(`${clientIndex+1}. CLIENTE: ${clean(c.name,'Sin nombre')}`);
    if(String(c.company||'').trim())lines.push(`Empresa: ${String(c.company).trim()}`);
    if(String(c.contact||'').trim())lines.push(`Contacto: ${String(c.contact).trim()}`);
    lines.push(`WhatsApp: ${clean(c.whatsapp,'No registrado')}`);
    lines.push(`Dirección: ${clean(c.address||fallbackAddress,'No registrada')}`);
    if(String(c.notes||'').trim())lines.push(`Observaciones generales: ${String(c.notes).trim()}`);
    lines.push(`Asuntos de esta categoría: ${entry.issues.length}`);
    entry.issues.forEach((issue,index)=>{
      lines.push('');
      lines.push(...serviceLines(issue,index));
    });
  });
  return {text:lines.join('\n'),count:issues.length};
}
function ensureDialog(){
  let dlg=document.getElementById('typeBossReportDlg');
  if(dlg)return dlg;
  dlg=document.createElement('dialog');
  dlg.id='typeBossReportDlg';
  dlg.innerHTML=`<div class="modal-head"><strong id="typeBossReportTitle">📋 Reporte para jefe</strong><button class="close" type="button" aria-label="Cerrar">×</button></div><div class="modal-body"><div class="notice" id="typeBossReportNotice" style="margin-bottom:10px"></div><textarea id="typeBossReportText" aria-label="Reporte para jefe" style="width:100%;min-height:420px;padding:12px;border:1px solid var(--line);border-radius:12px;resize:vertical;background:#fff;color:var(--ink)"></textarea><div class="toolbar" style="margin-top:12px"><button class="btn" type="button" id="typeBossCopy">📋 Copiar</button><button class="btn secondary" type="button" id="typeBossShare">📤 Compartir</button><button class="btn light" type="button" id="typeBossDownload">⬇️ Descargar</button></div><div id="typeBossStatus" class="muted" role="status" aria-live="polite"></div></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('.close').onclick=()=>dlg.close();
  dlg.querySelector('#typeBossCopy').onclick=async()=>{
    const ta=dlg.querySelector('#typeBossReportText');let ok=false;
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(ta.value);ok=true;}}catch{}
    if(!ok){ta.focus();ta.select();try{ok=document.execCommand('copy');}catch{}}
    dlg.querySelector('#typeBossStatus').textContent=ok?'✅ Copiado. Ya puedes pegarlo en WhatsApp.':'Selecciona el texto y usa Copiar.';
  };
  dlg.querySelector('#typeBossShare').onclick=async()=>{
    if(typeof navigator.share!=='function'){dlg.querySelector('#typeBossStatus').textContent='Compartir no está disponible en este dispositivo.';return;}
    try{await navigator.share({title:dlg.querySelector('#typeBossReportTitle').textContent,text:dlg.querySelector('#typeBossReportText').value});}
    catch(e){if(e?.name!=='AbortError')dlg.querySelector('#typeBossStatus').textContent='No se pudo abrir el menú para compartir.';}
  };
  dlg.querySelector('#typeBossDownload').onclick=()=>{
    const type=String(typeof issueTypeFilter!=='undefined'?issueTypeFilter:'Todos');
    const blob=new Blob(['\ufeff',dlg.querySelector('#typeBossReportText').value],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download=`SIMOUN_${safeFilePart(type)}_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  };
  return dlg;
}
function openTypeReport(){
  const type=String(typeof issueTypeFilter!=='undefined'?issueTypeFilter:'Todos');
  const report=buildReport(type);
  const dlg=ensureDialog();
  dlg.querySelector('#typeBossReportTitle').textContent=`📋 Reporte para jefe · ${type}`;
  dlg.querySelector('#typeBossReportNotice').textContent=`Este reporte incluye solamente los asuntos de la categoría seleccionada: ${type}.`;
  dlg.querySelector('#typeBossReportText').value=report.text;
  dlg.querySelector('#typeBossStatus').textContent=report.count?'':'No hay asuntos en esta categoría.';
  if(!dlg.open)dlg.showModal();
}
function updateReportButton(){
  const btn=document.querySelector('#expedientes [data-daily-report]');
  if(!btn)return;
  const type=String(typeof issueTypeFilter!=='undefined'?issueTypeFilter:'Todos');
  btn.textContent=`📋 Reporte para jefe · ${type}`;
}

document.addEventListener('click',e=>{
  const reportBtn=e.target?.closest?.('#expedientes [data-daily-report]');
  if(reportBtn){
    e.preventDefault();e.stopImmediatePropagation();openTypeReport();return;
  }
  const typeBtn=e.target?.closest?.('#expedientes .type-filter');
  if(typeBtn)setTimeout(updateReportButton,0);
},true);

const root=document.getElementById('expedientes');
if(root)new MutationObserver(updateReportButton).observe(root,{childList:true,subtree:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',updateReportButton);else updateReportButton();
})();