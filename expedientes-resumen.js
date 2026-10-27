if(!ISSUE_TYPES.includes('Primer contacto')) ISSUE_TYPES.unshift('Primer contacto');
if(!ISSUE_TYPES.includes('Visita de cotización')) ISSUE_TYPES.splice(ISSUE_TYPES.indexOf('Cotización'),0,'Visita de cotización');
TYPE_META['Primer contacto']={icon:'👋',color:'#0891b2',bg:'#e6f8fb',ink:'#0e7490'};
TYPE_META['Visita de cotización']={icon:'📍',color:'#ea580c',bg:'#fff1e8',ink:'#c2410c'};

const expedienteStyle=document.createElement('style');
expedienteStyle.textContent=`
#expedientes .client.exr-card{display:block}
.exr-card-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.exr-card-head strong{font-size:17px}.exr-card-head .muted{margin-top:3px}
.exr-contact{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:12px 0}
.exr-field{min-width:0;padding:9px;border-radius:10px;background:#f7f9fc}
.exr-field small{display:block;color:var(--muted);font-size:11px;margin-bottom:4px}
.exr-field strong,.exr-field a{font-size:13px;overflow-wrap:anywhere}
.exr-section-title{font-size:13px;font-weight:850;margin:12px 0 8px}
.exr-service{border:1px solid var(--line);border-left:4px solid var(--type,#2e8bc0);border-radius:12px;padding:12px;margin:8px 0;background:#fff}
.exr-service-head{display:flex;justify-content:space-between;align-items:center;gap:8px}
.exr-service-title{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.exr-details{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}
.exr-copy{font-size:13px;line-height:1.4;margin-top:9px}
.exr-finance{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:8px}
.exr-statuses{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:10px;padding:8px 10px;border-radius:10px;background:#f7f9fc;font-size:12px}
.exr-statuses label{display:flex;gap:6px;align-items:center}.exr-statuses input{width:17px;height:17px;accent-color:#18794e}
.exr-adminnote{display:flex;gap:7px;align-items:flex-end;margin-top:8px}.exr-adminnote textarea{flex:1;min-height:43px;padding:9px;border:1px solid var(--line);border-radius:9px;resize:vertical}
.exr-client-notes{margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.exr-client-notes textarea{width:100%;min-height:56px;padding:10px;border:1px solid var(--line);border-radius:10px;resize:vertical}
.exr-empty{padding:10px;color:var(--muted);background:#f7f9fc;border-radius:10px;font-size:13px}
@media(max-width:760px){.exr-contact{grid-template-columns:repeat(2,minmax(0,1fr))}.exr-details{grid-template-columns:repeat(2,minmax(0,1fr))}.exr-finance{grid-template-columns:1fr}.exr-card-head{display:grid}.exr-adminnote{align-items:stretch;flex-direction:column}.exr-adminnote .btn{align-self:flex-start}}
`;
document.head.appendChild(expedienteStyle);

function exrText(v,empty='—'){return v?esc(v):empty}
function exrMoney(v){return Number(v||0)>0?money(v):'Sin capturar'}
function exrCollection(i){
  const total=Number(i.total||0),paid=Number(i.paid||0);
  if(i.payState==='Pagado'||(total>0&&paid>=total))return 'Pagada en su totalidad';
  if(i.payState==='Pago parcial'||paid>0)return 'Pagada parcialmente';
  if(i.type==='Cobro'||total>0||i.payState)return 'Cuenta por cobrar';
  return 'Sin cobro registrado';
}
function exrService(c,i){
 const meta=TYPE_META[i.type]||{icon:'•'};
 const status=i.invoiced==='Sí'||i.invoiced===true?'Facturada':'Sin facturar';
 const rem=i.remisionada==='Sí'||i.remisionada===true?'Remisionada':'Sin remisión';
 return `<article class="exr-service" style="${typeStyle(i.type)}">
  <div class="exr-service-head"><div class="exr-service-title"><span class="type-label">${meta.icon} ${esc(i.type||'Servicio')}</span><span class="badge">${esc(i.state||'Pendiente')}</span></div><button class="btn sm secondary" onclick="editIssue('${c.id}','${i.id}')">Editar servicio</button></div>
  <div class="exr-details">
   <div class="exr-field"><small>Fecha de solicitud</small><strong>${i.createdDate?fmt(i.createdDate):'Sin fecha'}</strong></div>
   <div class="exr-field"><small>Ventana de tiempo</small><strong>${exrText(i.appointmentWindow)}</strong></div>
   <div class="exr-field"><small>Acción</small><strong>${exrText(i.actionNote||i.nextAction)}</strong></div>
   <div class="exr-field"><small>Fecha de acción</small><strong>${i.actionDate?fmt(i.actionDate):'Sin fecha'}</strong></div>
  </div>
  <div class="exr-copy"><strong>Solicitud / detalle:</strong> ${exrText(i.description)}</div>
  <div class="exr-finance">
   <div class="exr-field"><small>Productos y servicios</small><strong>${exrText(i.productsServices||i.description)}</strong></div>
   <div class="exr-field"><small>Total del servicio</small><strong>${exrMoney(i.total)}</strong></div>
   <div class="exr-field"><small>Cobranza</small><strong>${exrCollection(i)}</strong></div>
  </div>
  <div class="exr-copy"><strong>Notas sobre el cobro:</strong> ${exrText(i.chargeNotes||i.paymentNote)}</div>
  <div class="exr-statuses"><strong>Administrativo:</strong>
   <label><input type="checkbox" ${status==='Facturada'?'checked':''} onchange="exrSetIssue('${c.id}','${i.id}','invoiced',this.checked)"> Facturada</label>
   <label><input type="checkbox" ${i.remisionada==='Sí'||i.remisionada===true?'checked':''} onchange="exrSetIssue('${c.id}','${i.id}','remisionada',this.checked)"> Remisionada</label>
   <span class="badge ${status==='Facturada'?'green':''}">${status}</span><span class="badge ${rem==='Remisionada'?'blue':''}">${rem}</span>
  </div>
  <div class="exr-adminnote"><label class="field" style="flex:1"><span>Nota interna administrativa</span><textarea id="exr-admin-${i.id}" placeholder="Nota breve">${esc(i.adminNote||'')}</textarea></label><button class="btn sm secondary" onclick="exrSaveAdminNote('${c.id}','${i.id}')">✓ Guardar nota</button></div>
 </article>`
}
function exrCardMarkup(c){
 const active=(c.issues||[]).filter(i=>i.active!==false&&!['Terminado','Cancelado'].includes(i.state));
 const wa=String(c.whatsapp||'').replace(/[^\d]/g,'');
 return `<div class="exr-card-head"><div><strong>${esc(c.name||'Sin nombre')}</strong><div class="muted">${esc(c.company||'Sin empresa')}</div></div><div class="split-actions"><button class="btn sm" onclick="openClient('${c.id}')">Abrir / editar</button><button class="btn sm danger" onclick="deleteClient('${c.id}')">Borrar</button></div></div>
 <div class="exr-contact">
  <div class="exr-field"><small>Contacto</small><strong>${exrText(c.contact)}</strong></div>
  <div class="exr-field"><small>Empresa</small><strong>${exrText(c.company)}</strong></div>
  <div class="exr-field"><small>WhatsApp</small>${wa?'<a target="_blank" rel="noopener" href="https://wa.me/'+wa+'">'+esc(c.whatsapp)+'</a>':'<strong>—</strong>'}</div>
  <div class="exr-field"><small>Dirección</small><strong>${exrText(c.address)}</strong></div>
 </div>
 <div class="exr-section-title">Servicios activos · ${active.length}</div>
 ${active.length?active.map(i=>exrService(c,i)).join(''):'<div class="exr-empty">No hay servicios activos en este expediente.</div>'}
 <div class="exr-client-notes"><label class="field"><span>Notas internas del expediente</span><textarea id="exr-client-${c.id}" placeholder="Escribe una nota interna sobre este cliente">${esc(c.internalNotes||'')}</textarea></label><div class="toolbar" style="margin:7px 0 0"><button class="btn sm secondary" onclick="exrSaveClientNote('${c.id}')">✓ Guardar nota interna</button></div></div>`
}
function exrEnhanceCards(){
 const cards=document.querySelectorAll('#expedientes .list .card.client');
 cards.forEach(card=>{
  const open=card.querySelector('button[onclick^="openClient("]');
  const match=open?.getAttribute('onclick')?.match(/openClient\('([^']+)'\)/);
  const c=match&&state.clients.find(x=>x.id===match[1]); if(!c)return;
  card.classList.add('exr-card');card.innerHTML=exrCardMarkup(c);
 });
}
const exrBaseRenderClients=renderClients;
renderClients=function(q=''){exrBaseRenderClients(q);exrEnhanceCards()};
function exrSetIssue(cid,iid,key,checked){
 const c=state.clients.find(x=>x.id===cid),i=c?.issues?.find(x=>x.id===iid);if(!i)return;
 i[key]=checked?'Sí':'No';save();
}
function exrSaveAdminNote(cid,iid){
 const c=state.clients.find(x=>x.id===cid),i=c?.issues?.find(x=>x.id===iid);if(!i)return;
 i.adminNote=document.getElementById('exr-admin-'+iid)?.value||'';save();
}
function exrSaveClientNote(cid){
 const c=state.clients.find(x=>x.id===cid);if(!c)return;
 c.internalNotes=document.getElementById('exr-client-'+cid)?.value||'';
 try{save();}catch(e){alert('No se pudo guardar la nota. Intenta de nuevo.')}
}
renderClients(document.getElementById('clientSearch')?.value||'');
