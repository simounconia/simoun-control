// SIMOUN: reportes por categoría para compartir con el jefe.
// Aditivo: no cambia ni migra los expedientes guardados.
(function(){
  'use strict';
  if(window.__simounCategoryReports)return;
  window.__simounCategoryReports=true;

  function reportTypes(){
    const base=Array.isArray(ISSUE_TYPES)?ISSUE_TYPES.slice():[];
    return ['Todos',...base];
  }

  function currentType(){
    try{return reportTypes().includes(issueTypeFilter)?issueTypeFilter:'Todos'}catch{return 'Todos'}
  }

  function clean(v,fallback=''){
    const text=String(v??'').trim();
    return text||fallback;
  }
  function has(v){
    if(v===null||v===undefined)return false;
    if(typeof v==='string')return v.trim()!=='';
    if(typeof v==='number')return Number.isFinite(v)&&v!==0;
    if(typeof v==='boolean')return v===true;
    if(Array.isArray(v))return v.length>0;
    if(typeof v==='object')return Object.keys(v).length>0;
    return true;
  }
  function add(lines,label,value,prefix=''){
    if(!has(value))return;
    lines.push(`${prefix}${label}: ${clean(value)}`);
  }
  function dateText(v){
    if(!has(v))return '';
    const s=String(v);
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return typeof fmt==='function'?fmt(s):s;
    const d=new Date(s);
    return Number.isNaN(d.getTime())?s:d.toLocaleString('es-MX');
  }
  function moneyText(v){return typeof money==='function'?money(Number(v||0)):String(v||0)}
  function dateLabel(){return new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'})}

  function matchingIssues(type){
    let rows=[];
    if(typeof activeIssues==='function')rows=activeIssues().slice();
    else if(typeof allIssues==='function')rows=allIssues().filter(i=>i.active!==false&&!['Terminado','Cancelado'].includes(i.state));
    if(type&&type!=='Todos')rows=rows.filter(i=>i.type===type);
    rows.sort((a,b)=>{
      const nc=String(a.client?.name||'').localeCompare(String(b.client?.name||''),'es');
      if(nc)return nc;
      const ad=String(a.createdDate||''),bd=String(b.createdDate||'');
      if(ad!==bd)return ad.localeCompare(bd);
      return String(a.type||'').localeCompare(String(b.type||''),'es');
    });
    return rows;
  }

  function workReports(client,issue){
    try{
      const rows=window.SimounSync?.issueActivities?.(client?.id,issue?.id)||[];
      return Array.isArray(rows)?rows:[];
    }catch{return []}
  }

  function issueHistoryLines(issue,prefix='      '){
    const history=Array.isArray(issue.history)?issue.history:[];
    if(!history.length)return [];
    const lines=[`${prefix}Historial del asunto:`];
    history.forEach(h=>{
      const bits=[dateText(h.date),clean(h.action),clean(h.detail)].filter(Boolean);
      if(bits.length)lines.push(`${prefix}- ${bits.join(' · ')}`);
    });
    return lines.length>1?lines:[];
  }

  function serviceLines(client,issue,index){
    const p='   ',d='      ';
    const lines=[`${p}Servicio ${index+1}`];
    add(lines,'Tipo de servicio',issue.type,d);
    add(lines,'Estatus',issue.state,d);
    if(issue.active===false)lines.push(`${d}Asunto activo: No`);
    add(lines,'Descripción del trabajo',issue.description,d);
    add(lines,'Notas',issue.notes,d);
    add(lines,'Dirección del servicio',issue.serviceAddress,d);
    add(lines,'Creado por',issue.createdBy,d);
    

    const contactDate=issue.clientContactDate||issue.createdDate;
    if(has(contactDate))lines.push(`${d}Fecha de contacto del cliente: ${dateText(contactDate)}`);
    const followMode=issue.followupMode||(issue.followupDate?'Fecha':'Sin fecha');
    const serviceDate=followMode==='Fecha'&&has(issue.followupDate)?dateText(issue.followupDate):followMode;
    lines.push(`${d}Fecha de seguimiento o atención: ${serviceDate}`);
    if(has(issue.confirmedAppointmentDate))lines.push(`${d}Fecha de cita confirmada: ${dateText(issue.confirmedAppointmentDate)}`);
    add(lines,'Ventana de tiempo para cita confirmada',issue.appointmentWindow,d);
    add(lines,'Observaciones',issue.observations||issue.actionNote,d);
    add(lines,'Disponibilidad del cliente',issue.clientAvailability,d);
    add(lines,'Confirmación de cita',issue.appointmentConfirmation,d);
    add(lines,'Horario propuesto por el jefe',issue.proposedAppointmentWindow,d);
    add(lines,'Persona que recibirá',issue.appointmentReceiver,d);
    add(lines,'Nota de coordinación',issue.appointmentNote,d);

    if(issue.reported===true)lines.push(`${d}Ya fue reportado: Sí`);
    add(lines,'Motivo de trabajo incompleto',issue.incompleteReason,d);
    add(lines,'Qué falta',issue.missingWork,d);
    add(lines,'Próxima acción',issue.nextAction,d);
    add(lines,'Trabajo futuro / promesa',issue.futurePromise,d);
    add(lines,'Requiere factura',issue.billingYes,d);

    if(has(issue.total))lines.push(`${d}Total a cobrar: ${moneyText(issue.total)}`);
    if(has(issue.paid))lines.push(`${d}Cantidad pagada: ${moneyText(issue.paid)}`);
    if(has(issue.balance))lines.push(`${d}Saldo pendiente: ${moneyText(issue.balance)}`);
    add(lines,'Estado del cobro',issue.payState,d);
    add(lines,'Forma de pago',issue.paymentMethod,d);
    add(lines,'Destino del pago',issue.paymentDestination,d);

    const reports=workReports(client,issue);
    if(reports.length){
      lines.push(`${d}Reportes / anotaciones del equipo:`);
      reports.forEach(r=>{
        const who=clean(r.actor_email||r.actor_name||r.actor_role);
        const bits=[dateText(r.created_at),clean(r.status),clean(r.note),who].filter(Boolean);
        if(bits.length)lines.push(`${d}- ${bits.join(' · ')}`);
      });
    }

    lines.push(...issueHistoryLines(issue,d));
    return lines;
  }

  function financeLines(c){
    const a=c?.finanzasCliente;
    if(!a||typeof a!=='object')return [];
    const lines=[];
    if(has(a.saldo))lines.push(`Saldo pendiente del cliente: ${moneyText(a.saldo)}`);
    if(has(a.due))lines.push(`Fecha prometida de pago: ${dateText(a.due)}`);
    add(lines,'Notas de cobro',a.notes);
    const inv=a.invoice||{};
    add(lines,'Factura requerida',inv.needed);
    add(lines,'Estado de factura',inv.status);
    add(lines,'Folio de factura',inv.folio);
    if(has(inv.issued))lines.push(`Fecha de emisión: ${dateText(inv.issued)}`);
    if(has(inv.delivered))lines.push(`Fecha de entrega: ${dateText(inv.delivered)}`);
    const payments=Array.isArray(a.payments)?a.payments:[];
    if(payments.length){
      lines.push('Historial de pagos:');
      payments.forEach(p=>{
        const bits=[dateText(p.date),has(p.amount)?moneyText(p.amount):'',clean(p.method),clean(p.note),p.void?'ANULADO':''].filter(Boolean);
        if(bits.length)lines.push(`- ${bits.join(' · ')}`);
      });
    }
    return lines;
  }

  function clientHistoryLines(c){
    const history=Array.isArray(c?.history)?c.history:[];
    if(!history.length)return [];
    const lines=['Historial de la ficha:'];
    history.forEach(h=>{
      const bits=[dateText(h.date),clean(h.action),clean(h.detail)].filter(Boolean);
      if(bits.length)lines.push(`- ${bits.join(' · ')}`);
    });
    return lines.length>1?lines:[];
  }

  function clientHeaderLines(c,issues,index){
    const lines=[`${index+1}. CLIENTE: ${clean(c.name,'Sin nombre')}`];
    add(lines,'Empresa',c.company);
    add(lines,'Contacto',c.contact);
    add(lines,'Teléfono',c.phone);
    add(lines,'WhatsApp',c.whatsapp);
    add(lines,'Correo',c.email);
    const fallbackAddress=issues.map(i=>clean(i.serviceAddress)).find(Boolean)||'';
    add(lines,'Dirección',c.address||fallbackAddress);
    add(lines,'Observaciones generales',c.notes);
    add(lines,'Datos de facturación',c.billing);
    add(lines,'Creado por',c.createdBy);
    if(has(c.createdAt))lines.push(`Fecha de alta: ${dateText(c.createdAt)}`);

    const docs=Array.isArray(c.docs)?c.docs:[];
    if(docs.length){
      lines.push('Documentos adjuntos:');
      docs.forEach(doc=>{
        const size=Number(doc.size||0)>0?` · ${Math.round(Number(doc.size)/1024)} KB`:'';
        lines.push(`- ${clean(doc.name,'Documento')}${size}`);
      });
    }

    const finance=financeLines(c);
    if(finance.length){lines.push('');lines.push('DATOS DE COBRO / FACTURACIÓN');lines.push(...finance)}
    const hist=clientHistoryLines(c);
    if(hist.length){lines.push('');lines.push(...hist)}
    lines.push(`Servicios en este reporte: ${issues.length}`);
    return lines;
  }

  function buildReport(type='Todos'){
    const rows=matchingIssues(type);
    const grouped=new Map();
    rows.forEach(issue=>{
      const client=issue.client||{};
      const key=String(client.id||client.name||'sin-cliente');
      if(!grouped.has(key))grouped.set(key,{client,issues:[]});
      grouped.get(key).issues.push(issue);
    });
    const groups=Array.from(grouped.values());
    const title=type==='Todos'?'TODOS LOS PENDIENTES':String(type).toUpperCase();
    const lines=[`SIMOUN · REPORTE ${title} · ${dateLabel()}`,`Clientes: ${groups.length} · Servicios activos: ${rows.length}`,''];
    if(!rows.length){lines.push(`No hay asuntos activos en ${type==='Todos'?'esta lista':type}.`);return lines.join('\n')}

    groups.forEach((group,clientIndex)=>{
      if(clientIndex)lines.push('','────────────────────','');
      lines.push(...clientHeaderLines(group.client||{},group.issues,clientIndex));
      group.issues.forEach((issue,serviceIndex)=>{
        lines.push('');
        lines.push(...serviceLines(group.client||{},issue,serviceIndex));
      });
    });
    return lines.join('\n');
  }

  function ensureDialog(){
    let dlg=document.getElementById('categoryReportDlg');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id='categoryReportDlg';
    dlg.innerHTML=`
      <div class="modal-head"><strong>📋 Reporte para jefe</strong><button class="close" type="button" aria-label="Cerrar">×</button></div>
      <div class="modal-body">
        <div class="field" style="margin-bottom:10px"><label>Qué quieres reportar</label><select id="categoryReportType"></select></div>
        <div class="notice" style="margin-bottom:10px">Incluye solamente asuntos activos de la categoría elegida. Dentro de cada ficha aparecen todos los campos que estén llenados; los campos vacíos se omiten.</div>
        <textarea id="categoryReportText" aria-label="Reporte por categoría" style="width:100%;min-height:420px;padding:12px;border:1px solid var(--line);border-radius:12px;resize:vertical;background:#fff;color:var(--ink)"></textarea>
        <div class="toolbar" style="margin-top:12px"><button class="btn" type="button" id="categoryCopyBtn">📋 Copiar</button><button class="btn secondary" type="button" id="categoryShareBtn">📤 Compartir</button><button class="btn light" type="button" id="categoryRefreshBtn">↻ Actualizar</button></div>
        <div id="categoryReportStatus" class="muted" role="status" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(dlg);
    const select=dlg.querySelector('#categoryReportType'),textarea=dlg.querySelector('#categoryReportText'),status=dlg.querySelector('#categoryReportStatus');
    const refresh=()=>{textarea.value=buildReport(select.value||'Todos');status.textContent=''};
    dlg.querySelector('.close').addEventListener('click',()=>dlg.close());
    select.addEventListener('change',refresh);
    dlg.querySelector('#categoryRefreshBtn').addEventListener('click',()=>{refresh();status.textContent='Reporte actualizado.'});
    dlg.querySelector('#categoryCopyBtn').addEventListener('click',async()=>{
      let ok=false;
      try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(textarea.value);ok=true}}catch{}
      if(!ok){textarea.focus();textarea.select();try{ok=document.execCommand('copy')}catch{}textarea.setSelectionRange(0,0)}
      status.textContent=ok?'✅ Copiado. Ya puedes pegarlo en WhatsApp.':'Selecciona el texto y usa Copiar.';
    });
    const share=dlg.querySelector('#categoryShareBtn');
    if(typeof navigator.share!=='function')share.style.display='none';
    else share.addEventListener('click',async()=>{try{await navigator.share({title:'Reporte SIMOUN · '+(select.value||'Todos'),text:textarea.value})}catch(e){if(e&&e.name!=='AbortError')status.textContent='No se pudo abrir el menú para compartir.'}});
    return dlg;
  }

  function openCategoryReport(type=currentType()){
    const dlg=ensureDialog(),select=dlg.querySelector('#categoryReportType'),types=reportTypes();
    select.innerHTML=types.map(t=>`<option value="${String(t).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}">${t}</option>`).join('');
    select.value=types.includes(type)?type:'Todos';
    dlg.querySelector('#categoryReportText').value=buildReport(select.value);
    dlg.querySelector('#categoryReportStatus').textContent='';
    dlg.showModal();
  }
  window.openCategoryReport=openCategoryReport;

  function replaceOldReportButtons(root=document){
    root.querySelectorAll('[data-daily-report]').forEach(old=>{
      if(old.dataset.categoryReportReady==='1')return;
      const btn=old.cloneNode(true);
      btn.dataset.categoryReportReady='1';btn.textContent='📋 Reporte para jefe';
      btn.addEventListener('click',()=>openCategoryReport(currentType()));
      old.replaceWith(btn);
    });
  }

  function addCategoryButton(){
    const root=document.getElementById('expedientes');if(!root)return;
    const list=root.querySelector('.review-list');if(!list)return;
    const title=list.previousElementSibling;if(!title||title.querySelector('[data-category-report-one]'))return;
    const type=currentType();if(type==='Todos')return;
    const btn=document.createElement('button');
    btn.type='button';btn.className='btn sm secondary';btn.dataset.categoryReportOne='1';btn.textContent=`📋 Reporte de ${type}`;
    btn.addEventListener('click',()=>openCategoryReport(type));title.appendChild(btn);
  }

  function enhance(){replaceOldReportButtons(document);addCategoryButton()}
  function install(){
    if(typeof renderClients==='function'&&!renderClients.__categoryReportEnhanced){
      const base=renderClients;const wrapped=function(q=''){const result=base(q);enhance();return result};wrapped.__categoryReportEnhanced=true;renderClients=wrapped;
    }
    if(typeof renderPendientes==='function'&&!renderPendientes.__categoryReportEnhanced){
      const base=renderPendientes;const wrapped=function(){const result=base();enhance();return result};wrapped.__categoryReportEnhanced=true;renderPendientes=wrapped;
    }
    enhance();
    const root=document.getElementById('expedientes');
    if(root){const obs=new MutationObserver(()=>enhance());obs.observe(root,{childList:true,subtree:true})}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();

// Buscador de Expedientes: permite escribir de corrido sin perder el foco.
(function(){
  'use strict';
  if(window.__simounContinuousClientSearch)return;
  window.__simounContinuousClientSearch=true;
  let timer=null;
  function runSearch(value){
    if(typeof window.renderClients!=='function')return;
    window.renderClients(value);
    requestAnimationFrame(()=>{
      const next=document.getElementById('clientSearch');if(!next)return;
      try{next.focus({preventScroll:true})}catch{next.focus()}
      const end=next.value.length;try{next.setSelectionRange(end,end)}catch{}
    });
  }
  document.addEventListener('input',e=>{
    const el=e.target;if(!(el instanceof HTMLInputElement)||el.id!=='clientSearch')return;
    const value=el.value;e.stopImmediatePropagation();clearTimeout(timer);timer=setTimeout(()=>runSearch(value),140);
  },true);
  document.addEventListener('keydown',e=>{
    const el=e.target;if(!(el instanceof HTMLInputElement)||el.id!=='clientSearch'||e.key!=='Enter')return;
    e.preventDefault();e.stopImmediatePropagation();clearTimeout(timer);runSearch(el.value);
  },true);
})();

// Carga el guardado flexible de expedientes/asuntos incompletos.
(function(){
  if(window.__simounFlexibleSaveLoader)return;
  window.__simounFlexibleSaveLoader=true;
  const s=document.createElement('script');s.src='./guardado-flexible.js?v=20261022-1';s.defer=true;document.body.appendChild(s);
})();
