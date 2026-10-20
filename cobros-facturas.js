// Control de cobros y facturación agrupado por cliente.
// Regla operativa: solo los asuntos de tipo "Cobro" generan saldo, pagos y facturación.
(function(){
'use strict';
function start(){
 if(typeof state==='undefined'||typeof save!=='function')return;
 const escF=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const mx=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
 const iso=()=>new Date().toLocaleDateString('en-CA');
 const isCharge=i=>String(i?.type||'').trim().toLocaleLowerCase('es')==='cobro';
 const panel=document.createElement('dialog');
 panel.style.cssText='border:0;border-radius:16px;width:min(96vw,760px);max-height:88vh;overflow:auto;padding:20px';
 document.body.appendChild(panel);
 const button=document.createElement('button');
 button.className='btn';button.textContent='💰 Cobros y facturas';
 button.style.cssText='margin:10px 0 0 8px;background:#fff;color:#0b2c55';
 document.querySelector('.topbar')?.appendChild(button);

 const all=()=>state.clients.flatMap(c=>(c.issues||[]).map(i=>({c,i})));
 const charges=c=>(c.issues||[]).filter(isCharge);
 const fin=i=>i.finanzas||{total:Number(i.total||0),openingPaid:Number(i.paid||0),payments:[],invoice:{needed:'Pendiente de definir',status:'Pendiente',folio:'',issued:'',delivered:''},due:''};
 const sum=f=>Number(f.openingPaid||0)+(f.payments||[]).filter(p=>!p.void).reduce((a,p)=>a+Number(p.amount||0),0);
 const balance=f=>Math.max(0,Number(f.total||0)-sum(f));
 const clientBalance=c=>charges(c).reduce((a,i)=>a+balance(fin(i)),0);
 const clientInvoicePending=c=>charges(c).filter(i=>fin(i).invoice?.needed==='Sí'&&fin(i).invoice?.status!=='Entregada').length;

 function main(){
  const chargeRows=all().filter(({i})=>isCharge(i));
  const due=chargeRows.reduce((a,{i})=>a+balance(fin(i)),0);
  const invoicing=chargeRows.filter(({i})=>fin(i).invoice?.needed==='Sí'&&fin(i).invoice?.status!=='Entregada');
  panel.innerHTML='<div class="row"><h2>💰 Cobros y facturación</h2><button class="btn secondary" id="closeFinance">Cerrar</button></div>'+ 
   '<div class="grid cards"><div class="card"><strong>Por cobrar</strong><div class="metric">'+mx(due)+'</div></div><div class="card"><strong>Facturas por entregar</strong><div class="metric">'+invoicing.length+'</div></div></div>'+ 
   '<p class="muted">Aquí solo cuentan los asuntos marcados como <strong>Cobro</strong>. Cotizaciones, citas, reparaciones e instalaciones son parte del proceso comercial y no generan saldo por sí mismas.</p>'+ 
   '<label>Buscar cliente<input id="financeSearch" placeholder="Nombre o empresa"></label><div id="financeRows"></div>';
  panel.querySelector('#closeFinance').onclick=()=>panel.close();

  const render=()=>{
   const q=panel.querySelector('#financeSearch').value.trim().toLocaleLowerCase('es');
   const clients=state.clients.filter(c=>{
    const haystack=(c.name+' '+(c.company||'')).toLocaleLowerCase('es');
    return charges(c).length&&haystack.includes(q);
   });
   panel.querySelector('#financeRows').innerHTML=clients.map(c=>{
    const count=charges(c).length,bal=clientBalance(c),inv=clientInvoicePending(c);
    return '<div class="card" style="margin:12px 0">'+
      '<strong style="font-size:18px">'+escF(c.name)+'</strong>'+
      (c.company?'<p class="muted" style="margin:4px 0">'+escF(c.company)+'</p>':'')+
      '<p style="margin:10px 0 4px">Saldo pendiente: <strong>'+mx(bal)+'</strong></p>'+
      '<p class="muted" style="margin:0 0 12px">'+count+' cobro(s)'+(inv?' · '+inv+' factura(s) pendiente(s)':'')+'</p>'+
      '<button class="btn secondary" style="width:100%" data-client-fin="'+escF(c.id)+'">Ver cobros y facturas</button></div>';
   }).join('')||'<p class="muted">No hay clientes con cobros.</p>';
   panel.querySelectorAll('[data-client-fin]').forEach(b=>b.onclick=()=>openClientFinance(b.dataset.clientFin));
  };
  panel.querySelector('#financeSearch').oninput=render;render();
  if(!panel.open)panel.showModal();
 }

 function openClientFinance(clientId){
  const c=state.clients.find(x=>String(x.id)===String(clientId));if(!c)return;
  const list=charges(c),bal=clientBalance(c),inv=clientInvoicePending(c);
  const process=(c.issues||[]).filter(i=>!isCharge(i));
  panel.innerHTML='<div class="row"><h2>'+escF(c.name)+'</h2><button class="btn secondary" id="clientFinBack">Volver</button></div>'+ 
   '<div class="card" style="margin-bottom:14px"><strong>Resumen de cobros</strong><p style="margin:8px 0 0">Saldo pendiente: <strong>'+mx(bal)+'</strong></p><p class="muted" style="margin:4px 0 0">'+list.length+' cobro(s)'+(inv?' · '+inv+' factura(s) pendiente(s)':'')+'</p></div>'+ 
   '<div id="clientFinanceIssues">'+list.map(i=>{
     const f=fin(i),paid=sum(f),pending=balance(f);
     return '<div class="card" style="margin:10px 0"><strong>Cobro</strong><p class="muted" style="margin:5px 0">'+escF(i.description||'Sin descripción')+'</p>'+ 
       '<p style="margin:7px 0">Total: <strong>'+mx(f.total||0)+'</strong> · Pagado: <strong>'+mx(paid)+'</strong> · Pendiente: <strong>'+mx(pending)+'</strong></p>'+ 
       '<button class="btn secondary" style="width:100%" data-fin="'+escF(i.id)+'">Registrar pago / factura</button></div>';
   }).join('')+'</div>'+ 
   (process.length?'<details style="margin-top:14px"><summary style="cursor:pointer;font-weight:700">Ver proceso comercial ('+process.length+')</summary><div style="margin-top:8px">'+process.map(i=>'<div class="card" style="margin:8px 0"><strong>'+escF(i.type||'Proceso')+'</strong><p class="muted" style="margin:5px 0">'+escF(i.description||'Sin descripción')+'</p><small class="muted">Sin saldo</small></div>').join('')+'</div></details>':'');
  panel.querySelector('#clientFinBack').onclick=main;
  panel.querySelectorAll('[data-fin]').forEach(b=>b.onclick=()=>edit(b.dataset.fin,clientId));
 }

 function edit(id,clientId){
  const pair=all().find(({i})=>i.id===id&&isCharge(i));if(!pair)return;
  const {c,i}=pair;const f=fin(i),inv=f.invoice||{};
  panel.innerHTML='<div class="row"><h2>'+escF(c.name)+'</h2><button class="btn secondary" id="finBack">Volver</button></div><p class="muted">'+escF(i.description||'Cobro')+'</p>'+ 
  '<div class="card"><h3>Importe del cobro</h3><form id="finTotal"><label>Total a cobrar (MXN)<input name="total" type="number" min="0" step="0.01" required value="'+Number(f.total||0)+'"></label><label>Fecha prometida de pago (opcional)<input name="due" type="date" value="'+escF(f.due||'')+'"></label><label>Motivo del cambio de fecha (si aplica)<input name="reason" placeholder="Ej. Cliente solicitó prórroga"></label><button class="btn" style="margin-top:12px">Guardar importe y fecha</button></form><p>Pagado: <strong>'+mx(sum(f))+'</strong> · Pendiente: <strong>'+mx(balance(f))+'</strong></p></div>'+ 
  '<div class="card"><h3>Registrar pago</h3><form id="finPay"><div class="row"><div class="field"><label>Importe<input type="number" min="0.01" step="0.01" name="amount" required></label></div><div class="field"><label>Fecha<input type="date" name="date" value="'+iso()+'" required></label></div></div><details><summary>Detalles opcionales</summary><label>Medio de pago<input name="method" placeholder="Transferencia, efectivo…"></label><label>Referencia o nota<input name="note"></label></details><button class="btn" style="margin-top:12px">Registrar pago</button></form>'+ 
  (f.openingPaid?'<p class="muted">Pago acumulado del sistema anterior: '+mx(f.openingPaid)+'</p>':'')+
  '<div>'+ (f.payments||[]).map(p=>'<div class="row" style="padding:8px;border-bottom:1px solid #ddd"><span>'+escF(p.date)+' · '+mx(p.amount)+(p.void?' · ANULADO':'')+'</span>'+(p.void?'':'<button class="btn secondary" data-void="'+escF(p.id)+'">Anular</button>')+'</div>').join('')+'</div></div>'+ 
  '<div class="card"><h3>Facturación del cobro</h3><form id="finInvoice"><label>¿Requiere factura?<select name="needed">'+['Pendiente de definir','Sí','No'].map(x=>'<option '+(inv.needed===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Estado<select name="status">'+['Pendiente','Emitida','Entregada','Cancelada'].map(x=>'<option '+(inv.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Folio (opcional)<input name="folio" value="'+escF(inv.folio||'')+'"></label><label>Fecha de emisión<input type="date" name="issued" value="'+escF(inv.issued||'')+'"></label><label>Fecha de entrega<input type="date" name="delivered" value="'+escF(inv.delivered||'')+'"></label><button class="btn" style="margin-top:12px">Guardar factura</button></form></div>';
  panel.querySelector('#finBack').onclick=()=>openClientFinance(clientId||c.id);
  function commit(action,detail){
   i.finanzas=f;i.history=i.history||[];i.history.push({date:new Date().toISOString(),action,detail});save();edit(id,clientId||c.id);
  }
  panel.querySelector('#finTotal').onsubmit=e=>{
   e.preventDefault();const d=new FormData(e.target),total=Number(d.get('total')),due=String(d.get('due')||''),reason=String(d.get('reason')||'').trim();
   if(!Number.isFinite(total)||total<0)return;
   if(total<sum(f)&&!confirm('El total será menor que lo ya pagado. ¿Continuar y revisar el excedente?'))return;
   if(f.due&&f.due!==due&&!reason){alert('Indica el motivo del cambio de fecha prometida.');return;}
   const previous=f.due||'Sin fecha';f.total=total;f.due=due;
   commit('Importe / fecha de cobro','Total: '+total+'; fecha: '+previous+' → '+(due||'Sin fecha')+(reason?'; motivo: '+reason:''));
  };
  panel.querySelector('#finPay').onsubmit=e=>{
   e.preventDefault();const d=new FormData(e.target),amount=Number(d.get('amount'));
   if(!Number.isFinite(amount)||amount<=0)return;
   if(amount>balance(f)&&!confirm('El pago excede el saldo. ¿Registrarlo para revisar el saldo a favor?'))return;
   f.payments=f.payments||[];
   f.payments.push({id:'p'+Date.now()+Math.random().toString(36).slice(2),amount,date:String(d.get('date')),method:String(d.get('method')||''),note:String(d.get('note')||''),void:false});
   commit('Pago registrado',mx(amount)+' · '+String(d.get('date')));
  };
  panel.querySelectorAll('[data-void]').forEach(b=>b.onclick=()=>{
   const p=(f.payments||[]).find(x=>x.id===b.dataset.void);if(!p)return;
   const reason=prompt('Motivo para anular este pago (obligatorio):');if(!reason?.trim())return;
   if(!confirm('¿Anular este pago? Quedará en el historial y ya no contará en el saldo.'))return;
   p.void=true;p.voidReason=reason.trim();commit('Pago anulado',mx(p.amount)+'; motivo: '+reason.trim());
  });
  panel.querySelector('#finInvoice').onsubmit=e=>{
   e.preventDefault();const d=new FormData(e.target);
   f.invoice={needed:String(d.get('needed')),status:String(d.get('status')),folio:String(d.get('folio')||''),issued:String(d.get('issued')||''),delivered:String(d.get('delivered')||'')};
   if(f.invoice.status==='Entregada'&&(!f.invoice.issued||!f.invoice.delivered)){alert('Indica las fechas de emisión y entrega.');return;}
   commit('Facturación actualizada',f.invoice.needed+' · '+f.invoice.status+' · '+f.invoice.folio);
  };
 }
 button.onclick=main;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();