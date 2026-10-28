// SIMOUN: reporte imprimible por cliente, con la ficha visual completa.
(function(){
  'use strict';
  if(window.__simounCategoryReports)return;
  window.__simounCategoryReports=true;

  const escReport=s=>String(s??'').replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));
  function reportTypes(){return ['Todos',...(Array.isArray(ISSUE_TYPES)?ISSUE_TYPES:[])];}
  function currentType(){try{return reportTypes().includes(issueTypeFilter)?issueTypeFilter:'Todos'}catch{return 'Todos'}}
  function reportClients(type){
    return (Array.isArray(state?.clients)?state.clients:[])
      .filter(c=>type==='Todos'||(c.issues||[]).some(i=>i.type===type))
      .slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));
  }
  function reportDate(){return new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'long',year:'numeric'})}

  function printableCard(client){
    const holder=document.createElement('div');
    holder.innerHTML=typeof exrCardMarkup==='function'
      ? '<div class="card client exr-card">'+exrCardMarkup(client)+'</div>'
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
    const cards=clients.map(printableCard).join('');
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
      @page{margin:12mm}
      @media print{body{padding:0;background:#fff}.report-heading{margin:0 0 12px}.report-client-card{box-shadow:none;margin-bottom:10px}.report-client-card+.report-client-card{break-before:page;page-break-before:always}}
    `;
  }
  function allCss(){
    let css='';
    for(const sheet of Array.from(document.styleSheets||[])){
      try{css+=Array.from(sheet.cssRules||[]).map(rule=>rule.cssText).join('\\n')+'\\n'}catch{}
    }
    return css+'\\n'+reportExtraCss();
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
    const slug=String(type||'todos').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    a.href=url;a.download='SIMOUN-reporte-'+(slug||'todos')+'.html';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
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
        <div class="notice" style="margin-bottom:10px">El filtro selecciona qué clientes aparecen. Cada ficha incluye todos sus servicios y la información visible en Clientes.</div>
        <div id="categoryReportPreview" class="report-sheet"></div>
        <div class="toolbar" style="margin-top:12px"><button class="btn" type="button" id="categoryPrintBtn">🖨️ Imprimir / Guardar como PDF</button><button class="btn secondary" type="button" id="categoryDownloadBtn">⬇️ Descargar ficha HTML</button></div>
        <div id="categoryReportStatus" class="muted" role="status" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(dlg);
    const select=dlg.querySelector('#categoryReportType'),preview=dlg.querySelector('#categoryReportPreview'),status=dlg.querySelector('#categoryReportStatus');
    const refresh=()=>{preview.innerHTML=reportBody(select.value||'Todos');status.textContent=''};
    dlg.querySelector('.close').addEventListener('click',()=>dlg.close());
    select.addEventListener('change',refresh);
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
  function addCategoryButton(){
    const root=document.getElementById('expedientes');if(!root)return;
    const toolbar=root.querySelector(':scope > .toolbar');if(!toolbar||toolbar.querySelector('[data-category-report-main]'))return;
    const btn=document.createElement('button');btn.type='button';btn.className='btn secondary';btn.dataset.categoryReportMain='1';btn.textContent='📋 Reporte para jefe';
    btn.addEventListener('click',()=>openCategoryReport(currentType()));toolbar.appendChild(btn);
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
