// SIMOUN: hace que "Reporte para jefe" respete el filtro seleccionado en Pendientes.
(function(){
'use strict';
if(window.__simounFilteredBossReport)return;
window.__simounFilteredBossReport=true;

function clean(value,fallback='No registrado'){
  const text=String(value??'').trim();
  return text||fallback;
}
function localDate(){return new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});}
function rowsForFilter(group){
  if(group==='Todos')return (typeof activeIssues==='function'?activeIssues():[]).map(issue=>({group:'Todos',date:'',label:'Asunto activo',issue,refs:['Asunto activo']}));
  const rows=(typeof pendingRows==='function'?pendingRows():[]).filter(r=>r.group===group);
  const byIssue=new Map();
  rows.forEach(r=>{
    const key=String(r.issue?.id||Math.random());
    if(!byIssue.has(key))byIssue.set(key,{...r,refs:[]});
    const item=byIssue.get(key);
    const ref=[r.label,r.date?(typeof fmt==='function'?fmt(r.date):r.date):''].filter(Boolean).join(' · ');
    if(ref&&!item.refs.includes(ref))item.refs.push(ref);
  });
  return Array.from(byIssue.values());
}
function buildReport(group){
  const rows=rowsForFilter(group);
  const grouped=new Map();
  rows.forEach(row=>{
    const issue=row.issue||{};
    const client=issue.client||{};
    const key=String(client.id||client.name||'sin-cliente');
    if(!grouped.has(key))grouped.set(key,{client,items:[]});
    grouped.get(key).items.push(row);
  });
  const clients=Array.from(grouped.values()).sort((a,b)=>String(a.client.name||'').localeCompare(String(b.client.name||''),'es'));
  const lines=[`REPORTE PARA JEFE · SIMOUN`,`Categoría: ${group}`,`Fecha: ${localDate()}`,`Clientes: ${clients.length} · Servicios: ${rows.length}`,''];
  if(!rows.length){lines.push(`No hay registros en la categoría “${group}”.`);return lines.join('\n');}
  clients.forEach((entry,clientIndex)=>{
    if(clientIndex)lines.push('','────────────────────────','');
    const c=entry.client;
    const fallbackAddress=entry.items.map(x=>String(x.issue?.serviceAddress||'').trim()).find(Boolean)||'';
    lines.push(`${clientIndex+1}. CLIENTE: ${clean(c.name,'Sin nombre')}`);
    lines.push(`WhatsApp: ${clean(c.whatsapp,'No registrado')}`);
    lines.push(`Dirección: ${clean(c.address||fallbackAddress,'No registrada')}`);
    if(String(c.notes||'').trim())lines.push(`Observaciones generales: ${String(c.notes).trim()}`);
    entry.items.forEach((row,serviceIndex)=>{
      const i=row.issue||{};
      lines.push('');
      lines.push(`   Servicio ${serviceIndex+1}`);
      lines.push(`   Tipo de servicio: ${clean(i.type,'Sin tipo')}`);
      lines.push(`   Estatus: ${clean(i.state,'Pendiente')}`);
      const windowText=String(i.clientAvailability||i.appointmentWindow||i.proposedAppointmentWindow||'').trim();
      if(windowText)lines.push(`   Ventana de atención: ${windowText}`);
      if(row.refs?.length)lines.push(`   Referencia de ${group}: ${row.refs.join(' / ')}`);
      lines.push(`   Descripción del trabajo: ${clean(i.description,'Sin descripción')}`);
      lines.push(`   Notas: ${clean(i.notes,'Sin notas')}`);
      if(i.type==='Cobro'&&Number(i.balance||0)>0)lines.push(`   Saldo pendiente: ${typeof money==='function'?money(i.balance):i.balance}`);
      if(i.type==='Trabajo incompleto'&&String(i.nextAction||'').trim())lines.push(`   Próxima acción: ${String(i.nextAction).trim()}`);
      if(i.type==='Trabajo futuro / promesa'&&String(i.futurePromise||'').trim())lines.push(`   Promesa / trabajo futuro: ${String(i.futurePromise).trim()}`);
    });
  });
  return lines.join('\n');
}
function ensureDialog(){
  let dlg=document.getElementById('filteredBossReportDlg');
  if(dlg)return dlg;
  dlg=document.createElement('dialog');
  dlg.id='filteredBossReportDlg';
  dlg.innerHTML=`<div class="modal-head"><strong id="filteredBossReportTitle">📋 Reporte para jefe</strong><button class="close" type="button">×</button></div><div class="modal-body"><div class="notice" id="filteredBossReportNotice" style="margin-bottom:10px"></div><textarea id="filteredBossReportText" style="width:100%;min-height:420px;padding:12px;border:1px solid var(--line);border-radius:12px;resize:vertical;background:#fff;color:var(--ink)"></textarea><div class="toolbar" style="margin-top:12px"><button class="btn" type="button" id="filteredBossCopy">📋 Copiar</button><button class="btn secondary" type="button" id="filteredBossShare">📤 Compartir</button><button class="btn light" type="button" id="filteredBossDownload">⬇️ Descargar</button></div><div id="filteredBossStatus" class="muted" role="status" aria-live="polite"></div></div>`;
  document.body.appendChild(dlg);
  dlg.querySelector('.close').onclick=()=>dlg.close();
  dlg.querySelector('#filteredBossCopy').onclick=async()=>{
    const ta=dlg.querySelector('#filteredBossReportText');let ok=false;
    try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(ta.value);ok=true;}}catch{}
    if(!ok){ta.focus();ta.select();try{ok=document.execCommand('copy');}catch{}}
    dlg.querySelector('#filteredBossStatus').textContent=ok?'✅ Copiado. Ya puedes pegarlo en WhatsApp.':'Selecciona el texto y usa Copiar.';
  };
  dlg.querySelector('#filteredBossShare').onclick=async()=>{
    if(typeof navigator.share!=='function'){dlg.querySelector('#filteredBossStatus').textContent='Compartir no está disponible en este dispositivo.';return;}
    try{await navigator.share({title:dlg.querySelector('#filteredBossReportTitle').textContent,text:dlg.querySelector('#filteredBossReportText').value});}catch(e){if(e?.name!=='AbortError')dlg.querySelector('#filteredBossStatus').textContent='No se pudo abrir el menú para compartir.';}
  };
  dlg.querySelector('#filteredBossDownload').onclick=()=>{
    const group=String(typeof pendingFilter!=='undefined'?pendingFilter:'Todos');
    const blob=new Blob(['\ufeff',dlg.querySelector('#filteredBossReportText').value],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');
    const safe=group.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_');
    a.href=url;a.download=`SIMOUN_${safe||'Todos'}_${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
  };
  return dlg;
}
function openFilteredReport(){
  const group=String(typeof pendingFilter!=='undefined'?pendingFilter:'Todos');
  const dlg=ensureDialog();
  dlg.querySelector('#filteredBossReportTitle').textContent=`📋 Reporte para jefe · ${group}`;
  dlg.querySelector('#filteredBossReportNotice').textContent=`Este reporte incluye solamente la categoría seleccionada: ${group}.`;
  dlg.querySelector('#filteredBossReportText').value=buildReport(group);
  dlg.querySelector('#filteredBossStatus').textContent='';
  if(!dlg.open)dlg.showModal();
}

document.addEventListener('click',e=>{
  const btn=e.target?.closest?.('#pendientes [data-daily-report]');
  if(!btn)return;
  e.preventDefault();
  e.stopImmediatePropagation();
  openFilteredReport();
},true);
})();