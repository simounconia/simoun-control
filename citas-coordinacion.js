// Módulo autónomo de citas: independiente de captura rápida.
(function(){
'use strict';
function init(){
 if(typeof state==='undefined'||typeof save!=='function')return;
 const bar=document.querySelector('.topbar');if(!bar)return;
 const ehtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const appointments=document.createElement('button');
    appointments.className='btn';
    appointments.textContent='📅 Citas por confirmar';
    appointments.style.cssText='margin:10px 0 0 8px;background:#e6f2ff;color:#0b2c55';
    bar.appendChild(appointments);
    const coordination=document.createElement('dialog');
    coordination.style.cssText='border:0;border-radius:16px;max-width:720px;width:95vw;padding:20px;max-height:85vh;overflow:auto';
    document.body.appendChild(coordination);

    const pending=()=>state.clients.flatMap(c=>(c.issues||[]).filter(i=>i.appointmentConfirmation && i.appointmentConfirmation!=='Confirmada' && i.active!==false).map(i=>({c,i})));
    function showCoordination(){
      const items=pending();
      coordination.innerHTML='<div class="row"><h2>Citas por confirmar ('+items.length+')</h2><button class="btn secondary" id="coordClose">Cerrar</button></div><p class="muted">La cita aparece en el calendario solo después de la confirmación con el cliente.</p>'+
      (items.map(({c,i})=>'<div class="card" style="margin:10px 0"><strong>'+ehtml(c.name)+'</strong><p>'+ehtml(i.serviceAddress||c.address||'Dirección pendiente')+'</p><p>'+ehtml(i.description||'Trabajo por confirmar')+'</p><p class="muted">Disponibilidad del cliente: '+ehtml(i.clientAvailability||i.appointmentWindow||'No indicada')+'</p><p><strong>'+ehtml(i.appointmentConfirmation)+'</strong></p><button class="btn secondary" data-coordinate="'+ehtml(i.id)+'">Coordinar cita</button></div>').join('')||'<p>No hay citas pendientes de confirmación.</p>');
      coordination.querySelector('#coordClose').onclick=()=>coordination.close();
      coordination.querySelectorAll('[data-coordinate]').forEach(b=>b.onclick=()=>editCoordination(b.dataset.coordinate));
      if(!coordination.open)coordination.showModal();
    }
    function editCoordination(id){
      const found=pending().find(x=>x.i.id===id);if(!found)return;
      const {c,i}=found;
      const clientWindow=i.clientAvailability||((!i.proposedAppointmentWindow)?i.appointmentWindow:'')||'';
      const bossWindow=i.proposedAppointmentWindow||'';
      coordination.innerHTML='<h2>Coordinar cita</h2><p><strong>'+ehtml(c.name)+'</strong> · '+ehtml(i.serviceAddress||c.address||'')+'</p><p class="muted">'+ehtml(i.description||'Trabajo por confirmar')+'</p><form id="coordForm">'+
      '<label style="display:flex;flex-direction:column;gap:8px;margin:0 0 16px;font-size:14px;font-weight:700">Etapa<select name="stage"><option value="Pendiente de coordinar">Consultar con el jefe</option><option value="Disponibilidad autorizada; falta confirmar cliente">Jefe dio disponibilidad; falta confirmar cliente</option><option value="Confirmada">Cliente confirmó la cita</option></select></label>'+
      '<label>Fecha propuesta / confirmada<input type="date" name="date" value="'+ehtml(i.proposedAppointmentDate||i.appointmentDate||'')+'"></label>'+
      '<div class="notice" style="margin-bottom:14px"><strong>Disponibilidad indicada por el cliente:</strong><div>'+ehtml(clientWindow||'No registrada')+'</div></div>'+ 
      '<label>Horario propuesto por el jefe<input name="time" placeholder="Ej. jueves de 13:00 a 15:00" value="'+ehtml(bossWindow)+'"></label>'+
      '<label>Persona que recibirá (opcional)<input name="receiver" value="'+ehtml(i.appointmentReceiver||'')+'"></label>'+
      '<label>Nota (opcional)<textarea name="note">'+ehtml(i.appointmentNote||'')+'</textarea></label>'+
      '<div class="toolbar" style="margin-top:15px"><button class="btn" type="submit">Guardar</button><button type="button" class="btn secondary" id="coordBack">Volver</button></div></form>';
      coordination.querySelectorAll('#coordForm input,#coordForm select,#coordForm textarea').forEach(el=>{el.style.cssText='display:block;width:100%;box-sizing:border-box;min-height:44px;padding:10px 12px;border:1px solid #c7d3e1;border-radius:10px;font:inherit;font-weight:400';});
      coordination.querySelector('[name=stage]').value=i.appointmentConfirmation;
      coordination.querySelector('#coordBack').onclick=showCoordination;
      coordination.querySelector('#coordForm').onsubmit=e=>{
        e.preventDefault();const fd=new FormData(e.currentTarget);
        const stage=String(fd.get('stage')),date=String(fd.get('date')||''),time=String(fd.get('time')||'').trim();
        if(stage==='Confirmada'&&(!date||!time)){alert('Para confirmar necesitas fecha y horario.');return;}
        if(stage==='Confirmada'&&!confirm('¿Tu jefe autorizó la disponibilidad y el cliente confirmó esta cita?'))return;
        const previous=i.appointmentConfirmation;
        i.appointmentConfirmation=stage;
        i.proposedAppointmentDate=date;
        i.proposedAppointmentWindow=time;
        // Conservar la disponibilidad original: el horario propuesto no la reemplaza.
        i.appointmentReceiver=String(fd.get('receiver')||'');
        i.appointmentNote=String(fd.get('note')||'');
        if(stage==='Confirmada'){i.appointmentDate=date;i.appointmentWindow=time;i.state='Programado';}
        else {i.appointmentDate='';if(i.state==='Programado')i.state='Pendiente';}
        i.history=i.history||[];
        i.history.push({date:new Date().toISOString(),action:'Coordinación de cita',detail:previous+' → '+stage+(date?' · '+date:'')+(time?' · '+time:'')});
        save();showCoordination();
      };
    }
    appointments.onclick=showCoordination;

}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

// Accesos rápidos desde las cuatro tarjetas de resumen del Inicio.
(function(){
'use strict';
function initDashboardLinks(){
  if(typeof showPage!=='function'||typeof activeIssues!=='function')return;

  if(!document.getElementById('dashboardMetricStyles')){
    const style=document.createElement('style');
    style.id='dashboardMetricStyles';
    style.textContent=`
      .dashboard-metric-link{cursor:pointer;transition:transform .12s ease,box-shadow .12s ease,border-color .12s ease;touch-action:manipulation}
      .dashboard-metric-link:active{transform:scale(.985)}
      .dashboard-metric-link:focus-visible{outline:3px solid #2e8bc0;outline-offset:3px}
      .dashboard-metric-link::after{content:'Tocar para abrir';display:block;margin-top:7px;font-size:11px;font-weight:700;color:#61738b}
      .dashboard-active-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin:6px 0 12px}
      @media(max-width:720px){.dashboard-active-head{display:grid}.dashboard-active-head .toolbar{margin:0}}
    `;
    document.head.appendChild(style);
  }

  function goTop(){try{window.scrollTo({top:0,behavior:'smooth'})}catch(_){window.scrollTo(0,0)}}

  function openClients(){
    issueTypeFilter='Todos';
    showPage('expedientes');
    renderClients('');
    goTop();
  }

  function openPending(group){
    pendingFilter=group;
    showPage('pendientes');
    goTop();
  }

  function activeDateText(issue){
    const dates=issueDates(issue).slice().sort((a,b)=>a.date.localeCompare(b.date));
    if(!dates.length)return 'Sin fecha';
    const t=today();
    const chosen=dates.find(d=>d.date>=t)||dates[dates.length-1];
    return `${esc(chosen.label)} · ${fmt(chosen.date)}`;
  }

  function renderActiveView(){
    const rows=activeIssues();
    const box=document.getElementById('pendientes');
    if(!box)return;
    box.innerHTML=`
      <div class="dashboard-active-head">
        <div><h2 style="margin:0">Asuntos activos</h2><div class="muted">${rows.length} asunto${rows.length===1?'':'s'} sin terminar ni cancelar</div></div>
        <div class="toolbar"><button class="btn secondary" id="dashboardAllPending">Ver todos los pendientes</button></div>
      </div>
      <div class="list">${rows.map(i=>`
        <div class="card pending-item" style="${typeStyle(i.type)};border-left:5px solid var(--type)">
          <div><strong>${esc(i.client.name)} · ${esc(i.type)}</strong><div class="muted">${esc(i.state||'Pendiente')} · ${esc(i.description||'Sin descripción')}</div></div>
          <div style="text-align:right"><div class="when">${activeDateText(i)}</div><button class="btn sm secondary" onclick="openClient('${i.client.id}')">Abrir</button></div>
        </div>`).join('')||'<div class="empty">No hay asuntos activos.</div>'}
      </div>`;
    const all=document.getElementById('dashboardAllPending');
    if(all)all.onclick=()=>{pendingFilter='Todos';renderPendientes();};
  }

  function openActive(){
    pendingFilter='Todos';
    showPage('pendientes');
    renderActiveView();
    goTop();
  }

  const actions={
    'Clientes':openClients,
    'Asuntos activos':openActive,
    'Vencidos':()=>openPending('Vencidos'),
    'Para hoy':()=>openPending('Hoy')
  };

  function enhance(){
    const home=document.getElementById('inicio');
    if(!home)return;
    const grid=home.querySelector('.grid.cards');
    if(!grid)return;
    [...grid.children].forEach(card=>{
      const label=(card.querySelector('.muted')?.textContent||'').trim();
      const action=actions[label];
      if(!action||card.dataset.dashboardLinked==='1')return;
      card.dataset.dashboardLinked='1';
      card.classList.add('dashboard-metric-link');
      card.setAttribute('role','button');
      card.setAttribute('tabindex','0');
      card.setAttribute('aria-label','Abrir '+label);
      card.addEventListener('click',action);
      card.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}
      });
    });
  }

  const home=document.getElementById('inicio');
  if(home){new MutationObserver(enhance).observe(home,{childList:true,subtree:true});}
  enhance();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initDashboardLinks);else initDashboardLinks();
})();