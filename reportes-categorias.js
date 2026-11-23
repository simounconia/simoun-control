// SIMOUN: reporte imprimible por cliente, con la ficha visual completa.
(function(){
  'use strict';
  if(window.__simounCategoryReports)return;
  window.__simounCategoryReports=true;

  const escReport=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  function reportTypes(){return ['Todos',...(Array.isArray(ISSUE_TYPES)?ISSUE_TYPES:[])];}
  function currentType(){try{return reportTypes().includes(issueTypeFilter)?issueTypeFilter:'Todos'}catch{return 'Todos'}}
  function visibleReportIssues(client){
    return (client.issues||[]).filter(i=>i.active!==false&&!['Terminado','Cancelado'].includes(i.state));
  }
  function reportClients(type){
    return (Array.isArray(state?.clients)?state.clients:[])
      .filter(c=>type==='Todos'||visibleReportIssues(c).some(i=>i.type===type))
      .slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  }
  function reportDate(){return new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}

  function reportNotes(values){
    return [...new Set(values.map(value=>String(value||'').trim()).filter(Boolean))].join('\n');
  }
  function field(label,value){
    return '<span class="report-field"><b>'+label+'</b> '+escReport(value||'—')+'</span>';
  }
  function serviceRow(issue){
    const date=issue.confirmedAppointmentDate||issue.followupDate||issue.appointmentDate||issue.attentionDate||'';
    const notes=reportNotes([issue.description,issue.notes,issue.reportNote,issue.productsServices,issue.serviceToolsActions,issue.observations,issue.nextAction,issue.actionNote,issue.missingWork,issue.incompleteReason,issue.futurePromise]);
    const hours=notes.match(/^(?:horario(?: de visita)?|ventana de tiempo)\s*:\s*([^\n]+)/im);
    const windowText=hours?.[1]?.trim()||issue.appointmentWindow||issue.clientAvailability;
    const workNotes=hours && hours[1].trim()===windowText?notes.replace(hours[0],'').trim():notes;
    const amount=Number(issue.servicePrice||issue.total||0);
    const charge=serviceChargeStatus(issue)==='Sin costo'?'Sin costo':new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(amount);
    return '<div class="report-job"><div class="report-line">'+field('Fecha de cita',date.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$3/$2/$1'))+field('Ventana de tiempo',windowText)+field('Cargo',charge)+'</div><div>'+field('Notas del trabajo',workNotes)+'</div></div>';
  }
  function printableCard(client,type){
    const jobs=visibleReportIssues(client).filter(issue=>type==='Todos'||issue.type===type);
    return '<section class="report-client"><div class="report-line"><strong class="report-name">'+escReport(client.name||'Sin nombre')+'</strong>'+field('WhatsApp',client.whatsapp)+'</div><div>'+field('Dirección',client.address)+'</div><div>'+field('Notas del cliente',reportNotes([client.visitHours,client.notes,client.internalNotes]))+'</div>'+jobs.map(serviceRow).join('')+'</section>';
  }
  function reportBody(type){
    const clients=reportClients(type);
    return '<header><b>SIMOUN · Reporte para jefe</b> · '+escReport(type)+' · '+reportDate()+'</header>'+clients.map(c=>printableCard(c,type)).join('')+(clients.length?'':'Sin clientes para este filtro.');
  }
  const reportStyles=`
    @page{margin:10mm}
    body{font:14pt/1.23 Arial,sans-serif;color:#111;background:white;margin:0}
    header{margin-bottom:4pt}
    .report-client{border-top:1.2pt solid #222;padding:4pt 0;overflow-wrap:anywhere}
    .report-line{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:14pt}
    .report-name{font-size:16pt}
    .report-field{white-space:pre-line}
    .report-job{padding-top:3pt;margin-top:3pt;border-top:.5pt solid #999;break-inside:avoid}
    .report-client>div:not(.report-job){break-after:avoid}
    @media screen{body{padding:12px}}
  `;
  function reportDocument(type){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>SIMOUN · Reporte para jefe</title><style>'+reportStyles+'</style></head><body>'+reportBody(type)+'</body></html>';
  }
  function openPrint(type){
    const win=window.open('','_blank');
    if(!win){alert('Permite las ventanas emergentes para imprimir el reporte.');return}
    win.document.open();win.document.write(reportDocument(type));win.document.close();
    win.onload=()=>setTimeout(()=>{win.focus();win.print()},350);
  }
  function downloadReport(type){
    const blob=new Blob([reportDocument(type)],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    const slug=String(type||'todos').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    a.href=url;a.download='SIMOUN-reporte-'+(slug||'todos')+'.html';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }

  async function copyReport(type){
    const holder=document.createElement('div');
    holder.innerHTML=reportBody(type);
    const text=holder.innerText.trim();
    if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return}catch{}}
    const field=document.createElement('textarea');
    field.value=text;field.style.position='fixed';field.style.opacity='0';
    document.body.appendChild(field);field.select();
    const copied=document.execCommand('copy');field.remove();
    if(!copied)throw new Error('No se pudo copiar');
  }

  function ensureDialog(){
    let dlg=document.getElementById('categoryReportDlg');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='categoryReportDlg';
    dlg.style.maxWidth='1050px';
    dlg.innerHTML=`
      <div class="modal-head"><strong>📋 Reporte para jefe</strong><button class="close" type="button" aria-label="Cerrar">×</button></div>
      <div class="modal-body">
        <div class="field" style="margin-bottom:10px"><label>Filtrar clientes por servicio</label><select id="categoryReportType"></select></div>
        <div class="notice" style="margin-bottom:10px">El filtro muestra los clientes que tienen ese servicio y conserva sus datos; en cada ficha aparece únicamente el servicio seleccionado. “Todos” muestra todos sus servicios activos.</div>
        <style>#categoryReportPreview .report-line{display:flex;flex-wrap:wrap;column-gap:14pt}#categoryReportPreview .report-client{border-top:1px solid;padding:5px 0}#categoryReportPreview .report-field{white-space:pre-line}</style><div id="categoryReportPreview" class="report-sheet"></div>
        <div class="toolbar" style="margin-top:12px"><button class="btn secondary" type="button" id="categoryCopyBtn">📋 Copiar información</button><button class="btn" type="button" id="categoryPrintBtn">🖨️ Imprimir / Guardar como PDF</button><button class="btn secondary" type="button" id="categoryDownloadBtn">⬇️ Descargar ficha HTML</button></div>
        <div id="categoryReportStatus" class="muted" role="status" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(dlg);
    const select=dlg.querySelector('#categoryReportType'),preview=dlg.querySelector('#categoryReportPreview'),status=dlg.querySelector('#categoryReportStatus');
    const refresh=()=>{preview.innerHTML=reportBody(select.value||'Todos');status.textContent=''};
    dlg.querySelector('.close').addEventListener('click',()=>dlg.close());
    select.addEventListener('change',refresh);
    dlg.querySelector('#categoryCopyBtn').addEventListener('click',async()=>{try{await copyReport(select.value||'Todos');status.textContent='Se copió la información completa del reporte.'}catch{status.textContent='No se pudo copiar. Intenta de nuevo.'}});
    dlg.querySelector('#categoryPrintBtn').addEventListener('click',()=>openPrint(select.value||'Todos'));
    dlg.querySelector('#categoryDownloadBtn').addEventListener('click',()=>{downloadReport(select.value||'Todos');status.textContent='Se descargó el archivo HTML del reporte.'});
    return dlg;
  }
  function openCategoryReport(type=currentType()){
    const dlg=ensureDialog(),select=dlg.querySelector('#categoryReportType'),types=reportTypes();
    select.innerHTML=types.map(t=>'<option value="'+escReport(t)+'">'+escReport(t)+'</option>').join('');
    select.value=types.includes(type)?type:'Todos';
    dlg.querySelector('#categoryReportPreview').innerHTML=reportBody(select.value);
    dlg.querySelector('#categoryReportStatus').textContent='';
    dlg.showModal();
  }
  window.openCategoryReport=openCategoryReport;

  function replaceOldReportButtons(root=document){
    root.querySelectorAll('[data-daily-report]').forEach(old=>{
      if(old.dataset.categoryReportReady==='1')return;
      const btn=old.cloneNode(true);btn.dataset.categoryReportReady='1';btn.textContent='📋 Reporte para jefe';
      btn.addEventListener('click',()=>openCategoryReport(currentType()));old.replaceWith(btn);
    });
  }

  function downloadCompactReport(type){
    const blob=new Blob([reportDocument(type)],{type:'text/html;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    const slug=String(type||'todos').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    a.href=url;a.download='SIMOUN-impresion-jefe-'+(slug||'todos')+'.html';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function ensureCompactDialog(){
    let dlg=document.getElementById('compactReportDlg');if(dlg)return dlg;
    dlg=document.createElement('dialog');dlg.id='compactReportDlg';dlg.style.maxWidth='1050px';
    dlg.innerHTML=`
      <div class="modal-head"><strong>🖨️ Impresión · Reporte para jefe</strong><button class="close" type="button" aria-label="Cerrar">×</button></div>
      <div class="modal-body">
        <div class="field" style="margin-bottom:10px"><label>Filtrar clientes por servicio</label><select id="compactReportType"></select></div>
        <div class="notice" style="margin-bottom:10px">Formato compacto con la información completa, renglones y separadores claros entre fichas y servicios.</div>
        <iframe id="compactReportPreview" title="Vista previa de impresión" style="width:100%;height:58vh;border:1px solid #dce4ef;border-radius:10px;background:#fff"></iframe>
        <div class="toolbar" style="margin-top:12px"><button class="btn" type="button" id="compactPrintBtn">🖨️ Imprimir / Guardar como PDF</button><button class="btn secondary" type="button" id="compactDownloadBtn">⬇️ Descargar formato</button></div>
        <div id="compactReportStatus" class="muted" role="status" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.close').addEventListener('click',()=>dlg.close());
    dlg.querySelector('#compactReportType').addEventListener('change',()=>refreshCompactDialog(dlg));
    dlg.querySelector('#compactPrintBtn').addEventListener('click',()=>{
      const frame=dlg.querySelector('#compactReportPreview');
      try{frame.contentWindow.focus();frame.contentWindow.print()}catch{alert('No se pudo abrir la impresión. Intenta descargar el formato.')}
    });
    dlg.querySelector('#compactDownloadBtn').addEventListener('click',()=>{
      downloadCompactReport(dlg.querySelector('#compactReportType').value||'Todos');
      dlg.querySelector('#compactReportStatus').textContent='Se descargó el formato de impresión.';
    });
    return dlg;
  }
  function refreshCompactDialog(dlg){
    const type=dlg.querySelector('#compactReportType').value||'Todos';
    dlg.querySelector('#compactReportPreview').srcdoc=reportDocument(type);
    dlg.querySelector('#compactReportStatus').textContent='';
  }
  function openCompactReport(type=currentType()){
    const dlg=ensureCompactDialog(),select=dlg.querySelector('#compactReportType'),types=reportTypes();
    select.innerHTML=types.map(t=>'<option value="'+escReport(t)+'">'+escReport(t)+'</option>').join('');
    select.value=types.includes(type)?type:'Todos';
    refreshCompactDialog(dlg);dlg.showModal();
  }

  function addCategoryButton(){
    const root=document.getElementById('expedientes');if(!root)return;
    const toolbar=root.querySelector(':scope > .toolbar');if(!toolbar||toolbar.querySelector('[data-category-report-main]'))return;
    const btn=document.createElement('button');btn.type='button';btn.className='btn secondary';btn.dataset.categoryReportMain='1';btn.textContent='🖨️ Impresión';
    btn.addEventListener('click',()=>openCompactReport(currentType()));toolbar.appendChild(btn);
  }
  function enhance(){replaceOldReportButtons(document);addCategoryButton()}
  function install(){
    if(typeof renderClients==='function'&&!renderClients.__categoryReportEnhanced){
      const base=renderClients;const wrapped=function(q=''){const result=base(q);enhance();return result};wrapped.__categoryReportEnhanced=true;renderClients=wrapped;
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
