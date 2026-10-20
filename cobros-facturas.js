// Control de cobros y facturación por cliente.
// Regla operativa: en este módulo solo existe el saldo final del cliente.
// Cotizaciones, reparaciones, instalaciones y otros procesos NO aparecen aquí.
(function(){
'use strict';
function start(){
 if(typeof state==='undefined'||typeof save!=='function')return;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
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

 const legacyCharges=c=>(c.issues||[]).filter(isCharge);
 const legacyFin=i=>i.finanzas||{total:Number(i.total||0),openingPaid:Number(i.paid||0),payments:[],invoice:{needed:'Pendiente de definir',status:'Pendiente',folio:'',issued:'',delivered:''},due:''};

 function account(c){
   if(!c.finanzasCliente){
     c.finanzasCliente={total:0,openingPaid:0,payments:[],invoice:{needed:'Pendiente de definir',status:'Pendiente',folio:'',issued:'',delivered:''},due:'',notes:'',linkedChargeIds:[]};
   }
   const a=c.finanzasCliente;
   a.payments=Array.isArray(a.payments)?a.payments:[];
   a.linkedChargeIds=Array.isArray(a.linkedChargeIds)?a.linkedChargeIds:[];
   a.invoice=a.invoice||{needed:'Pendiente de definir',status:'Pendiente',folio:'',issued:'',delivered:''};
   legacyCharges(c).forEach(i=>{
     if(a.linkedChargeIds.includes(i.id))return;
     const f=legacyFin(i);
     a.total+=Number(f.total||i.total||0);
     a.openingPaid+=Number(f.openingPaid||i.paid||0);
     (f.payments||[]).forEach(p=>a.payments.push({...p,id:'legacy-'+i.id+'-'+(p.id||Date.now())}));
     if(f.invoice?.needed==='Sí')a.invoice={...a.invoice,...f.invoice};
     if(f.due&&!a.due)a.due=f.due;
     if(i.description&&!a.notes)a.notes=i.description;
     a.linkedChargeIds.push(i.id);
   });
   return a;
 }
 const paid=a=>Number(a.openingPaid||0)+(a.payments||[]).filter(p=>!p.void).reduce((s,p)=>s+Number(p.amount||0),0);
 const balance=a=>Math.max(0,Number(a.total||0)-paid(a));
 const hasFinance=c=>legacyCharges(c).length||Number(c.finanzasCliente?.total||0)>0||(c.finanzasCliente?.payments||[]).length;

 function main(){
   const clients=state.clients.filter(hasFinance);
   const total=clients.reduce((s,c)=>s+balance(account(c)),0);
   const invoices=clients.filter(c=>{const i=account(c).invoice;return i?.needed==='Sí'&&i?.status!=='Entregada'}).length;
   panel.innerHTML='<div class="row"><h2>💰 Cobros y facturación</h2><button class="btn secondary" id="closeFinance">Cerrar</button></div>'+ 
    '<div class="grid cards"><div class="card"><strong>Por cobrar</strong><div class="metric">'+mx(total)+'</div></div><div class="card"><strong>Facturas por entregar</strong><div class="metric">'+invoices+'</div></div></div>'+ 
    '<p class="muted">Un solo saldo por cliente. Los demás procesos de venta no aparecen en este módulo.</p>'+ 
    '<label>Buscar cliente<input id="financeSearch" placeholder="Nombre o empresa"></label><div id="financeRows"></div>';
   panel.querySelector('#closeFinance').onclick=()=>panel.close();
   const render=()=>{
     const q=panel.querySelector('#financeSearch').value.trim().toLocaleLowerCase('es');
     const rows=state.clients.filter(c=>hasFinance(c)&&((c.name+' '+(c.company||'')).toLocaleLowerCase('es').includes(q)));
     panel.querySelector('#financeRows').innerHTML=rows.map(c=>{
       const a=account(c);
       return '<div class="card" style="margin:12px 0"><strong style="font-size:18px">'+esc(c.name)+'</strong>'+
        (c.company?'<p class="muted" style="margin:4px 0">'+esc(c.company)+'</p>':'')+
        '<p style="margin:12px 0;font-size:20px">Saldo: <strong>'+mx(balance(a))+'</strong></p>'+ 
        '<button class="btn secondary" style="width:100%" data-client-fin="'+esc(c.id)+'">Abrir cobro</button></div>';
     }).join('')||'<p class="muted">No hay clientes con saldo registrado.</p>';
     panel.querySelectorAll('[data-client-fin]').forEach(b=>b.onclick=()=>openClientFinance(b.dataset.clientFin));
   };
   panel.querySelector('#financeSearch').oninput=render;render();
   if(!panel.open)panel.showModal();
 }

 function openClientFinance(clientId){
   const c=state.clients.find(x=>String(x.id)===String(clientId));if(!c)return;
   const a=account(c),inv=a.invoice||{};
   panel.innerHTML='<div class="row"><h2>'+esc(c.name)+'</h2><button class="btn secondary" id="clientFinBack">Volver</button></div>'+ 
    '<div class="card" style="margin-bottom:14px;text-align:center"><div class="muted">Saldo final del cliente</div><div class="metric" style="font-size:36px">'+mx(balance(a))+'</div></div>'+ 
    '<div class="card"><h3>Actualizar saldo</h3><form id="finTotal"><label>Total acordado (MXN)<input name="total" type="number" min="0" step="0.01" required value="'+Number(a.total||0)+'"></label><label>Fecha prometida de pago (opcional)<input name="due" type="date" value="'+esc(a.due||'')+'"></label><label>Notas<textarea name="notes" placeholder="Aquí puedes anotar concepto, cotización, trabajo realizado, referencia, etc.">'+esc(a.notes||'')+'</textarea></label><button class="btn" style="margin-top:12px">Guardar</button></form></div>'+ 
    '<div class="card"><h3>Registrar pago</h3><form id="finPay"><div class="row"><div class="field"><label>Importe<input type="number" min="0.01" step="0.01" name="amount" required></label></div><div class="field"><label>Fecha<input type="date" name="date" value="'+iso()+'" required></label></div></div><details><summary>Detalles opcionales</summary><label>Medio de pago<input name="method" placeholder="Transferencia, efectivo…"></label><label>Referencia o nota<input name="note"></label></details><button class="btn" style="margin-top:12px">Registrar pago</button></form>'+ 
    '<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700">Historial de pagos</summary><div>'+ (a.payments||[]).map(p=>'<div class="row" style="padding:8px;border-bottom:1px solid #ddd"><span>'+esc(p.date)+' · '+mx(p.amount)+(p.void?' · ANULADO':'')+'</span>'+(p.void?'':'<button class="btn secondary" data-void="'+esc(p.id)+'">Anular</button>')+'</div>').join('')+'</div></details></div>'+ 
    '<div class="card"><h3>Factura</h3><form id="finInvoice"><label>¿Requiere factura?<select name="needed">'+['Pendiente de definir','Sí','No'].map(x=>'<option '+(inv.needed===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Estado<select name="status">'+['Pendiente','Emitida','Entregada','Cancelada'].map(x=>'<option '+(inv.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><label>Folio (opcional)<input name="folio" value="'+esc(inv.folio||'')+'"></label><label>Fecha de emisión<input type="date" name="issued" value="'+esc(inv.issued||'')+'"></label><label>Fecha de entrega<input type="date" name="delivered" value="'+esc(inv.delivered||'')+'"></label><button class="btn" style="margin-top:12px">Guardar factura</button></form></div>';
   panel.querySelector('#clientFinBack').onclick=main;
   function commit(action,detail){
     c.finanzasCliente=a;c.history=c.history||[];c.history.push({date:new Date().toISOString(),action,detail});save();openClientFinance(clientId);
   }
   panel.querySelector('#finTotal').onsubmit=e=>{
     e.preventDefault();const d=new FormData(e.target),total=Number(d.get('total'));
     if(!Number.isFinite(total)||total<0)return;
     if(total<paid(a)&&!confirm('El total será menor que lo ya pagado. ¿Continuar?'))return;
     a.total=total;a.due=String(d.get('due')||'');a.notes=String(d.get('notes')||'').trim();
     commit('Saldo del cliente actualizado','Total: '+mx(total));
   };
   panel.querySelector('#finPay').onsubmit=e=>{
     e.preventDefault();const d=new FormData(e.target),amount=Number(d.get('amount'));
     if(!Number.isFinite(amount)||amount<=0)return;
     if(amount>balance(a)&&!confirm('El pago excede el saldo. ¿Registrarlo de todos modos?'))return;
     a.payments.push({id:'p'+Date.now()+Math.random().toString(36).slice(2),amount,date:String(d.get('date')),method:String(d.get('method')||''),note:String(d.get('note')||''),void:false});
     commit('Pago registrado',mx(amount)+' · '+String(d.get('date')));
   };
   panel.querySelectorAll('[data-void]').forEach(b=>b.onclick=()=>{
     const p=(a.payments||[]).find(x=>x.id===b.dataset.void);if(!p)return;
     const reason=prompt('Motivo para anular este pago:');if(!reason?.trim())return;
     if(!confirm('¿Anular este pago?'))return;
     p.void=true;p.voidReason=reason.trim();commit('Pago anulado',mx(p.amount)+'; motivo: '+reason.trim());
   });
   panel.querySelector('#finInvoice').onsubmit=e=>{
     e.preventDefault();const d=new FormData(e.target);
     a.invoice={needed:String(d.get('needed')),status:String(d.get('status')),folio:String(d.get('folio')||''),issued:String(d.get('issued')||''),delivered:String(d.get('delivered')||'')};
     if(a.invoice.status==='Entregada'&&(!a.invoice.issued||!a.invoice.delivered)){alert('Indica las fechas de emisión y entrega.');return;}
     commit('Facturación actualizada',a.invoice.needed+' · '+a.invoice.status+' · '+a.invoice.folio);
   };
 }
 button.onclick=main;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();