const JORNADA_DEFAULTS = [
  'Abrir el local',
  'Saludar en persona o por WhatsApp',
  'Dejar mis cosas en el cajón con llave',
  'Prender la computadora',
  'Revisar los mensajes y las citas del día',
  'Generar la ficha, el pendiente y el registro en el sistema y el pizarrón',
  'Cerrar trabajos anteriores y pagos con el inge; actualizar el sistema, el registro y el pizarrón',
  'Gestionar con el inge el reporte para el jefe (impreso y actualizado desde el día anterior)',
  'Pasar al inge los trabajos pendientes para cotizar, comprar, agendar y/o resolver (del día anterior y los generados en la mañana)',
  'Tomar agua: 500 ml',
  'Limpiar el local',
  'Tomar breaks Pomodoro',
  'Ir a comer con Pinky; preguntarle si dejo abierto o cerrado y anotarlo',
  'Atención al cliente y gestión',
  'Actualizar papelería contable: facturas realizadas, recibidas y estado de cuenta',
  'Tomar agua: 500 ml',
  'Cobranza: cuentas por cobrar, pagadas parcialmente, pagadas y sin cobro; fecha de seguimiento y facturación, remisión o nota foliada',
  'Tomar agua: 500 ml',
  'Monitoreo: realizar cobros y actualizar la base de datos',
  'Dejar actualizado el sistema SIMOUN al momento',
  'Imprimir el reporte para el jefe y marcar acciones con el inge (pasar por IA, sin repeticiones y ahorrando espacio)',
  'Tomar agua: 500 ml'
];
const JORNADA_VERSION = 3;
function jornadaData(){
  if(!state.jornada) state.jornada={tasks:[],routines:JORNADA_DEFAULTS.map((title,i)=>({id:'rutina-'+i,title})),routineDone:{},events:[],reports:[],routineVersion:JORNADA_VERSION};
  state.jornada.tasks ||= []; state.jornada.routines ||= []; state.jornada.routineDone ||= {}; state.jornada.events ||= []; state.jornada.reports ||= [];
  if((state.jornada.routineVersion||0)<JORNADA_VERSION){
    state.jornada.routines=JORNADA_DEFAULTS.map((title,i)=>({id:'rutina-'+i,title}));
    state.jornada.routineDone={};
    state.jornada.routineVersion=JORNADA_VERSION;
  }
  if(!state.jornada.routines.length) state.jornada.routines=JORNADA_DEFAULTS.map((title,i)=>({id:'rutina-'+i,title}));
  return state.jornada;
}
function jornadaToday(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function jesc(v=''){return esc(v)}
function jornadaDate(v){if(!v)return 'Sin fecha';return new Date(v+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}
let jornadaNoteViewDate='',jornadaNoteCalendarDay='',jornadaNoteSaveTimer=null,jornadaNoteSearch='';
function jornadaLongDate(v){return new Date(v+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
function setJornadaNoteSearch(v){
  jornadaNoteSearch=v;
  const active=document.activeElement;
  const cursor=active&&typeof active.selectionStart==='number'?active.selectionStart:String(v).length;
  renderJornada();
  const input=document.getElementById('jNoteSearch');
  if(input){input.focus({preventScroll:true});try{input.setSelectionRange(cursor,cursor)}catch{}}
}
function saveJDailyNote(shouldRender=true){
  const j=jornadaData(),date=jornadaNoteViewDate||jornadaToday(),text=document.getElementById('jDailyNote')?.value||'';
  j.dailyNotes ||= {};
  if(text.trim())j.dailyNotes[date]=text;else delete j.dailyNotes[date];
  if(shouldRender)save();
}
function jornadaDraftNote(text){
  const j=jornadaData(),date=jornadaNoteViewDate||jornadaToday();
  j.dailyNotes ||= {};
  if(text.trim())j.dailyNotes[date]=text;else delete j.dailyNotes[date];
  state._updatedAt=new Date().toISOString();
  localStorage.setItem(LS,JSON.stringify(state));
  clearTimeout(jornadaNoteSaveTimer);
  jornadaNoteSaveTimer=setTimeout(()=>window.SimounSync?.queuePush(state),700);
}
function jornadaSetNoteDate(date){
  if(!date)return;
  saveJDailyNote(false);
  jornadaNoteViewDate=date;
  save();
}
function jornadaShowTodayNote(){saveJDailyNote(false);jornadaNoteViewDate=jornadaToday();save();}

const J_TASK_TYPES=['Del Inge','Clientes','Administrativo','Garantías','General'];
const J_TASK_COLORS={'Del Inge':'#1d4ed8','Clientes':'#087f75','Administrativo':'#7543a8','Garantías':'#b45309','General':'#475569'};
function jTaskType(t){const v=String(t.type||'');return J_TASK_TYPES.includes(v)?v:({Cliente:'Clientes',Llamada:'Clientes',Cotización:'Clientes',Seguimiento:'Clientes',Trabajo:'General',Otro:'General'}[v]||'General')}
function jTaskGroups(tasks,day,done){
 return J_TASK_TYPES.map(type=>{
  const group=tasks.filter(t=>jTaskType(t)===type);if(!group.length)return '';
  const dates=[...new Set(group.map(t=>t.date||''))].sort((a,b)=>(a||'9999').localeCompare(b||'9999'));
  return '<section class="j-task-group" style="--j-task-color:'+J_TASK_COLORS[type]+'"><h4>'+jesc(type)+' · '+group.length+'</h4>'+dates.map(date=>'<div class="j-task-date">'+(date===day?'Hoy · ':date&&date<day&&!done?'Vencido · ':'')+jesc(date?jornadaLongDate(date):'Sin fecha')+'</div><div class="j-items">'+group.filter(t=>(t.date||'')===date).map(t=>jTaskCard(t,day,done)).join('')+'</div>').join('')+'</section>';
 }).join('');
}

function jTaskCard(t,day,isDone){
  const completedDate=t.completedAt?new Date(t.completedAt).toLocaleDateString('es-MX',{day:'numeric',month:'short'}):'Realizado';
  return '<article class="j-item '+(!isDone&&t.date&&t.date<day?'j-late':'')+'">'+
    '<button class="j-check '+(isDone?'is-completed':'')+'" title="'+(isDone?'Reabrir pendiente':'Marcar realizado')+'" onclick="toggleJTask(\''+t.id+'\')">'+(isDone?'✓':'○')+'</button>'+
    '<div class="j-item-text"><strong>'+jesc(t.title)+'</strong>'+(t.note?'<small>'+jesc(t.note)+'</small>':'')+'</div><span class="j-type-pill" style="background:'+J_TASK_COLORS[jTaskType(t)]+'">'+jesc(jTaskType(t))+'</span>'+
    '<span class="j-due">'+(isDone?'✓ '+completedDate:(t.date?(t.date===day?'Hoy · ':t.date<day?'Vencido · ':'')+jornadaDate(t.date):'Sin fecha'))+'</span>'+
    '<div class="split-actions"><button class="btn sm secondary" type="button" onclick="editJTask(\''+t.id+'\')">Editar</button><button class="j-x" type="button" aria-label="Borrar pendiente" onclick="deleteJTask(\''+t.id+'\')">×</button></div></article>';
}
function jRoutineRows(j,done){
  return j.routines.map((r,index)=>{
    const classes='j-routine'+(done[r.id]?' is-done':'');
    return '<div class="'+classes+'"><label class="j-routine-label"><input type="checkbox" '+(done[r.id]?'checked':'')+' onchange="toggleJRoutine(\''+r.id+'\',this.checked)"><span>'+jesc(r.title)+'</span>'+(r.custom?'<span class="j-custom-tag">personalizada</span>':'')+'</label>'+
      '<div class="j-routine-actions"><button type="button" class="j-routine-move" title="Mover paso arriba" aria-label="Mover '+jesc(r.title)+' arriba" '+(index===0?'disabled':'')+' onclick="moveJRoutine(\''+r.id+'\',-1)">↑</button>'+
      '<button type="button" class="j-routine-move" title="Mover paso abajo" aria-label="Mover '+jesc(r.title)+' abajo" '+(index===j.routines.length-1?'disabled':'')+' onclick="moveJRoutine(\''+r.id+'\',1)">↓</button>'+
      '<button type="button" class="j-routine-edit" title="Editar paso" aria-label="Editar '+jesc(r.title)+'" onclick="editJRoutine(\''+r.id+'\')">✎</button>'+
      '<button type="button" class="j-routine-delete" title="Borrar paso" aria-label="Borrar '+jesc(r.title)+'" onclick="deleteJRoutine(event,\''+r.id+'\')">×</button></div></div>';
  }).join('');
}
let jornadaTaskQuery='',jornadaView='pendientes',jornadaTypeFilter='Todos',jornadaDateFilter='todos',jornadaSort='manual';
function jornadaSetView(view){
 if(!['pendientes','rutina','notas'].includes(view))return;
 jornadaView=view;renderJornada();
}
function jornadaFilter(type,date){
 jornadaTypeFilter=type;jornadaDateFilter=date;renderJornada();
}
function jornadaFilterDate(t,day){
 return jornadaDateFilter==='todos'||(jornadaDateFilter==='hoy'&&t.date===day)||(jornadaDateFilter==='vencidos'&&!!t.date&&t.date<day)||(jornadaDateFilter==='proximos'&&!!t.date&&t.date>day)||(jornadaDateFilter==='sinfecha'&&!t.date);
}
function jornadaDashboard(tasks,day){
 const open=tasks.filter(t=>!t.done);
 const metrics=[['todos','Abiertos',open.length],['hoy','Hoy',open.filter(t=>t.date===day).length],['vencidos','Vencidos',open.filter(t=>t.date&&t.date<day).length],['proximos','Próximos',open.filter(t=>t.date&&t.date>day).length],['sinfecha','Sin fecha',open.filter(t=>!t.date).length]];
 return '<div class="j-metrics">'+metrics.map(([key,label,count])=>'<button type="button" class="j-metric '+(jornadaDateFilter===key?'selected':'')+'" onclick="jornadaFilter(jornadaTypeFilter,\''+key+'\')"><span>'+label+'</span><strong>'+count+'</strong></button>').join('')+'</div><div class="j-type-tabs">'+['Todos',...J_TASK_TYPES].map((type,i)=>'<button type="button" style="--chip:'+(J_TASK_COLORS[type]||'#12365b')+'" class="'+(jornadaTypeFilter===type?'selected':'')+'" onclick="jornadaFilter('+ (i===0?"\'Todos\'":"J_TASK_TYPES["+(i-1)+"]") +',jornadaDateFilter)">'+jesc(type)+' · '+open.filter(t=>(type==='Todos'||jTaskType(t)===type)&&jornadaFilterDate(t,day)).length+'</button>').join('')+'</div>';
}
function jornadaSortMode(mode){if(!['manual','fecha','tipo'].includes(mode))return;jornadaSort=mode;renderJornada()}
function jornadaManualTasks(tasks){
 const order=Array.isArray(jornadaData().taskOrder)?jornadaData().taskOrder:[],rank=new Map(order.map((id,i)=>[id,i]));
 return tasks.slice().sort((a,b)=>(rank.get(a.id)??Number.MAX_SAFE_INTEGER)-(rank.get(b.id)??Number.MAX_SAFE_INTEGER));
}
function jornadaMoveTask(id,step){
 const all=jornadaManualTasks(jornadaData().tasks.filter(t=>!t.done));
 const day=jornadaToday(),norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),words=norm(jornadaTaskQuery).trim().split(/\s+/).filter(Boolean);
 const visible=all.filter(t=>(jornadaTypeFilter==='Todos'||jTaskType(t)===jornadaTypeFilter)&&jornadaFilterDate(t,day)&&words.every(w=>norm([t.title,t.type,jTaskType(t),t.note,t.date,jornadaDate(t.date)].join(' ')).includes(w)));
 const index=visible.findIndex(t=>t.id===id),target=visible[index+step];
 if(index<0||!target)return;
 const a=all.findIndex(t=>t.id===id),b=all.findIndex(t=>t.id===target.id);
 [all[a],all[b]]=[all[b],all[a]];
 jornadaData().taskOrder=all.map(t=>t.id);jornadaSort='manual';save();
}
function jornadaFlatRows(tasks,day,done){
 return tasks.map((t,index)=>'<div class="j-flat-row" style="--j-task-color:'+J_TASK_COLORS[jTaskType(t)]+'">'+(!done&&jornadaSort==='manual'?'<div class="j-order"><strong>'+(index+1)+'</strong><button type="button" aria-label="Subir pendiente" '+(index===0?'disabled':'')+' onclick="jornadaMoveTask(\''+t.id+'\',-1)">↑</button><button type="button" aria-label="Bajar pendiente" '+(index===tasks.length-1?'disabled':'')+' onclick="jornadaMoveTask(\''+t.id+'\',1)">↓</button></div>':'')+jTaskCard(t,day,done)+'</div>').join('');
}
function jornadaTaskResults(tasks,day){
  const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const words=normalize(jornadaTaskQuery).trim().split(/\s+/).filter(Boolean);
  const matches=tasks.filter(t=>{
    if(jornadaTypeFilter!=='Todos'&&jTaskType(t)!==jornadaTypeFilter)return false;
    if(!jornadaFilterDate(t,day))return false;
    const text=normalize([t.title,t.type,jTaskType(t),t.note,t.date,jornadaDate(t.date)].join(' '));
    return words.every(word=>text.includes(word));
  });
  if(words.length && !matches.length)return '<div class="j-empty">Sin coincidencias.</div>';
  const open=jornadaSort==='manual'?jornadaManualTasks(matches.filter(x=>!x.done)):matches.filter(x=>!x.done).sort((a,b)=>jornadaSort==='tipo'?(J_TASK_TYPES.indexOf(jTaskType(a))-J_TASK_TYPES.indexOf(jTaskType(b))||(a.date||'9999').localeCompare(b.date||'9999')):(a.date||'9999').localeCompare(b.date||'9999'));
  const completed=matches.filter(x=>x.done).sort((a,b)=>String(b.completedAt||b.createdAt||'').localeCompare(String(a.completedAt||a.createdAt||'')));
  return `<div class="j-board">${open.length?jornadaFlatRows(open,day,false):words.length?'':'<div class="j-empty">No hay pendientes abiertos en esta vista.</div>'}</div>
  ${completed.length?'<details '+(words.length?'open ':'')+'class="j-completed"><summary>✓ Pendientes realizados · '+completed.length+'</summary><div class="j-items">'+jornadaFlatRows(completed,day,true)+'</div></details>':''}`;
}
function searchJornadaTasks(value){
  jornadaTaskQuery=value;
  document.getElementById('jTaskResults').innerHTML=jornadaTaskResults(jornadaData().tasks,jornadaToday());
}
function renderJornada(){
  const root=document.getElementById('jornada'); if(!root)return;
  const j=jornadaData(),day=jornadaToday(),done=j.routineDone[day]||{};
  j.dailyNotes ||= {};
  if(jornadaNoteCalendarDay!==day){jornadaNoteCalendarDay=day;jornadaNoteViewDate=day}
  if(!jornadaNoteViewDate)jornadaNoteViewDate=day;
  const noteDay=jornadaNoteViewDate,noteText=j.dailyNotes[noteDay]||'';
  const allNoteDates=Object.keys(j.dailyNotes).filter(d=>j.dailyNotes[d]?.trim()).sort((a,b)=>b.localeCompare(a));
  const noteQuery=jornadaNoteSearch.trim().toLowerCase();
  const noteDates=allNoteDates.filter(d=>!noteQuery||d.toLowerCase().includes(noteQuery)||String(j.dailyNotes[d]||'').toLowerCase().includes(noteQuery));
  const open=j.tasks.filter(x=>!x.done);

  const checked=j.routines.filter(x=>done[x.id]).length;
  root.innerHTML=`
    <div class="j-hero"><div><span class="j-kicker">SIMOUN · ORGANIZACIÓN DEL DÍA</span><h2>Jornada de trabajo</h2><p>Captura rápido lo que te pidan y organiza el trabajo del día.</p></div><div class="j-date"><label for="jDay">Hoy</label><strong>${new Date(day+'T12:00:00').toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long'})}</strong><small>${open.length} pendiente${open.length===1?'':'s'}</small></div></div>
    <div class="j-view-tabs" role="group" aria-label="Vistas de Jornada">
      ${[['pendientes','⚡','Pendientes',open.length+' abiertos'],['rutina','☑','Rutina diaria',checked+'/'+j.routines.length+' realizados'],['notas','📝','Notas del día',allNoteDates.length+' días guardados']].map(([key,icon,label,detail])=>`<button type="button" aria-pressed="${jornadaView===key}" class="${jornadaView===key?'selected':''}" onclick="jornadaSetView('${key}')"><span class="j-view-icon">${icon}</span><span><strong>${label}</strong><small>${detail}</small></span></button>`).join('')}
    </div>
    <div class="j-layout j-layout-focused">
      <section class="card j-card j-quick" ${jornadaView==='pendientes'?'':'hidden'}><div class="j-heading"><div><span class="j-icon">⚡</span><h3>Captura rápida</h3></div><span class="j-count">${open.length} abiertos</span></div>
        <p class="muted">Anota una llamada, cotización, tarea de cliente o cualquier cosa que te pidan.</p>
        <form class="j-form" onsubmit="addJTask(event)">
          <label class="field"><span>¿Qué tienes que hacer?</span><input name="title" required placeholder="Ej. Llamar a Rocío para confirmar visita"></label>
          <div class="row"><label class="field"><span>Tipo</span><select name="type"><option>Del Inge</option><option>Clientes</option><option>Administrativo</option><option>Garantías</option><option>General</option></select></label><label class="field"><span>Fecha (opcional)</span><input name="date" type="date"></label></div>
          <label class="field"><span>Cliente o nota (opcional)</span><input name="note" placeholder="Nombre, ventana de atención o detalle"></label>
          <button class="btn">+ Agregar pendiente</button>
        </form>
        ${jornadaDashboard(j.tasks,day)}
        <div class="j-sort-bar"><strong>Ordenar pendientes</strong><div class="j-sort-buttons">${[['manual','Mi orden'],['fecha','Por fecha'],['tipo','Por tipo']].map(([key,label])=>`<button type="button" class="btn sm ${jornadaSort===key?'':'secondary'}" onclick="jornadaSortMode('${key}')">${label}</button>`).join('')}</div><small class="muted">${jornadaSort==='manual'?'Usa ↑ y ↓ para definir tu prioridad.':'Puedes regresar a Mi orden sin perder tus prioridades.'}</small></div>
        <label class="field"><span>Buscar pendientes</span><input type="search" class="search" placeholder="Título, cliente, nota, tipo o fecha" value="${jesc(jornadaTaskQuery)}" oninput="searchJornadaTasks(this.value)"></label>
        <div id="jTaskResults">${jornadaTaskResults(j.tasks,day)}</div>
      </section>
      <section class="card j-card" ${jornadaView==='rutina'?'':'hidden'}><div class="j-heading"><div><span class="j-icon">☑️</span><h3>Rutina diaria</h3></div><span class="j-count">${checked}/${j.routines.length}</span></div><p class="muted">Se reinicia sola cada día; tus marcas anteriores quedan guardadas.</p>
        <div class="j-routines">${jRoutineRows(j,done)}</div>
        <form class="j-add-routine" onsubmit="addJRoutine(event)"><input name="title" required placeholder="Agregar paso a la rutina"><button class="btn secondary">Añadir</button></form>
      </section>
      <section class="card j-card j-daily-note" ${jornadaView==='notas'?'':'hidden'}><div class="j-heading"><div><span class="j-icon">📝</span><h3>Notas del día</h3></div><span class="j-count">${allNoteDates.length} día${allNoteDates.length===1?'':'s'} guardado${allNoteDates.length===1?'':'s'}</span></div>
        <p class="muted">Anota situaciones, acuerdos o detalles que quieras recordar aunque no vayan en el sistema. Cada fecha conserva su propia nota; al abrir un día nuevo tendrás un espacio nuevo.</p>
        <div class="j-note-controls"><label class="field"><span>Fecha de la nota</span><input type="date" value="${noteDay}" onchange="jornadaSetNoteDate(this.value)"></label><button type="button" class="btn secondary" onclick="jornadaShowTodayNote()">Ir a hoy</button></div>
        <div class="j-note-date">${jornadaLongDate(noteDay)}</div>
        <label class="field"><span>¿Qué pasó hoy?</span><textarea id="jDailyNote" oninput="jornadaDraftNote(this.value)" placeholder="Escribe aquí lo que quieras dejar registrado para este día.">${jesc(noteText)}</textarea></label>
        <div class="j-note-actions"><button type="button" class="btn" onclick="saveJDailyNote()">✓ Guardar nota de este día</button><span class="muted">Se guarda asociada a la fecha seleccionada.</span></div>
        <div class="j-note-archive"><label class="field"><span>Buscar en el diario</span><input id="jNoteSearch" class="search" type="search" placeholder="Escribe una fecha o palabras de la nota" value="${jesc(jornadaNoteSearch)}" oninput="setJornadaNoteSearch(this.value)"></label><strong>Notas guardadas por día${noteQuery?' · '+noteDates.length+' coincidencias':''}</strong><div class="j-note-days">${noteDates.map(d=>'<button type="button" class="btn sm '+(d===noteDay?'':'secondary')+'" onclick="jornadaSetNoteDate(\''+d+'\')">'+jesc(jornadaLongDate(d))+'</button>').join('')||'<span class="muted">No hay notas que coincidan.</span>'}</div></div>
      </section>
    </div>`;
}
function addJTask(e){e.preventDefault();const f=new FormData(e.currentTarget);jornadaTypeFilter='Todos';jornadaDateFilter='todos';jornadaTaskQuery='';jornadaData().tasks.unshift({id:uid(),title:f.get('title').trim(),type:f.get('type'),date:f.get('date'),note:f.get('note').trim(),done:false,createdAt:new Date().toISOString()});save()}
function toggleJTask(id){
  const x=jornadaData().tasks.find(t=>t.id===id);if(!x)return;
  x.done=!x.done;
  if(x.done)x.completedAt=new Date().toISOString();else delete x.completedAt;
  save();
}
function editJTask(id){
  const task=jornadaData().tasks.find(t=>t.id===id);if(!task)return;
  let dlg=document.getElementById('jTaskEditDlg');
  if(!dlg){dlg=document.createElement('dialog');dlg.id='jTaskEditDlg';dlg.innerHTML='<div class="modal-head"><strong>Editar pendiente</strong><button class="close" type="button" aria-label="Cerrar">×</button></div><div class="modal-body"></div>';document.body.appendChild(dlg);dlg.querySelector('.close').addEventListener('click',()=>dlg.close())}
  const body=dlg.querySelector('.modal-body');
  body.innerHTML='<form id="jTaskEditForm" style="display:grid;gap:12px">'+
    '<label class="field"><span>¿Qué tienes que hacer?</span><input name="title" required value="'+jesc(task.title)+'"></label>'+
    '<div class="row"><label class="field"><span>Tipo</span><select name="type">'+J_TASK_TYPES.map(x=>'<option '+(x===jTaskType(task)?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
    '<label class="field"><span>Fecha</span><input name="date" type="date" value="'+jesc(task.date||'')+'"></label></div>'+
    '<label class="field"><span>Cliente o nota</span><input name="note" value="'+jesc(task.note||'')+'"></label>'+
    '<div class="toolbar"><button class="btn" type="submit">Guardar cambios</button><button class="btn secondary" type="button" data-cancel>Cerrar</button></div></form>';
  body.querySelector('[data-cancel]').addEventListener('click',()=>dlg.close());
  body.querySelector('form').addEventListener('submit',e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget);
    task.title=String(fd.get('title')||'').trim();task.type=String(fd.get('type')||'General');
    task.date=String(fd.get('date')||'');task.note=String(fd.get('note')||'').trim();
    save();dlg.close();
  });
  dlg.showModal();
}
function deleteJTask(id){
  const j=jornadaData(),task=j.tasks.find(t=>t.id===id);if(!task)return;
  if(!confirmDelete('¿Borrar definitivamente el pendiente "'+(task.title||'')+'"?'))return;
  j.tasks=j.tasks.filter(t=>t.id!==id);save();
}
function addJRoutine(e){e.preventDefault();const f=new FormData(e.currentTarget),title=f.get('title').trim();if(!title)return;jornadaData().routines.push({id:uid(),title,custom:true});save()}
function toggleJRoutine(id,checked){const j=jornadaData(),day=jornadaToday();j.routineDone[day] ||= {};j.routineDone[day][id]=checked;save()}
function editJRoutine(id){
  const item=jornadaData().routines.find(x=>x.id===id);if(!item)return;
  const title=prompt('Editar paso de la rutina diaria:',item.title);
  if(title===null)return;
  if(!title.trim())return alert('Escribe el paso de la rutina.');
  item.title=title.trim();save();
}
function moveJRoutine(id,direction){
  const routines=jornadaData().routines,index=routines.findIndex(x=>x.id===id),target=index+direction;
  if(index<0||target<0||target>=routines.length)return;
  [routines[index],routines[target]]=[routines[target],routines[index]];
  save();
}
function deleteJRoutine(e,id){
  e.preventDefault();e.stopPropagation();
  const j=jornadaData(),item=j.routines.find(x=>x.id===id);if(!item)return;
  if(!confirmDelete('¿Borrar el paso "'+item.title+'" de la rutina diaria?'))return;
  j.routines=j.routines.filter(x=>x.id!==id);
  Object.values(j.routineDone).forEach(x=>delete x[id]);
  save();
}
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
#jornada .j-routines{display:grid;gap:6px}#jornada .j-routine{display:flex;align-items:center;gap:10px;padding:9px 10px;background:#f7f9fc;border-radius:10px;font-size:13px}#jornada .j-routine input,#jornada .j-receipts input{width:18px;height:18px;accent-color:#18794e}#jornada .j-routine-label{display:flex;align-items:center;gap:10px;flex:1;min-width:0}#jornada .j-routine-label>span:first-of-type{flex:1}#jornada .j-routine-label .j-custom-tag{flex:none}#jornada .j-routine-actions{display:flex;gap:3px;flex:none}#jornada .j-routine-actions button{width:30px;height:30px;padding:0;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--brand);font-size:15px;font-weight:800;cursor:pointer}#jornada .j-routine-actions .j-routine-delete{color:var(--danger)}#jornada .j-routine-actions button:disabled{opacity:.35;cursor:not-allowed}#jornada .j-routine.is-done span{text-decoration:line-through;color:var(--muted)}#jornada .j-add-routine{display:flex;gap:8px;margin-top:10px}#jornada .j-add-routine input{flex:1;min-width:0;padding:10px;border:1px solid var(--line);border-radius:10px}
#jornada .j-event-date{flex:none;width:42px;height:48px;border-radius:10px;background:#eef4fa;display:grid;place-content:center;text-align:center;color:var(--brand)}#jornada .j-event-date strong{font-size:18px}#jornada .j-event-date small{text-transform:capitalize;font-size:10px}#jornada .j-status{font-size:10px;color:#a15c00}#jornada .j-status.ok{color:#18794e}#jornada .j-status.blue{color:#146b96}
#jornada .j-report{grid-column:1/-1}#jornada .j-report-item{padding:12px;border:1px solid var(--line);border-radius:12px;background:#fbfcfe}#jornada .j-report-top{display:flex;justify-content:space-between;gap:8px;align-items:center}#jornada .j-report-top>div{display:grid;gap:3px}#jornada .j-receipts{display:flex;gap:14px;flex-wrap:wrap;padding:10px 0;font-size:12px}#jornada .j-receipts label{display:flex;align-items:center;gap:6px}#jornada .j-report-actions{display:flex;gap:8px;margin-top:8px}
#jornada .j-daily-note{grid-column:1/-1}#jornada .j-note-controls{display:flex;align-items:end;gap:9px;flex-wrap:wrap;margin:10px 0}#jornada .j-note-controls .field{min-width:190px;flex:1}#jornada .j-note-date{text-transform:capitalize;font-weight:800;color:#164a78;margin:8px 0}#jornada #jDailyNote{width:100%;min-height:190px;padding:12px;border:1px solid var(--line);border-radius:12px;resize:vertical;background:#fff;color:var(--ink)}#jornada .j-note-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:9px}#jornada .j-note-archive{border-top:1px solid var(--line);margin-top:14px;padding-top:12px;display:grid;gap:8px}#jornada .j-note-days{display:flex;gap:7px;flex-wrap:wrap}#jornada .j-note-days .btn{white-space:normal;text-align:left}
@media(max-width:720px){#jornada .j-layout{grid-template-columns:1fr}#jornada .j-report{grid-column:auto}#jornada .j-hero{display:grid;padding:16px}#jornada .j-date{text-align:left}#jornada .j-report-top{align-items:flex-start;display:grid}#jornada .j-event{flex-wrap:wrap}}
`;
jornadaStyle.textContent+="\n#jornada .j-task-group{border:1px solid var(--line);border-left:4px solid var(--j-task-color);border-radius:10px;padding:8px;margin:8px 0;background:#fff;min-width:0}\n#jornada .j-task-group h4{background:var(--j-task-color);color:white;padding:7px 10px;border-radius:6px;margin:0 0 8px;font-size:13px}\n#jornada .j-task-date{font-size:12px;font-weight:700;color:var(--j-task-color);margin:10px 0 4px;text-transform:capitalize}\n#jornada .j-task-group .j-items{margin-top:4px}\n";
jornadaStyle.textContent+="\n#jornada .j-layout-focused{display:block}\n#jornada .j-layout-focused>[hidden]{display:none!important}\n#jornada .j-view-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:0 0 14px}\n#jornada .j-view-tabs button{display:flex;align-items:center;gap:9px;text-align:left;border:1px solid #d5e0ec;border-radius:12px;padding:12px;background:white;color:#12365b;cursor:pointer;min-width:0}\n#jornada .j-view-tabs button.selected{background:#12365b;border-color:#12365b;color:white}\n#jornada .j-view-tabs button strong,#jornada .j-view-tabs button small{display:block;overflow-wrap:anywhere}\n#jornada .j-view-tabs button small{font-size:11px;opacity:.8;margin-top:4px}\n#jornada .j-view-icon{font-size:22px;flex:none}\n#jornada .j-quick .j-form{grid-template-columns:2fr 2fr 1.4fr auto;align-items:end;background:#f3f7fb;padding:12px;border-radius:12px}\n#jornada .j-quick .j-form .row{grid-template-columns:repeat(2,minmax(0,1fr))}\n#jornada .j-quick .j-form .field{min-width:0}\n#jornada .j-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:14px 0}\n#jornada .j-metric{display:grid;gap:5px;text-align:left;border:1px solid #d5e0ec;border-radius:10px;background:#fff;padding:10px;color:#12365b;cursor:pointer}\n#jornada .j-metric strong{font-size:23px}#jornada .j-metric span{font-size:12px;font-weight:600}\n#jornada .j-metric.selected{background:#eaf2fb;border-color:#12365b;box-shadow:inset 0 0 0 1px #12365b}\n#jornada .j-type-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}\n#jornada .j-type-tabs button{border:1px solid var(--chip);color:var(--chip);background:white;border-radius:8px;font-weight:600;padding:7px 10px;cursor:pointer}\n#jornada .j-type-tabs button.selected{background:var(--chip);color:white}\n#jornada .j-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:12px;align-items:start}\n#jornada .j-board .j-task-group{margin:0}\n#jornada .j-item-text{overflow-wrap:anywhere}\n#jornada .j-item{flex-wrap:wrap}\n#jornada .j-item .split-actions{gap:4px}\n@media(max-width:1000px){#jornada .j-quick .j-form{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media(max-width:600px){#jornada .j-quick .j-form{grid-template-columns:1fr}#jornada .j-view-tabs{gap:4px}#jornada .j-view-tabs button{display:grid;gap:3px;padding:8px 5px;text-align:center}#jornada .j-view-tabs button strong{font-size:12px}#jornada .j-view-tabs button small{font-size:10px}#jornada .j-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}#jornada .j-metric{padding:8px}}\n";
jornadaStyle.textContent+="#jornada .j-board{display:grid;grid-template-columns:minmax(0,1fr);gap:6px}\n#jornada .j-flat-row{display:flex;gap:8px;align-items:center;border:1px solid var(--line);border-left:4px solid var(--j-task-color);border-radius:10px;padding:5px 8px;background:#fff;min-width:0}\n#jornada .j-flat-row .j-item{flex:1;border:0;background:transparent;padding:5px;min-width:0;flex-wrap:nowrap}\n#jornada .j-flat-row:has(.j-late){background:#fff8f6}\n#jornada .j-type-pill{flex:none;color:white;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:700}\n#jornada .j-flat-row .j-due{min-width:95px;text-align:right}\n#jornada .j-order{display:flex;align-items:center;gap:3px;flex:none;color:var(--brand)}\n#jornada .j-order strong{font-size:12px;min-width:18px;text-align:center}\n#jornada .j-order button{border:1px solid var(--line);background:#edf3f9;color:var(--brand);border-radius:6px;width:28px;height:30px;cursor:pointer}\n#jornada .j-order button:disabled{opacity:.35;cursor:default}\n#jornada .j-sort-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}\n#jornada .j-sort-buttons{display:flex;gap:4px;flex-wrap:wrap}\n@media(max-width:720px){#jornada .j-flat-row .j-item{flex-wrap:wrap}#jornada .j-flat-row .j-item-text{flex-basis:calc(100% - 50px)}#jornada .j-order{flex-direction:column}#jornada .j-flat-row .j-due{min-width:0;text-align:left}#jornada .j-type-pill{font-size:10px}}";
document.head.appendChild(jornadaStyle);
renderJornada();
