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