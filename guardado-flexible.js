// SIMOUN · guardado flexible de expedientes y asuntos incompletos.
// Regla: si hay algo que registrar, se guarda aunque falten campos; después se completa.
(function(){
'use strict';
if(window.__simounFlexibleSave)return;
window.__simounFlexibleSave=true;

const FLEX_FORMS=new Set(['clientForm','issueForm','quickIntakeForm','opClientForm','opIssueForm','opWorkReportForm']);

function relax(root=document){
  FLEX_FORMS.forEach(id=>{
    const form=root.querySelector?.('#'+id) || (root.id===id?root:null);
    if(!form)return;
    form.noValidate=true;
    form.querySelectorAll('[required]').forEach(el=>el.removeAttribute('required'));
  });
}

// Los formularios se crean dentro de diálogos; solo observamos altas/bajas de nodos.
// Quitar "required" no vuelve a disparar este observador.
const observer=new MutationObserver(records=>{
  for(const r of records){
    for(const n of r.addedNodes){if(n.nodeType===1)relax(n)}
  }
});
function start(){relax(document);observer.observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();

function blankClientSafe(){
  return typeof blankClient==='function'?blankClient():{id:'c'+Date.now()+Math.random().toString(36).slice(2),name:'',contact:'',company:'',address:'',phone:'',whatsapp:'',notes:'',billing:'',issues:[],docs:[]};
}
function blankIssueSafe(){
  return typeof blankIssue==='function'?blankIssue():{id:'i'+Date.now()+Math.random().toString(36).slice(2),type:'Seguimiento',state:'Pendiente',description:'',notes:'',createdDate:typeof today==='function'?today():'',active:true,history:[]};
}
function existingByName(name){
  if(!name)return[];
  const q=name.toLocaleLowerCase('es');
  return (state?.clients||[]).filter(c=>String(c.name||'').trim().toLocaleLowerCase('es')===q);
}
function makeQuickIssue(f,address){
  const issue=blankIssueSafe();
  issue.type=String(f.get('tipo')||'Seguimiento');
  issue.state=issue.state||'Pendiente';
  issue.description=String(f.get('motivo')||'').trim();
  issue.notes=String(f.get('nota')||'').trim();
  issue.appointmentWindow=String(f.get('horario')||'').trim();
  issue.clientAvailability=issue.appointmentWindow;
  issue.serviceAddress=address;
  issue.appointmentConfirmation='Pendiente de coordinar';
  issue.history=Array.isArray(issue.history)?issue.history:[];
  issue.history.push({date:new Date().toISOString(),action:'Solicitud rápida registrada',detail:address?'Dirección: '+address:'Información pendiente de completar'});
  return issue;
}

// Si el técnico/jefe solo marca el estado y deja la nota vacía, conserva también ese reporte.
document.addEventListener('submit',e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='opWorkReportForm')return;
  const note=form.elements?.note;
  if(note&&!String(note.value||'').trim())note.value='Sin nota';
},true);

// Sustituye únicamente el guardado de Solicitud rápida para permitir registros parciales.
document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement)||form.id!=='quickIntakeForm')return;
  e.preventDefault();
  e.stopImmediatePropagation();

  const f=new FormData(form);
  const name=String(f.get('cliente')||'').trim();
  const whatsapp=String(f.get('whatsapp')||'').trim();
  const address=String(f.get('direccion')||'').trim();
  const matches=existingByName(name);
  if(matches.length>1){
    alert('Hay varios clientes con ese nombre. Selecciona el correcto desde Expedientes para evitar duplicados.');
    return;
  }

  const operative=window.SimounSync?.isOperative?.()===true;
  let client=matches[0]||null;
  try{
    if(!client){
      client=blankClientSafe();
      client.name=name;
      client.address=address;
      client.whatsapp=whatsapp;
      client.issues=client.issues||[];
      client.docs=client.docs||[];
      if(operative)await window.SimounSync.createClient(client);
      else state.clients.unshift(client);
    }else if(!operative){
      if(whatsapp&&!String(client.whatsapp||'').trim())client.whatsapp=whatsapp;
      if(address&&!String(client.address||'').trim())client.address=address;
    }

    const issue=makeQuickIssue(f,address);
    if(operative)await window.SimounSync.createIssue(client.id,issue);
    else{
      client.issues=client.issues||[];
      client.issues.unshift(issue);
      save();
    }

    form.closest('dialog')?.close();
    form.reset();
    if(typeof renderAll==='function')renderAll();
    alert('Guardado. Puedes completar los datos después.');
    if(typeof openClient==='function')openClient(client.id);
  }catch(err){
    alert('No se pudo guardar: '+String(err?.message||err));
  }
},true);
})();
