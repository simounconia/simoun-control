/* SIMOUN · Mi día — panel operativo sin alterar los expedientes existentes. */
(function(){
  const originalDashboard=dashboard;
  const localDate=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const daysSince=(date)=>{if(!date)return 0;const n=Math.floor((new Date(localDate()+'T12:00:00')-new Date(date.slice(0,10)+'T12:00:00'))/86400000);return Number.isFinite(n)?Math.max(0,n):0};
  function classify(i){
    const candidates=issueDates(i).map(x=>x.date).filter(Boolean).sort();
    const date=candidates[0]||'';
    const daily=i.followupMode==='Diariamente';
    const overdue=!!date&&date<localDate();
    const age=daysSince(i.clientContactDate||i.createdDate||i.requestDate||i.createdAt||date);
    const urgent=i.pendingPriority==='Urgente'||i.priority==='Urgente';
    const important=i.pendingPriority==='Importante'||i.priority==='Alta';
    const waiting=['Esperando a SIMOUN','Esperando autorización'].includes(i.state);
    const score=(urgent?1000:0)+(overdue?600:0)+(important?400:0)+(age>=14?350:age>=7?150:0)+(waiting?80:0)+(daily?60:0)+age;
    return {date,daily,overdue,age,score,level:urgent||overdue||age>=14?'red':important||waiting||daily||age>=7?'orange':'green'};
  }
  function renderToday(){
    originalDashboard();
    const root=document.getElementById('inicio');
    if(!root)return;
    const items=allIssues().filter(i=>i.active!==false&&!['Terminado','Cancelado'].includes(i.state)).map(i=>({...i,priorityInfo:classify(i)})).sort((a,b)=>b.priorityInfo.score-a.priorityInfo.score);
    const red=items.filter(i=>i.priorityInfo.level==='red').length;
    const yellow=items.filter(i=>i.priorityInfo.level==='orange').length;
    const todayItems=items.filter(i=>i.priorityInfo.date===localDate()||i.priorityInfo.daily).length;
    const waiting=items.filter(i=>['Esperando a SIMOUN','Esperando autorización'].includes(i.state)).length;
    const cards=items.map(i=>{
      const p=i.priorityInfo,c=i.client;
      return '<article class="card" style="border-left:5px solid '+(p.level==='red'?'#b42318':p.level==='orange'?'#a15c00':'#18794e')+'">'+
        '<div class="client"><div><strong>'+esc(c.company||c.name)+'</strong><div class="muted">'+esc(c.name)+(c.company?' · '+esc(i.type||''):'')+'</div></div><span class="badge '+p.level+'">'+(p.level==='red'?'Prioritario':p.level==='orange'?'Seguimiento':'Al corriente')+'</span></div>'+
        '<p>'+esc(i.description||'Sin descripción registrada')+'</p>'+(i.actionNote?'<p><b>Siguiente acción:</b> '+esc(i.actionNote)+'</p>':'')+(i.lastContactNote?'<p><b>Último contacto (registro manual):</b> '+esc(i.lastContactNote)+'</p>':'')+
        '<div class="badges"><span class="badge">'+esc(i.state||'Pendiente')+'</span>'+(p.daily?'<span class="badge blue">Seguimiento diario</span>':p.date?'<span class="badge">'+(p.overdue?'Vencido: ':'Próxima fecha: ')+esc(fmt(p.date))+'</span>':'<span class="badge orange">Sin fecha de seguimiento</span>')+(p.age?'<span class="badge">'+p.age+' días desde referencia</span>':'')+'</div>'+
        '<div class="toolbar" style="margin-top:12px"><button class="btn sm" data-today-client="'+esc(c.id)+'" data-today-issue="'+esc(i.id)+'">Abrir y atender</button></div></article>';
    }).join('');
    root.insertAdjacentHTML('afterbegin','<section aria-label="Mi día"><div class="section-title"><h2>☀️ Mi día</h2><span class="muted">'+esc(new Date().toLocaleDateString('es-MX',{dateStyle:'full'}))+'</span></div><p class="muted">Orden sugerido por urgencia, atraso y antigüedad. Los asuntos sin fecha también aparecen para que puedas asignarles seguimiento.</p><div class="grid cards"><div class="card"><div class="muted">🔴 Prioritarios</div><div class="metric">'+red+'</div></div><div class="card"><div class="muted">🟡 Dar seguimiento</div><div class="metric">'+yellow+'</div></div><div class="card"><div class="muted">📅 Con fecha hoy</div><div class="metric">'+todayItems+'</div></div><div class="card"><div class="muted">⏳ Dependen de SIMOUN</div><div class="metric">'+waiting+'</div></div></div><div class="section-title"><h3>Cola de atención</h3><span class="muted">'+items.length+' asuntos activos</span></div><div class="list">'+(cards||'<div class="card empty">No hay asuntos activos registrados.</div>')+'</div><div class="notice" style="margin:14px 0">Importante: el orden es una sugerencia. Confirma las citas y los pagos con el ingeniero o la cuenta bancaria antes de marcarlos como resueltos. Los avisos se muestran al abrir SIMOUN; todavía no son notificaciones externas.</div></section><hr style="border:0;border-top:1px solid #dce4ef;margin:24px 0">');
    root.querySelectorAll('[data-today-issue]').forEach(b=>b.addEventListener('click',()=>editIssue(b.dataset.todayClient,b.dataset.todayIssue)));
  }
  dashboard=renderToday;
  const label=PAGES.find(p=>p[0]==='inicio');if(label)label[1]='Mi día';
  nav();
  dashboard();
})();
