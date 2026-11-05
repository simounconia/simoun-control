/* SIMOUN · Empresas y seguimiento manual de conversaciones.
   No lee mensajes de WhatsApp: los datos se registran desde el expediente. */
(function(){
  const main=document.querySelector('main.wrap');
  if(!main || document.getElementById('empresas'))return;
  const section=document.createElement('section');
  section.id='empresas';
  section.className='page';
  main.appendChild(section);
  PAGES.splice(2,0,['empresas','Empresas']);
  nav();

  function renderCompanies(){
    const root=document.getElementById('empresas');
    if(!root)return;
    const groups=new Map();
    (state.clients||[]).forEach(c=>{
      const name=(c.company||'').trim()||'Sin empresa asignada';
      const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX').replace(/\s+/g,' ');
      if(!groups.has(key))groups.set(key,{name,clients:[]});
      groups.get(key).clients.push(c);
    });
    const ordered=[...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'es-MX'));
    const list=ordered.map(group=>{
      const contacts=group.clients.map(c=>{
        const issues=c.issues||[];
        const active=issues.filter(i=>i.active!==false&&!['Terminado','Cancelado'].includes(i.state));
        const contactNotes=issues.filter(i=>i.lastContactNote).sort((a,b)=>(b.lastContactAt||'').localeCompare(a.lastContactAt||''));
        const last=contactNotes[0];
        const itemHtml=active.slice(0,4).map(i=>'<div class="badges"><span class="badge">'+esc(i.type||'Asunto')+'</span><span class="badge '+(i.priority==='Urgente'?'red':'')+'">'+esc(i.state||'Pendiente')+'</span><span class="muted">'+esc(i.actionNote||i.description||'')+'</span></div>').join('');
        return '<article class="card" style="box-shadow:none"><div class="client"><div><strong>'+esc(c.name||'Sin nombre')+'</strong><div class="muted">'+esc(c.contact||'')+(c.whatsapp?' · WhatsApp: '+esc(c.whatsapp):'')+'</div></div><span class="badge">'+active.length+' pendiente(s)</span></div>'+
          (last?'<p><b>Último contacto registrado manualmente:</b> '+esc(last.lastContactNote)+(last.lastContactAt?' · '+esc(fmt(last.lastContactAt)):'')+'</p>':'<p class="muted">Sin último contacto registrado.</p>')+
          itemHtml+(active.length>4?'<p class="muted">Y '+(active.length-4)+' asunto(s) más.</p>':'')+
          '<div class="toolbar" style="margin-top:10px"><button class="btn sm secondary" data-company-open="'+esc(c.id)+'">Abrir expediente</button><button class="btn sm" data-company-new="'+esc(c.id)+'">Nuevo asunto</button></div></article>';
      }).join('');
      return '<details class="card" data-company-card open><summary style="cursor:pointer;font-size:17px;font-weight:800">'+esc(group.name)+' <span class="badge">'+group.clients.length+' contacto(s)</span></summary><div class="list" style="margin-top:14px">'+contacts+'</div></details>';
    }).join('');
    root.innerHTML='<div class="section-title"><h2>🏢 Empresas y contactos</h2><button class="btn sm" id="companyAdd">+ Nuevo cliente</button></div><p class="muted">Agrupa automáticamente por el campo «Empresa» del expediente. Cada persona mantiene sus propios proyectos y asuntos. No se crean grupos de WhatsApp ni se importan mensajes automáticamente.</p><div class="toolbar"><input class="search" id="companySearch" placeholder="Buscar empresa, contacto o asunto" aria-label="Buscar empresas y contactos"></div><div class="list">'+(list||'<div class="card empty">No hay expedientes registrados.</div>')+'</div>';
    root.querySelector('#companySearch').addEventListener('input',e=>{
      const q=e.target.value.trim().toLocaleLowerCase('es-MX');
      root.querySelectorAll('[data-company-card]').forEach(el=>{el.hidden=!el.textContent.toLocaleLowerCase('es-MX').includes(q)});
    });
    root.querySelector('#companyAdd').addEventListener('click',()=>newClient());
    root.querySelectorAll('[data-company-open]').forEach(b=>b.addEventListener('click',()=>openClient(b.dataset.companyOpen)));
    root.querySelectorAll('[data-company-new]').forEach(b=>b.addEventListener('click',()=>newIssue(b.dataset.companyNew)));
  }

  const originalRenderAll=renderAll;
  renderAll=function(){originalRenderAll();renderCompanies()};

  const originalEditIssue=editIssue;
  editIssue=function(cid,iid){
    originalEditIssue(cid,iid);
    const form=document.getElementById('issueForm');
    if(!form||form.querySelector('#manualCommunication'))return;
    const client=state.clients.find(c=>c.id===cid);
    const issue=iid?(client?.issues||[]).find(i=>i.id===iid):null;
    const priority=issue?.priority||'Normal';
    const channel=issue?.communicationChannel||'';
    const options=(values,current)=>values.map(v=>'<option value="'+esc(v)+'" '+(v===current?'selected':'')+'>'+esc(v||'Sin indicar')+'</option>').join('');
    const panel=document.createElement('div');
    panel.id='manualCommunication';
    panel.className='card';
    panel.style.margin='12px 0';
    panel.innerHTML='<h3>📲 Comunicación y prioridad</h3><p class="muted">Registro manual para coordinar mensajes de ambos WhatsApp y llamadas. No descarga conversaciones.</p>'+
      '<div class="row"><div class="field"><label>Prioridad</label><select name="priority">'+options(['Normal','Alta','Urgente'],priority)+'</select></div>'+
      '<div class="field"><label>Contacto por</label><select name="communicationChannel">'+options(['','WhatsApp de la empresa','WhatsApp del ingeniero','Llamada','Correo','Otro'],channel)+'</select></div></div>'+
      '<div class="row"><div class="field"><label>Último contacto (fecha)</label><input type="date" name="lastContactAt" value="'+esc(issue?.lastContactAt||'')+'"></div>'+
      '<div class="field"><label>Proyecto / referencia</label><input name="projectRef" value="'+esc(issue?.projectRef||'')+'" placeholder="Ej. Ingessa / Obra Altozano"></div></div>'+
      '<div class="field"><label>Qué fue lo último que acordaron</label><textarea name="lastContactNote" placeholder="Ej. WhatsApp del inge: falta confirmar fecha; responder el viernes.">'+esc(issue?.lastContactNote||'')+'</textarea></div>';
    const after=form.querySelector('.switch-line');
    if(after)after.insertAdjacentElement('afterend',panel);
    else form.prepend(panel);
  };
  renderCompanies();
})();