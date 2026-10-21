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
    try{
      return reportTypes().includes(issueTypeFilter)?issueTypeFilter:'Todos';
    }catch{return 'Todos';}
  }

  function clean(v,fallback='No registrado'){
    const text=String(v??'').trim();
    return text||fallback;
  }

  function dateLabel(){
    return new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});
  }

  function matchingIssues(type){
    let rows=[];
    if(typeof activeIssues==='function')rows=activeIssues().slice();
    else if(typeof allIssues==='function')rows=allIssues().filter(i=>i.active!==false&&!['Terminado','Cancelado'].includes(i.state));
    if(type&&type!=='Todos')rows=rows.filter(i=>i.type===type);
    rows.sort((a,b)=>{
      const nc=String(a.client?.name||'').localeCompare(String(b.client?.name||''),'es');
      if(nc)return nc;
      const ad=String(a.createdDate||'');
      const bd=String(b.createdDate||'');
      if(ad!==bd)return ad.localeCompare(bd);
      return String(a.type||'').localeCompare(String(b.type||''),'es');
    });
    return rows;
  }

  function serviceLines(issue,index){
    const lines=[
      `   Servicio ${index+1}`,
      `   Tipo de servicio: ${clean(issue.type,'Sin tipo')}`,
      `   Estatus: ${clean(issue.state,'Pendiente')}`
    ];
    const windowText=String(issue.clientAvailability||issue.appointmentWindow||issue.proposedAppointmentWindow||'').trim();
    if(windowText)lines.push(`   Ventana de atención: ${windowText}`);
    if(issue.appointmentDate)lines.push(`   Fecha de cita: ${typeof fmt==='function'?fmt(issue.appointmentDate):issue.appointmentDate}`);
    lines.push(`   Descripción del trabajo: ${clean(issue.description,'Sin descripción')}`);
    const notes=String(issue.notes||'').trim();
    if(notes)lines.push(`   Notas: ${notes}`);
    if(issue.type==='Cobro'){
      if(Number(issue.total||0)>0)lines.push(`   Total: ${typeof money==='function'?money(issue.total):issue.total}`);
      if(Number(issue.paid||0)>0)lines.push(`   Pagado: ${typeof money==='function'?money(issue.paid):issue.paid}`);
      if(Number(issue.balance||0)>0)lines.push(`   Saldo pendiente: ${typeof money==='function'?money(issue.balance):issue.balance}`);
    }
    if(issue.type==='Trabajo incompleto'){
      if(String(issue.incompleteReason||'').trim())lines.push(`   Motivo: ${String(issue.incompleteReason).trim()}`);
      if(String(issue.missingWork||'').trim())lines.push(`   Qué falta: ${String(issue.missingWork).trim()}`);
      if(String(issue.nextAction||'').trim())lines.push(`   Próxima acción: ${String(issue.nextAction).trim()}`);
    }
    if(issue.type==='Trabajo futuro / promesa'&&String(issue.futurePromise||'').trim()){
      lines.push(`   Promesa / trabajo futuro: ${String(issue.futurePromise).trim()}`);
    }
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
    const lines=[
      `SIMOUN · REPORTE ${title} · ${dateLabel()}`,
      `Clientes: ${groups.length} · Servicios activos: ${rows.length}`,
      ''
    ];
    if(!rows.length){
      lines.push(`No hay asuntos activos en ${type==='Todos'?'esta lista':type}.`);
      return lines.join('\n');
    }
    groups.forEach((group,clientIndex)=>{
      if(clientIndex)lines.push('', '────────────────────', '');
      const c=group.client||{};
      const fallbackAddress=group.issues.map(i=>String(i.serviceAddress||'').trim()).find(Boolean)||'';
      lines.push(`${clientIndex+1}. CLIENTE: ${clean(c.name,'Sin nombre')}`);
      lines.push(`WhatsApp: ${clean(c.whatsapp||c.phone,'No registrado')}`);
      lines.push(`Dirección: ${clean(c.address||fallbackAddress,'No registrada')}`);
      if(String(c.notes||'').trim())lines.push(`Observaciones generales: ${String(c.notes).trim()}`);
      lines.push(`Servicios en este reporte: ${group.issues.length}`);
      group.issues.forEach((issue,serviceIndex)=>{
        lines.push('');
        lines.push(...serviceLines(issue,serviceIndex));
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
      <div class="modal-head">
        <strong>📋 Reporte para jefe</strong>
        <button class="close" type="button" aria-label="Cerrar">×</button>
      </div>
      <div class="modal-body">
        <div class="field" style="margin-bottom:10px">
          <label>Qué quieres reportar</label>
          <select id="categoryReportType"></select>
        </div>
        <div class="notice" style="margin-bottom:10px">El reporte incluye solamente asuntos activos. Puedes sacar uno de Instalación, Cotización, Reparación, Mantenimiento, etc., o uno de Todos.</div>
        <textarea id="categoryReportText" aria-label="Reporte por categoría" style="width:100%;min-height:420px;padding:12px;border:1px solid var(--line);border-radius:12px;resize:vertical;background:#fff;color:var(--ink)"></textarea>
        <div class="toolbar" style="margin-top:12px">
          <button class="btn" type="button" id="categoryCopyBtn">📋 Copiar</button>
          <button class="btn secondary" type="button" id="categoryShareBtn">📤 Compartir</button>
          <button class="btn light" type="button" id="categoryRefreshBtn">↻ Actualizar</button>
        </div>
        <div id="categoryReportStatus" class="muted" role="status" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(dlg);
    const select=dlg.querySelector('#categoryReportType');
    const textarea=dlg.querySelector('#categoryReportText');
    const status=dlg.querySelector('#categoryReportStatus');
    const refresh=()=>{
      textarea.value=buildReport(select.value||'Todos');
      status.textContent='';
    };
    dlg.querySelector('.close').addEventListener('click',()=>dlg.close());
    select.addEventListener('change',refresh);
    dlg.querySelector('#categoryRefreshBtn').addEventListener('click',()=>{refresh();status.textContent='Reporte actualizado.';});
    dlg.querySelector('#categoryCopyBtn').addEventListener('click',async()=>{
      let ok=false;
      try{
        if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(textarea.value);ok=true;}
      }catch{}
      if(!ok){
        textarea.focus();textarea.select();
        try{ok=document.execCommand('copy');}catch{}
        textarea.setSelectionRange(0,0);
      }
      status.textContent=ok?'✅ Copiado. Ya puedes pegarlo en WhatsApp.':'Selecciona el texto y usa Copiar.';
    });
    const share=dlg.querySelector('#categoryShareBtn');
    if(typeof navigator.share!=='function')share.style.display='none';
    else share.addEventListener('click',async()=>{
      try{await navigator.share({title:'Reporte SIMOUN · '+(select.value||'Todos'),text:textarea.value});}
      catch(e){if(e&&e.name!=='AbortError')status.textContent='No se pudo abrir el menú para compartir.';}
    });
    return dlg;
  }

  function openCategoryReport(type=currentType()){
    const dlg=ensureDialog();
    const select=dlg.querySelector('#categoryReportType');
    const types=reportTypes();
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
      btn.dataset.categoryReportReady='1';
      btn.textContent='📋 Reporte para jefe';
      btn.addEventListener('click',()=>openCategoryReport(currentType()));
      old.replaceWith(btn);
    });
  }

  function addCategoryButton(){
    const root=document.getElementById('expedientes');
    if(!root)return;
    const list=root.querySelector('.review-list');
    if(!list)return;
    const title=list.previousElementSibling;
    if(!title||title.querySelector('[data-category-report-one]'))return;
    const type=currentType();
    if(type==='Todos')return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='btn sm secondary';
    btn.dataset.categoryReportOne='1';
    btn.textContent=`📋 Reporte de ${type}`;
    btn.addEventListener('click',()=>openCategoryReport(type));
    title.appendChild(btn);
  }

  function enhance(){
    replaceOldReportButtons(document);
    addCategoryButton();
  }

  function install(){
    if(typeof renderClients==='function'&&!renderClients.__categoryReportEnhanced){
      const base=renderClients;
      const wrapped=function(q=''){const result=base(q);enhance();return result;};
      wrapped.__categoryReportEnhanced=true;
      renderClients=wrapped;
    }
    if(typeof renderPendientes==='function'&&!renderPendientes.__categoryReportEnhanced){
      const base=renderPendientes;
      const wrapped=function(){const result=base();enhance();return result;};
      wrapped.__categoryReportEnhanced=true;
      renderPendientes=wrapped;
    }
    enhance();
    const root=document.getElementById('expedientes');
    if(root){
      const obs=new MutationObserver(()=>enhance());
      obs.observe(root,{childList:true,subtree:true});
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
  else install();
})();
