// SIMOUN: captura rápida aditiva; reutiliza el modelo existente sin borrar datos.
(function(){
  'use strict';
  function ready(){
    const bar=document.querySelector('.topbar');
    if(!bar || typeof state==='undefined' || typeof save!=='function')return;
    const btn=document.createElement('button');
    btn.className='btn';btn.textContent='＋ Solicitud rápida';
    btn.style.cssText='margin-top:10px;background:#fff;color:#0b2c55';
    bar.appendChild(btn);
    const dlg=document.createElement('dialog');
    dlg.style.cssText='border:0;border-radius:16px;max-width:520px;width:94vw;padding:20px';
    dlg.innerHTML='<form id="quickIntakeForm"><h2>Solicitud rápida</h2><p class="muted">No necesitas saber todavía qué hará el técnico.</p><div class="field"><label>Cliente *</label><input name="cliente" required maxlength="120" autocomplete="off"></div><div class="field"><label>Dirección del servicio *</label><textarea name="direccion" required maxlength="500"></textarea></div><div class="field"><label>¿A qué van? (opcional)</label><input name="motivo" placeholder="Ej. Revisar cámaras / por confirmar" maxlength="250"></div><div class="field"><label>Tipo de solicitud</label><select name="tipo"><option>Reparación</option><option>Cotización</option><option>Instalación</option><option>Mantenimiento</option><option>Seguimiento</option><option>Pregunta</option></select></div><div class="field"><label>Días y horario disponibles (opcional)</label><input name="horario" placeholder="Ej. martes y jueves de 12:00 a 17:00"></div><div class="field"><label>Nota (opcional)</label><textarea name="nota"></textarea></div><div class="toolbar"><button class="btn" type="submit">Guardar solicitud</button><button class="btn secondary" type="button" id="quickCancel">Cancelar</button></div></form>';
    document.body.appendChild(dlg);
    btn.onclick=()=>dlg.showModal();
    dlg.querySelector('#quickCancel').onclick=()=>dlg.close();
    dlg.querySelector('form').onsubmit=e=>{
      e.preventDefault();
      const f=new FormData(e.currentTarget);
      const name=String(f.get('cliente')||'').trim();
      const address=String(f.get('direccion')||'').trim();
      if(!name||!address)return;
      const matches=state.clients.filter(c=>String(c.name||'').trim().toLocaleLowerCase('es')===name.toLocaleLowerCase('es'));
      let client;
      if(matches.length===1)client=matches[0];
      else if(matches.length>1){alert('Hay varios clientes con ese nombre. Selecciona el correcto desde Expedientes para evitar duplicados.');return;}
      else{
        client=blankClient();client.name=name;client.address=address;
        state.clients.unshift(client);
      }
      const issue=blankIssue();
      issue.type=String(f.get('tipo')||'Seguimiento');
      issue.description=String(f.get('motivo')||'').trim()||'Trabajo por confirmar con técnicos';
      issue.notes=String(f.get('nota')||'').trim();
      issue.appointmentWindow=String(f.get('horario')||'').trim();
      issue.clientAvailability=issue.appointmentWindow;
      issue.serviceAddress=address;
      issue.appointmentConfirmation='Pendiente de coordinar';
      issue.history.push({date:new Date().toISOString(),action:'Solicitud rápida registrada',detail:'Dirección: '+address});
      client.issues=client.issues||[];client.issues.unshift(issue);
      save();
      dlg.close();e.currentTarget.reset();
      alert('Solicitud guardada. La cita todavía NO está confirmada ni aparece como cita programada.');
      if(typeof openClient==='function')openClient(client.id);
    };
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();

// SIMOUN: filtros táctiles + reporte diario para compartir con el jefe.
// Esta mejora solamente lee los expedientes existentes; no cambia ni migra los datos guardados.
(function(){
  'use strict';
  if(window.__simounDailyReportEnhancement)return;
  window.__simounDailyReportEnhancement=true;

  function localISODate(d=new Date()){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }

  function localReportDate(d=new Date()){
    return d.toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'numeric'});
  }

  function nextUsefulDate(issue){
    if(typeof issueDates!=='function')return '';
    const dates=issueDates(issue).filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date));
    if(!dates.length)return '';
    const now=localISODate();
    const future=dates.find(x=>x.date>=now)||dates[dates.length-1];
    return `${future.label}: ${typeof fmt==='function'?fmt(future.date):future.date}`;
  }

  function reportLine(issue,index){
    const client=issue.client||{};
    const title=client.name||client.company||'Sin nombre';
    const company=client.company&&client.company!==title?` · ${client.company}`:'';
    const description=String(issue.description||'Sin descripción').trim();
    const address=String(issue.serviceAddress||client.address||'').trim();
    const details=[];
    if(address)details.push(`Dirección: ${address}`);
    if(issue.state)details.push(`Estado: ${issue.state}`);
    const date=nextUsefulDate(issue);if(date)details.push(date);
    if(issue.appointmentWindow)details.push(`Horario: ${issue.appointmentWindow}`);
    if(issue.type==='Cobro'&&Number(issue.balance||0)>0)details.push(`Saldo: ${typeof money==='function'?money(issue.balance):issue.balance}`);
    if(issue.type==='Trabajo incompleto'&&issue.nextAction)details.push(`Siguiente: ${String(issue.nextAction).trim()}`);
    if(issue.type==='Trabajo futuro / promesa'&&issue.futurePromise)details.push(`Promesa: ${String(issue.futurePromise).trim()}`);
    return `${index+1}. ${title}${company} — ${description}${details.length?`\n   ${details.join(' · ')}`:''}`;
  }

  function buildDailyReport(){
    const issues=(typeof activeIssues==='function'?activeIssues():[]).slice();
    const types=Array.isArray(ISSUE_TYPES)?ISSUE_TYPES:[];
    const order=new Map(types.map((t,i)=>[t,i]));
    issues.sort((a,b)=>{
      const ta=order.has(a.type)?order.get(a.type):999;
      const tb=order.has(b.type)?order.get(b.type):999;
      if(ta!==tb)return ta-tb;
      return String(a.client?.name||'').localeCompare(String(b.client?.name||''),'es');
    });
    const lines=[`PENDIENTES SIMOUN · ${localReportDate()}`,`Total: ${issues.length} asunto${issues.length===1?'':'s'} activo${issues.length===1?'':'s'}`,''];
    if(!issues.length){lines.push('No hay asuntos activos pendientes.');return lines.join('\n');}
    const grouped=new Map();
    issues.forEach(issue=>{
      const key=issue.type||'Sin categoría';
      if(!grouped.has(key))grouped.set(key,[]);
      grouped.get(key).push(issue);
    });
    const orderedTypes=[...types.filter(t=>grouped.has(t)),...Array.from(grouped.keys()).filter(t=>!order.has(t))];
    orderedTypes.forEach((type,groupIndex)=>{
      const rows=grouped.get(type)||[];
      const meta=typeof TYPE_META!=='undefined'&&TYPE_META[type]?TYPE_META[type]:{icon:'•'};
      if(groupIndex>0)lines.push('');
      lines.push(`${meta.icon||'•'} ${type} — ${rows.length}`);
      rows.forEach((issue,index)=>lines.push(reportLine(issue,index)));
    });
    return lines.join('\n');
  }

  function ensureReportDialog(){
    let dlg=document.getElementById('dailyReportDlg');
    if(dlg)return dlg;
    dlg=document.createElement('dialog');
    dlg.id='dailyReportDlg';
    dlg.innerHTML=`<div class="modal-head"><strong>📋 Reporte diario de pendientes</strong><button class="close" type="button" aria-label="Cerrar">×</button></div><div class="modal-body"><div class="notice" style="margin-bottom:10px">Se arma automáticamente con los asuntos activos. No modifica tus expedientes.</div><textarea id="dailyReportText" aria-label="Reporte diario" style="width:100%;min-height:340px;padding:12px;border:1px solid var(--line);border-radius:12px;resize:vertical;background:#fff;color:var(--ink)"></textarea><div class="toolbar" style="margin-top:12px"><button class="btn" type="button" id="dailyCopyBtn">📋 Copiar reporte</button><button class="btn secondary" type="button" id="dailyShareBtn">📤 Compartir</button><button class="btn light" type="button" id="dailyRefreshBtn">↻ Actualizar</button></div><div id="dailyReportStatus" class="muted" role="status" aria-live="polite"></div></div>`;
    document.body.appendChild(dlg);
    dlg.querySelector('.close').addEventListener('click',()=>dlg.close());
    dlg.querySelector('#dailyRefreshBtn').addEventListener('click',()=>{
      dlg.querySelector('#dailyReportText').value=buildDailyReport();
      dlg.querySelector('#dailyReportStatus').textContent='Reporte actualizado.';
    });
    dlg.querySelector('#dailyCopyBtn').addEventListener('click',async()=>{
      const textarea=dlg.querySelector('#dailyReportText');
      const text=textarea.value;
      let copied=false;
      try{
        if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(text);copied=true;}
      }catch{}
      if(!copied){
        textarea.focus();textarea.select();
        try{copied=document.execCommand('copy');}catch{}
        textarea.setSelectionRange(0,0);
      }
      dlg.querySelector('#dailyReportStatus').textContent=copied?'✅ Copiado. Ya puedes pegarlo en WhatsApp.':'Selecciona el texto y usa Copiar.';
    });
    const share=dlg.querySelector('#dailyShareBtn');
    if(typeof navigator.share!=='function')share.style.display='none';
    else share.addEventListener('click',async()=>{
      try{await navigator.share({title:'Pendientes SIMOUN',text:dlg.querySelector('#dailyReportText').value});}
      catch(e){if(e&&e.name!=='AbortError')dlg.querySelector('#dailyReportStatus').textContent='No se pudo abrir el menú para compartir.';}
    });
    return dlg;
  }

  function openDailyReport(){
    const dlg=ensureReportDialog();
    dlg.querySelector('#dailyReportText').value=buildDailyReport();
    dlg.querySelector('#dailyReportStatus').textContent='';
    dlg.showModal();
  }
  window.openDailyReport=openDailyReport;

  function addReportButtonToExpedientes(){
    const root=document.getElementById('expedientes');
    if(!root)return;
    const toolbar=root.querySelector('.toolbar');
    if(!toolbar||toolbar.querySelector('[data-daily-report]'))return;
    const btn=document.createElement('button');
    btn.type='button';btn.className='btn secondary';btn.dataset.dailyReport='1';
    btn.textContent='📋 Reporte para jefe';
    btn.addEventListener('click',openDailyReport);
    toolbar.appendChild(btn);
  }

  function makeTypeCardsTappable(){
    const buttons=Array.from(document.querySelectorAll('#expedientes .type-filter'));
    if(!buttons.length)return;
    const types=['Todos',...(Array.isArray(ISSUE_TYPES)?ISSUE_TYPES:[])];
    buttons.forEach((btn,index)=>{
      const type=types[index];
      if(!type)return;
      btn.type='button';
      btn.style.touchAction='manipulation';
      btn.removeAttribute('onclick');
      btn.onclick=null;
      btn.addEventListener('click',()=>{
        issueTypeFilter=type;
        const q=document.getElementById('clientSearch')?.value||'';
        renderClients(q);
        if(type!=='Todos')requestAnimationFrame(()=>{
          const target=document.querySelector('#expedientes .review-list');
          if(target){target.style.scrollMarginTop='16px';target.scrollIntoView({behavior:'smooth',block:'start'});}
        });
      });
    });
  }

  function enhanceExpedientes(){
    addReportButtonToExpedientes();
    makeTypeCardsTappable();
  }

  function addReportButtonToPendientes(){
    const root=document.getElementById('pendientes');
    if(!root||root.querySelector('[data-daily-report]'))return;
    const bar=document.createElement('div');
    bar.className='toolbar';bar.style.marginBottom='12px';
    const btn=document.createElement('button');
    btn.type='button';btn.className='btn';btn.dataset.dailyReport='1';btn.textContent='📋 Reporte para jefe';
    btn.addEventListener('click',openDailyReport);
    bar.appendChild(btn);root.prepend(bar);
  }

  function installEnhancements(){
    if(typeof renderClients==='function'&&!renderClients.__dailyEnhanced){
      const baseRenderClients=renderClients;
      const wrapped=function(q=''){const result=baseRenderClients(q);enhanceExpedientes();return result;};
      wrapped.__dailyEnhanced=true;
      renderClients=wrapped;
    }
    if(typeof renderPendientes==='function'&&!renderPendientes.__dailyEnhanced){
      const baseRenderPendientes=renderPendientes;
      const wrapped=function(){const result=baseRenderPendientes();addReportButtonToPendientes();return result;};
      wrapped.__dailyEnhanced=true;
      renderPendientes=wrapped;
    }
    enhanceExpedientes();
    addReportButtonToPendientes();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installEnhancements);
  else installEnhancements();
})();