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

  function printableCard(client,type='Todos'){
    const reportClient=type==='Todos'?client:{
      ...client,
      issues:visibleReportIssues(client).filter(i=>i.type===type)
    };
    const holder=document.createElement('div');
    holder.innerHTML=typeof exrCardMarkup==='function'
      ? '<div class="card client exr-card">'+exrCardMarkup(reportClient)+'</div>'
      : '<div class="card report-client-card"><strong>'+escReport(client.name||'Sin nombre')+'</strong></div>';
    const card=holder.firstElementChild;
    if(!card)return '';
    card.classList.add('report-client-card');
    card.querySelectorAll('button').forEach(el=>el.remove());
    card.querySelectorAll('[onclick],[onchange]').forEach(el=>{el.removeAttribute('onclick');el.removeAttribute('onchange')});
    card.querySelectorAll('.exr-statuses label').forEach(el=>el.remove());
    const clientNotes=card.querySelector('.exr-client-notes textarea');
    if(clientNotes){
      const note=document.createElement('div');
      note.className='exr-print-note';
      note.textContent=clientNotes.value.trim()||'—';
      clientNotes.replaceWith(note);
    }
    card.querySelectorAll('.exr-adminnote textarea').forEach(input=>{
      const note=document.createElement('div');
      note.className='exr-print-note';
      note.textContent=input.value.trim()||'—';
      input.replaceWith(note);
    });
    card.querySelectorAll('textarea').forEach(input=>{
      const note=document.createElement('div');
      note.className='exr-print-note';
      note.textContent=input.value.trim()||'—';
      input.replaceWith(note);
    });
    return card.outerHTML;
  }

  function reportBody(type){
    const clients=reportClients(type);
    const cards=clients.map(client=>printableCard(client,type)).join('');
    return `<header class="report-heading"><h1>SIMOUN · Reporte por cliente</h1><p>Filtro de servicio: <strong>${escReport(type)}</strong> · ${clients.length} cliente${clients.length===1?'':'s'} · ${reportDate()}</p></header><main class="report-sheet">${cards||'<div class="report-empty">No hay clientes para este filtro.</div>'}</main>`;
  }
  function reportExtraCss(){
    return `
      body{margin:0;padding:18px;background:#f4f7fb;color:#10233f;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
      .report-heading{max-width:1100px;margin:0 auto 14px}.report-heading h1{font-size:22px;margin:0 0 5px}.report-heading p{margin:0;color:#61738b}
      .report-sheet{max-width:1100px;margin:0 auto}
      .report-client-card{display:block!important;background:#fff;border:1px solid #dce4ef;border-radius:16px;padding:14px;margin:0 0 14px;box-shadow:0 5px 18px rgba(16,35,63,.08);break-inside:auto;page-break-inside:auto}
      .report-client-card .exr-service{break-inside:avoid;page-break-inside:avoid}
      .report-client-card .exr-print-note{white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;border:1px solid #dce4ef;border-radius:9px;padding:9px;min-height:24px;font-size:13px}
      .report-empty{padding:30px;text-align:center;color:#61738b;background:#fff;border-radius:14px}
      @page{size:auto;margin:7mm}
      @media print{
        body{padding:0!important;background:#fff!important;font-size:9pt!important;line-height:1.18!important}
        .report-heading{margin:0 0 6px!important}.report-heading h1{font-size:15pt!important;margin:0 0 2px!important}.report-heading p{font-size:8pt!important}
        .report-sheet{max-width:none!important}
        .report-client-card{padding:6px!important;margin:0 0 6px!important;border-radius:5px!important;box-shadow:none!important;break-before:auto!important;page-break-before:auto!important}
        .report-client-card+.report-client-card{break-before:auto!important;page-break-before:auto!important}
        .exr-card-head{padding-bottom:4px!important;gap:5px!important}.exr-card-head strong{font-size:11pt!important}
        .exr-contact{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:3px!important;padding:4px 0!important}
        .exr-field{padding:4px!important;border-radius:4px!important}
        .exr-field small{font-size:7pt!important;margin-bottom:1px!important}
        .exr-field strong,.exr-field a{font-size:8pt!important;line-height:1.15!important}
        .exr-section-title{font-size:9pt!important;margin:5px 0 3px!important}
        .exr-service{padding:6px!important;margin:4px 0!important;border-radius:6px!important;break-inside:avoid-page;page-break-inside:avoid}
        .exr-service-head{gap:4px!important}.exr-service-head .btn{display:none!important}
        .type-label,.badge{padding:2px 4px!important;font-size:7pt!important}
        .exr-details{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:3px!important;margin-top:4px!important}
        .exr-copy{font-size:8pt!important;line-height:1.2!important;margin-top:4px!important}
        .exr-finance{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:3px!important;margin-top:4px!important}
        .exr-statuses{padding:3px 4px!important;margin-top:4px!important;font-size:7pt!important;gap:4px!important}
        .exr-print-note{min-height:0!important;padding:4px!important;font-size:8pt!important;line-height:1.15!important}
        .exr-client-notes{margin-top:5px!important;padding-top:5px!important}
      }
    `;
  }
  function allCss(){
    let css='';
    for(const sheet of Array.from(document.styleSheets||[])){
      try{css+=Array.from(sheet.cssRules||[]).map(rule=>rule.cssText).join('\n')+'\n'}catch{}
    }
    return css+'\n'+reportExtraCss();
  }
  function reportDocument(type){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIMOUN · Reporte por cliente</title><style>'+allCss()+'</style></head><body>'+reportBody(type)+'</body></html>';
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
        <div id="categoryReportPreview" class="report-sheet"></div>
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

  function compactPrintCss(){
    return `
      body{margin:0;padding:12px;background:#fff;color:#10233f;font-family:Arial, sans-serif;font-size:10pt;line-height:1.3}
      .report-heading{margin:0 0 10px;padding:0 0 7px;border-bottom:2px solid #0b2c55}
      .report-heading h1{font-size:17pt;margin:0 0 3px}.report-heading p{margin:0;color:#334b67;font-size:9pt}
      .report-sheet{max-width:none}
      .compact-print-client{display:block!important;background:#fff;border:0!important;border-top:2px solid #0b2c55!important;border-radius:0!important;padding:8px 0 7px!important;margin:0!important;box-shadow:none!important;break-inside:auto;page-break-inside:auto}
      .compact-print-client+.compact-print-client{border-top:3px double #0b2c55!important;margin-top:7px!important;padding-top:10px!important}
      .compact-print-client .exr-card-head{padding:0 0 5px!important;border-bottom:1px solid #8797aa!important}
      .compact-print-client .exr-card-head strong{font-size:12pt!important}
      .compact-print-client .exr-contact{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:3px!important;padding:5px 0!important}
      .compact-print-client .exr-field{padding:3px 5px!important;border:1px solid #c7d0dc!important;border-radius:2px!important}
      .compact-print-client .exr-field small{font-size:7pt!important;margin:0!important}
      .compact-print-client .exr-field strong,.compact-print-client .exr-field a{font-size:8pt!important}
      .compact-print-client .exr-section-title{font-size:9pt!important;margin:7px 0 3px!important;padding-bottom:2px!important;border-bottom:1px solid #52657c!important}
      .compact-print-client .exr-service{padding:5px 6px!important;margin:4px 0!important;border:1px solid #9aa8b8!important;border-left:3px solid #2e8bc0!important;border-radius:2px!important;break-inside:avoid-page;page-break-inside:avoid}
      .compact-print-client .exr-service-head{gap:4px!important}
      .compact-print-client .exr-details{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:3px!important;margin-top:4px!important}
      .compact-print-client .exr-finance{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:3px!important;margin-top:4px!important}
      .compact-print-client .exr-copy{font-size:8pt!important;line-height:1.22!important;margin-top:3px!important}
      .compact-print-client .exr-print-note{white-space:pre-wrap;overflow-wrap:anywhere;background:#fff;border:1px solid #c7d0dc;border-radius:2px;padding:4px!important;min-height:0!important;font-size:8pt!important;line-height:1.2!important}
      .compact-print-client .exr-statuses{padding:3px!important;margin-top:3px!important;font-size:7pt!important}
      .compact-print-client .badge,.compact-print-client .type-label{padding:2px 4px!important;font-size:7pt!important}
      .compact-print-client .exr-service-head .btn{display:none!important}
      .report-empty{padding:16px;text-align:center}
      @page{size:auto;margin:6mm}
      @media print{body{padding:0!important;font-size:9pt!important}.report-heading{margin-bottom:6px}.compact-print-client{padding-top:5px!important}.compact-print-client .exr-contact{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
    `;
  }
  function compactPrintableCard(client,type){
    const html=printableCard(client,type),holder=document.createElement('div');
    holder.innerHTML=html;
    const card=holder.firstElementChild;
    if(card)card.classList.add('compact-print-client');
    return card?card.outerHTML:'';
  }
  function compactReportBody(type){
    const clients=reportClients(type),cards=clients.map(client=>compactPrintableCard(client,type)).join('');
    return `<header class="report-heading"><h1>SIMOUN · Reporte para jefe</h1><p>Filtro: <strong>${escReport(type)}</strong> · ${clients.length} cliente${clients.length===1?'':'s'} · ${reportDate()}</p></header><main class="report-sheet">${cards||'<div class="report-empty">No hay clientes para este filtro.</div>'}</main>`;
  }
  function compactReportDocument(type){
    return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIMOUN · Impresión para jefe</title><style>'+allCss()+'\\n'+compactPrintCss()+'</style></head><body>'+compactReportBody(type)+'</body></html>';
  }
  function downloadCompactReport(type){
    const blob=new Blob([compactReportDocument(type)],{type:'text/html;charset=utf-8'});
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
    dlg.querySelector('#compactReportPreview').srcdoc=compactReportDocument(type);
    dlg.querySelector('#compactReportStatus').textContent='';
  }
  function openCompactReport(type=currentType()){
    const dlg=ensureCompactDialog(),select=dlg.querySelector('#compactReportType'),types=reportTypes();
    select.innerHTML=types.map(t=>'<option value="'+escReport(t)+'">'+escReport(t)+'</option>').join('');
    select.value=types.includes(type)?type:'Todos';
    refreshCompactDialog(dlg);dlg.showModal();
  }
\n  function addCategoryButton(){
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
