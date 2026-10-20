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
      (items.map(({c,i})=>'<div class="card" style="margin:10px 0"><strong>'+ehtml(c.name)+'</strong><p>'+ehtml(i.serviceAddress||c.address||'Dirección pendiente')+'</p><p>'+ehtml(i.description||'Trabajo por confirmar')+'</p><p class="muted">Disponibilidad del cliente: '+ehtml(i.appointmentWindow||'No indicada')+'</p><p><strong>'+ehtml(i.appointmentConfirmation)+'</strong></p><button class="btn secondary" data-coordinate="'+ehtml(i.id)+'">Coordinar cita</button></div>').join('')||'<p>No hay citas pendientes de confirmación.</p>');
      coordination.querySelector('#coordClose').onclick=()=>coordination.close();
      coordination.querySelectorAll('[data-coordinate]').forEach(b=>b.onclick=()=>editCoordination(b.dataset.coordinate));
      if(!coordination.open)coordination.showModal();
    }
    function editCoordination(id){
      const found=pending().find(x=>x.i.id===id);if(!found)return;
      const {c,i}=found;
      coordination.innerHTML='<h2>Coordinar cita</h2><p><strong>'+ehtml(c.name)+'</strong> · '+ehtml(i.serviceAddress||c.address||'')+'</p><p class="muted">'+ehtml(i.description||'Trabajo por confirmar')+'</p><form id="coordForm">'+
      '<label>Etapa<select name="stage"><option value="Pendiente de coordinar">Consultar con el jefe</option><option value="Disponibilidad autorizada; falta confirmar cliente">Jefe dio disponibilidad; falta confirmar cliente</option><option value="Confirmada">Cliente confirmó la cita</option></select></label>'+
      '<label>Fecha propuesta / confirmada<input type="date" name="date" value="'+ehtml(i.proposedAppointmentDate||i.appointmentDate||'')+'"></label>'+
      '<label>Horario concreto<input name="time" placeholder="Ej. 12:00 a 16:00" value="'+ehtml(i.proposedAppointmentWindow||'')+'"></label>'+
      '<label>Persona que recibirá (opcional)<input name="receiver" value="'+ehtml(i.appointmentReceiver||'')+'"></label>'+
      '<label>Nota (opcional)<textarea name="note">'+ehtml(i.appointmentNote||'')+'</textarea></label>'+
      '<div class="toolbar" style="margin-top:15px"><button class="btn" type="submit">Guardar</button><button type="button" class="btn secondary" id="coordBack">Volver</button></div></form>';
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