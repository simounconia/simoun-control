const JORNADA_DEFAULTS = [
  'Revisar pendientes y retroalimentación de clientes',
  'Confirmar trabajos del día, ventana de atención y cliente',
  'Pasar al inge la información y prioridades del día',
  'Atender llamadas y actualizar expedientes',
  'Preparar y dar seguimiento a cotizaciones',
  'Revisar llamadas, cobros y seguimientos pendientes',
  'Al terminar cada trabajo, pedir checklist y fotos antes/después',
  'Limpiar y dejar ordenado el local'
];
function jornadaData(){
  if(!state.jornada) state.jornada={tasks:[],routines:JORNADA_DEFAULTS.map((title,i)=>({id:'rutina-'+i,title})),routineDone:{},events:[],reports:[]};
  state.jornada.tasks ||= []; state.jornada.routines ||= []; state.jornada.routineDone ||= {}; state.jornada.events ||= []; state.jornada.reports ||= [];
  if(!state.jornada.routines.length) state.jornada.routines=JORNADA_DEFAULTS.map((title,i)=>({id:'rutina-'+i,title}));
  return state.jornada;
}
function jornadaToday(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function jesc(v=''){return esc(v)}
function jornadaDate(v){if(!v)return 'Sin fecha';return new Date(v+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}
function renderJornada(){
  const root=document.getElementById('jornada'); if(!root)return;
  const j=jornadaData(),day=jornadaToday(),done=j.routineDone[day]||{};
  const open=j.tasks.filter(x=>!x.done).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  const events=j.events.filter(x=>!x.done).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
  const checked=j.routines.filter(x=>done[x.id]).length;
  root.innerHTML=`
    <div class="j-hero"><div><span class="j-kicker">SIMOUN · ORGANIZACIÓN DEL DÍA</span><h2>Jornada de trabajo</h2><p>Captura rápido lo que te pidan, organiza la rutina y deja listo el reporte para el inge.</p></div><div class="j-date"><label for="jDay">Hoy</label><strong>${new Date(day+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}</strong><small>${open.length} pendiente${open.length===1?'':'s'} · ${events.length} evento${events.length===1?'':'s'}</small></div></div>
    <div class="j-layout">
      <section class="card j-card j-quick"><div class="j-heading"><div><span class="j-icon">⚡</span><h3>Captura rápida</h3></div><span class="j-count">${open.length} abiertos</span></div>
        <p class="muted">Anota una llamada, cotización, tarea de cliente o cualquier cosa que te pidan.</p>
        <form class="j-form" onsubmit="addJTask(event)">
          <label class="field"><span>¿Qué tienes que hacer?</span><input name="title" required placeholder="Ej. Llamar a Rocío para confirmar visita"></label>
          <div class="row"><label class="field"><span>Tipo</span><select name="type"><option>Cliente</option><option>Llamada</option><option>Cotización</option><option>Seguimiento</option><option>Trabajo</option><option>Otro</option></select></label><label class="field"><span>Fecha (opcional)</span><input name="date" type="date"></label></div>
          <label class="field"><span>Cliente o nota (opcional)</span><input name="note" placeholder="Nombre, ventana de atención o detalle"></label>
          <button class="btn">+ Agregar pendiente</button>
        </form>
        <div class="j-items">${open.length?open.map(t=>`<article class="j-item ${t.date&&t.date<day?'j-late':''}"><button class="j-check" title="Marcar realizado" onclick="toggleJTask('${t.id}')">✓</button><div class="j-item-text"><strong>${jesc(t.title)}</strong><small>${jesc(t.type||'Pendiente')}${t.note?' · '+jesc(t.note):''}</small></div><span class="j-due">${t.date?jornadaDate(t.date):''}</span><button class="j-x" aria-label="Eliminar" onclick="deleteJTask('${t.id}')">×</button></article>`).join(''):'<div class="j-empty">No hay pendientes abiertos. Agrega uno en cuanto te lo pidan.</div>'}</div>
      </section>
      <section class="card j-card"><div class="j-heading"><div><span class="j-icon">☑️</span><h3>Rutina diaria</h3></div><span class="j-count">${checked}/${j.routines.length}</span></div><p class="muted">Se reinicia sola cada día; tus marcas anteriores quedan guardadas.</p>
        <div class="j-routines">${j.routines.map(r=>`<label class="j-routine ${done[r.id]?'is-done':''}"><input type="checkbox" ${done[r.id]?'checked':''} onchange="toggleJRoutine('${r.id}',this.checked)"><span>${jesc(r.title)}</span>${r.custom?'<span class="j-custom-tag">personalizada</span>':''}</label>`).join('')}</div>
        <form class="j-add-routine" onsubmit="addJRoutine(event)"><input name="title" required placeholder="Agregar paso a la rutina"><button class="btn secondary">Añadir</button></form>
      </section>
      <section class="card j-card"><div class="j-heading"><div><span class="j-icon">🗓️</span><h3>Eventos y citas</h3></div><span class="j-count">${events.length} próximos</span></div>
        <form class="j-form" onsubmit="addJEvent(event)">
          <label class="field"><span>Evento</span><input name="title" required placeholder="Ej. Visita para cotizar / llamada"></label>
          <div class="row"><label class="field"><span>Fecha</span><input name="date" type="date" value="${day}" required></label><label class="field"><span>Hora o ventana</span><input name="window" placeholder="Ej. 10 a 12"></label></div>
          <div class="row"><label class="field"><span>Cliente</span><input name="client" placeholder="Opcional"></label><label class="field"><span>Confirmación</span><select name="confirmed"><option value="pendiente">Por confirmar</option><option value="cliente">Confirmado por cliente</option><option value="inge">Confirmado con el inge</option></select></label></div>
          <button class="btn">+ Agendar evento</button>
        </form>
        <div class="j-items">${events.length?events.map(e=>`<article class="j-event"><div class="j-event-date"><strong>${e.date?new Date(e.date+'T12:00:00').getDate():'—'}</strong><small>${e.date?new Date(e.date+'T12:00:00').toLocaleDateString('es-MX',{month:'short'}):''}</small></div><div class="j-item-text"><strong>${jesc(e.title)}</strong><small>${jesc(e.client||'Sin cliente')}${e.window?' · '+jesc(e.window):''}</small><span class="j-status ${e.confirmed==='cliente'?'ok':e.confirmed==='inge'?'blue':''}">${e.confirmed==='cliente'?'✓ Cliente confirmó':e.confirmed==='inge'?'✓ Inge confirmó':'Pendiente de confirmar'}</span></div><button class="btn sm secondary" onclick="completeJEvent('${e.id}')">Realizado</button><button class="j-x" aria-label="Eliminar" onclick="deleteJEvent('${e.id}')">×</button></article>`).join(''):'<div class="j-empty">Agenda aquí llamadas, citas y ventanas de atención.</div>'}</div>
      </section>
      <section class="card j-card j-report"><div class="j-heading"><div><span class="j-icon">📸</span><h3>Reporte del inge</h3></div><span class="j-count">${j.reports.filter(r=>!r.checklist||!r.before||!r.after).length} por completar</span></div>
        <p class="muted">Prepara en un toque la solicitud y registra qué se hizo, las fotos y lo que quedó pendiente.</p>
        <form class="j-form" onsubmit="addJReport(event)">
          <div class="row"><label class="field"><span>Cliente</span><input name="client" required placeholder="Nombre del cliente"></label><label class="field"><span>Trabajo realizado</span><input name="work" required placeholder="Ej. Revisión de cámaras"></label></div>
          <button class="btn">+ Abrir reporte de trabajo</button>
        </form>
        <div class="j-items">${j.reports.length?j.reports.slice().reverse().map(r=>`<article class="j-report-item"><div class="j-report-top"><div><strong>${jesc(r.client)}</strong><small>${jesc(r.work)} · ${jornadaDate(r.date)}</small></div><button class="btn sm light" onclick="copyJReport('${r.id}')">Copiar solicitud para el inge</button></div><div class="j-receipts"><label><input type="checkbox" ${r.checklist?'checked':''} onchange="toggleJReport('${r.id}','checklist',this.checked)"> Checklist recibido</label><label><input type="checkbox" ${r.before?'checked':''} onchange="toggleJReport('${r.id}','before',this.checked)"> Foto del antes</label><label><input type="checkbox" ${r.after?'checked':''} onchange="toggleJReport('${r.id}','after',this.checked)"> Foto del después</label></div><div class="row"><label class="field"><span>¿Qué se realizó?</span><textarea id="jdone-${r.id}" placeholder="Detalle breve">${jesc(r.doneText||'')}</textarea></label><label class="field"><span>¿Qué quedó pendiente y quién lo atenderá?</span><textarea id="jpending-${r.id}" placeholder="Pendiente y responsable">${jesc(r.pendingText||'')}</textarea></label></div><div class="j-report-actions"><button class="btn sm secondary" onclick="saveJReport('${r.id}')">Guardar avances</button><button class="btn sm danger" onclick="deleteJReport('${r.id}')">Eliminar reporte</button></div></article>`).join(''):'<div class="j-empty">Al terminar un trabajo, abre aquí su reporte y copia la solicitud para el inge.</div>'}</div>
      </section>
    </div>`;
}
function addJTask(e){e.preventDefault();const f=new FormData(e.currentTarget);jornadaData().tasks.unshift({id:uid(),title:f.get('title').trim(),type:f.get('type'),date:f.get('date'),note:f.get('note').trim(),done:false,createdAt:new Date().toISOString()});save()}
function toggleJTask(id){const x=jornadaData().tasks.find(t=>t.id===id);if(x){x.done=!x.done;save()}}
function deleteJTask(id){const j=jornadaData();j.tasks=j.tasks.filter(t=>t.id!==id);save()}
function addJRoutine(e){e.preventDefault();const f=new FormData(e.currentTarget),title=f.get('title').trim();if(!title)return;jornadaData().routines.push({id:uid(),title,custom:true});save()}
function toggleJRoutine(id,checked){const j=jornadaData(),day=jornadaToday();j.routineDone[day] ||= {};j.routineDone[day][id]=checked;save()}
function deleteJRoutine(e,id){e.preventDefault();e.stopPropagation();const j=jornadaData();j.routines=j.routines.filter(x=>x.id!==id);Object.values(j.routineDone).forEach(x=>delete x[id]);save()}
function addJEvent(e){e.preventDefault();const f=new FormData(e.currentTarget);jornadaData().events.push({id:uid(),title:f.get('title').trim(),date:f.get('date'),window:f.get('window').trim(),client:f.get('client').trim(),confirmed:f.get('confirmed'),done:false});save()}
function completeJEvent(id){const x=jornadaData().events.find(e=>e.id===id);if(x){x.done=true;save()}}
function deleteJEvent(id){const j=jornadaData();j.events=j.events.filter(e=>e.id!==id);save()}
function addJReport(e){e.preventDefault();const f=new FormData(e.currentTarget);jornadaData().reports.push({id:uid(),client:f.get('client').trim(),work:f.get('work').trim(),date:jornadaToday(),checklist:false,before:false,after:false,doneText:'',pendingText:''});save()}
function toggleJReport(id,key,value){const r=jornadaData().reports.find(x=>x.id===id);if(r){r[key]=value;save()}}
function saveJReport(id){const r=jornadaData().reports.find(x=>x.id===id);if(!r)return;r.doneText=document.getElementById('jdone-'+id).value;r.pendingText=document.getElementById('jpending-'+id).value;save()}
function deleteJReport(id){const j=jornadaData();j.reports=j.reports.filter(x=>x.id!==id);save()}
async function copyJReport(id){const r=jornadaData().reports.find(x=>x.id===id);if(!r)return;const msg=`Inge, por favor envíame el reporte de ${r.client} — ${r.work}:\n1. Checklist de lo realizado.\n2. Fotos del antes y del después.\n3. Qué quedó pendiente y quién lo atenderá.\nGracias.`;try{await navigator.clipboard.writeText(msg);alert('Solicitud copiada. Ya puedes pegarla en WhatsApp.')}catch{prompt('Copia esta solicitud para enviarla al inge:',msg)}}
const jornadaStyle=document.createElement('style');
jornadaStyle.textContent=`
#jornada .j-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:20px 22px;margin-bottom:14px;border-radius:18px;background:linear-gradient(135deg,#0b2c55,#246b91);color:white;box-shadow:var(--shadow)}
#jornada .j-hero h2{margin:5px 0;font-size:23px}#jornada .j-hero p{margin:0;opacity:.84}#jornada .j-kicker{font-size:11px;letter-spacing:.13em;font-weight:800;opacity:.8}
#jornada .j-date{min-width:180px;padding:12px 15px;border-radius:14px;background:#ffffff1c;display:grid;gap:4px;text-align:right}#jornada .j-date label,#jornada .j-date small{font-size:12px;opacity:.8}#jornada .j-date strong{text-transform:capitalize}
#jornada .j-layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}#jornada .j-card{min-width:0}#jornada .j-heading{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px}#jornada .j-heading>div{display:flex;align-items:center;gap:8px}#jornada .j-heading h3{margin:0;font-size:17px}#jornada .j-icon{font-size:20px}#jornada .j-count{font-size:11px;font-weight:800;color:#275c7e;background:#eaf3f8;border-radius:99px;padding:6px 9px}#jornada .j-form{display:grid;gap:9px;margin:12px 0}
#jornada .j-items{display:grid;gap:8px;margin-top:12px}#jornada .j-item,#jornada .j-event{display:flex;align-items:center;gap:9px;border:1px solid var(--line);border-radius:12px;padding:9px;background:#fff}#jornada .j-late{border-color:#f1b7af;background:#fff9f8}#jornada .j-check{flex:none;width:34px;height:34px;border:1px solid #b8d7c8;border-radius:10px;background:#edf8f2;color:#18794e;font-size:18px;font-weight:900}#jornada .j-item-text{display:grid;gap:3px;min-width:0;flex:1}#jornada .j-item-text strong{font-size:13px}#jornada .j-item-text small,#jornada .j-report-top small{color:var(--muted);font-size:11px}#jornada .j-due{white-space:nowrap;color:#a15c00;font-size:11px;font-weight:800}#jornada .j-x{flex:none;border:0;background:transparent;color:#8a98a9;font-size:20px;cursor:pointer}#jornada .j-empty{padding:14px;text-align:center;color:var(--muted);background:#f7f9fc;border-radius:12px;font-size:13px}
#jornada .j-routines{display:grid;gap:6px}#jornada .j-routine{display:flex;align-items:center;gap:10px;padding:9px 10px;background:#f7f9fc;border-radius:10px;font-size:13px}#jornada .j-routine input,#jornada .j-receipts input{width:18px;height:18px;accent-color:#18794e}#jornada .j-routine span{flex:1}#jornada .j-routine.is-done span{text-decoration:line-through;color:var(--muted)}#jornada .j-add-routine{display:flex;gap:8px;margin-top:10px}#jornada .j-add-routine input{flex:1;min-width:0;padding:10px;border:1px solid var(--line);border-radius:10px}
#jornada .j-event-date{flex:none;width:42px;height:48px;border-radius:10px;background:#eef4fa;display:grid;place-content:center;text-align:center;color:var(--brand)}#jornada .j-event-date strong{font-size:18px}#jornada .j-event-date small{text-transform:capitalize;font-size:10px}#jornada .j-status{font-size:10px;color:#a15c00}#jornada .j-status.ok{color:#18794e}#jornada .j-status.blue{color:#146b96}
#jornada .j-report{grid-column:1/-1}#jornada .j-report-item{padding:12px;border:1px solid var(--line);border-radius:12px;background:#fbfcfe}#jornada .j-report-top{display:flex;justify-content:space-between;gap:8px;align-items:center}#jornada .j-report-top>div{display:grid;gap:3px}#jornada .j-receipts{display:flex;gap:14px;flex-wrap:wrap;padding:10px 0;font-size:12px}#jornada .j-receipts label{display:flex;align-items:center;gap:6px}#jornada .j-report-actions{display:flex;gap:8px;margin-top:8px}
@media(max-width:720px){#jornada .j-layout{grid-template-columns:1fr}#jornada .j-report{grid-column:auto}#jornada .j-hero{display:grid;padding:16px}#jornada .j-date{text-align:left}#jornada .j-report-top{align-items:flex-start;display:grid}#jornada .j-event{flex-wrap:wrap}}
`;
document.head.appendChild(jornadaStyle);
renderJornada();
