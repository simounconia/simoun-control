// SIMOUN · Cobros y facturación
// Un cliente = un saldo final. El resto del proceso comercial no aparece como cargo.
(function(){
'use strict';
function start(){
  if(typeof state==='undefined'||typeof save!=='function')return;

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const mx=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
  const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
  const isLegacyCharge=i=>String(i?.type||'').trim().toLocaleLowerCase('es')==='cobro';

  const panel=document.createElement('dialog');
  panel.id='financePanel';
  panel.style.cssText='border:0;border-radius:18px;width:min(96vw,720px);max-height:90vh;overflow:auto;padding:18px;background:#fff';
  document.body.appendChild(panel);

  const button=document.createElement('button');
  button.className='btn';button.textContent='💰 Cobros y facturas';
  button.style.cssText='margin:10px 0 0 8px;background:#fff;color:#0b2c55';
  document.querySelector('.topbar')?.appendChild(button);

  function stylePanel(){
    panel.querySelectorAll('form').forEach(f=>{f.style.display='grid';f.style.gap='16px'});
    panel.querySelectorAll('label').forEach(l=>{l.style.display='grid';l.style.gap='7px';l.style.fontWeight='700';l.style.color='#243a55'});
    panel.querySelectorAll('input,select,textarea').forEach(el=>{el.style.cssText='display:block;width:100%;box-sizing:border-box;min-height:46px;padding:11px 12px;border:1px solid #c9d5e2;border-radius:10px;background:#fff;color:#10233f;font:inherit;font-weight:400'});
    panel.querySelectorAll('textarea').forEach(el=>{el.style.minHeight='86px';el.style.resize='vertical'});
    panel.querySelectorAll('.card').forEach(c=>{c.style.marginBottom='14px'});
    panel.querySelectorAll('h2,h3').forEach(h=>{h.style.marginTop='0'});
    panel.querySelectorAll('details').forEach(d=>{d.style.marginTop='8px'});
  }

  function legacyBalance(c){
    return (c.issues||[]).filter(isLegacyCharge).reduce((acc,i)=>{
      const f=i.finanzas||{};
      const total=Number(f.total??i.total??0);
      const opening=Number(f.openingPaid??i.paid??0);
      const payments=(f.payments||[]).filter(p=>!p.void).reduce((s,p)=>s+Number(p.amount||0),0);
      return acc+Math.max(0,total-opening-payments);
    },0);
  }

  function account(c){
    const old=c.finanzasCliente||{};
    if(old.version===3){
      old.saldo=Math.max(0,Number(old.saldo||0));
      old.notes=String(old.notes||'');
      old.due=String(old.due||'');
      old.payments=Array.isArray(old.payments)?old.payments:[];
      old.invoice=old.invoice||{needed:'Pendiente de definir',status:'Pendiente',folio:'',issued:'',delivered:''};
      return old;
    }
    let saldo=Number(old.saldo||0);
    if(!saldo)saldo=legacyBalance(c);
    if(!saldo&&Number(old.total||0)>0){
      const paid=Number(old.openingPaid||0)+(old.payments||[]).filter(p=>!p.void).reduce((s,p)=>s+Number(p.amount||0),0);
      saldo=Math.max(0,Number(old.total||0)-paid);
    }
    return {version:3,saldo,due:String(old.due||''),notes:String(old.notes||''),payments:Array.isArray(old.payments)?old.payments:[],invoice:old.invoice||{needed:'Pendiente de definir',status:'Pendiente',folio:'',issued:'',delivered:''}};
  }

  function persist(c,a,action,detail){
    c.finanzasCliente=a;c.history=c.history||[];
    c.history.push({date:new Date().toISOString(),action,detail});
    save();
  }
  const active=c=>{const a=account(c),i=a.invoice||{};return Number(a.saldo)>0||a.payments.length>0||!!a.notes||i.needed==='Sí'||i.status==='Emitida'||i.status==='Entregada'};

  function main(){
    const clients=state.clients||[];
    const total=clients.reduce((s,c)=>s+Number(account(c).saldo||0),0);
    const invoicePending=clients.filter(c=>{const i=account(c).invoice||{};return i.needed==='Sí'&&i.status!=='Entregada'&&i.status!=='Cancelada'}).length;
    panel.innerHTML='<div class="row"><h2>💰 Cobros y facturación</h2><button class="btn secondary" id="closeFinance">Cerrar</button></div>'+ 
      '<div class="grid cards"><div class="card"><strong>Por cobrar</strong><div class="metric">'+mx(total)+'</div></div><div class="card"><strong>Facturas pendientes</strong><div class="metric">'+invoicePending+'</div></div></div>'+ 
      '<p class="muted">Un solo saldo por cliente. Cotizaciones, reparaciones, instalaciones y demás pasos no aparecen aquí como cargos.</p>'+ 
      '<label>Buscar cliente<input id="financeSearch" placeholder="Nombre o empresa"></label><div id="financeRows"></div>';
    stylePanel();
    panel.querySelector('#closeFinance').onclick=()=>panel.close();
    const render=()=>{
      const q=panel.querySelector('#financeSearch').value.trim().toLocaleLowerCase('es');
      let rows=clients.filter(c=>(String(c.name||'')+' '+String(c.company||'')).toLocaleLowerCase('es').includes(q));
      if(!q)rows=rows.filter(active);
      panel.querySelector('#financeRows').innerHTML=rows.map(c=>{const a=account(c);return '<div class="card" style="margin:12px 0"><strong style="font-size:18px">'+esc(c.name||'Cliente')+'</strong>'+(c.company?'<p class="muted">'+esc(c.company)+'</p>':'')+'<p style="font-size:20px">Saldo: <strong>'+mx(a.saldo)+'</strong></p><button class="btn secondary" style="width:100%" data-client-fin="'+esc(c.id)+'">Abrir cuenta</button></div>'}).join('')||'<p class="muted">'+(q?'No encontré ese cliente.':'No hay saldos pendientes. Busca un cliente para iniciar un cobro.')+'</p>';
      panel.querySelectorAll('[data-client-fin]').forEach(b=>b.onclick=()=>openClient(b.dataset.clientFin));
    };
    panel.querySelector('#financeSearch').oninput=render;render();
    if(!panel.open)panel.showModal();
  }

  function openClient(id){
    const c=(state.clients||[]).find(x=>String(x.id)===String(id));if(!c)return;
    const a=account(c),inv=a.invoice||{};
    panel.innerHTML='<div class="row"><h2>'+esc(c.name||'Cliente')+'</h2><button class="btn secondary" id="finBack">Volver</button></div>'+ 
      '<div class="card" style="text-align:center"><div class="muted">Saldo pendiente del cliente</div><div class="metric" style="font-size:38px">'+mx(a.saldo)+'</div></div>'+ 
      '<div class="card"><h3>Saldo y notas</h3><form id="balanceForm">'+ 
        '<label>Saldo pendiente actual (MXN)<input name="saldo" type="number" min="0" step="0.01" required value="'+Number(a.saldo||0)+'"></label>'+ 
        '<label>Fecha prometida de pago (opcional)<input name="due" type="date" value="'+esc(a.due||'')+'"></label>'+ 
        '<label>Notas<textarea name="notes" placeholder="Ej. reparación de cámara, anticipo, referencia de cotización…">'+esc(a.notes||'')+'</textarea></label>'+ 
        '<button class="btn">Guardar saldo y notas</button></form></div>'+ 
      '<div class="card"><h3>Registrar pago</h3><form id="paymentForm">'+ 
        '<label>Importe<input type="number" name="amount" min="0.01" step="0.01" required></label>'+ 
        '<label>Fecha<input type="date" name="date" value="'+today()+'" required></label>'+ 
        '<details><summary>Detalles opcionales</summary><div style="display:grid;gap:14px;margin-top:12px"><label>Medio de pago<input name="method" placeholder="Transferencia, efectivo…"></label><label>Nota<input name="note"></label></div></details>'+ 
        '<button class="btn">Registrar pago</button></form>'+ 
        '<details><summary style="cursor:pointer;font-weight:700">Historial de pagos</summary><div>'+a.payments.map(p=>'<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid #ddd"><span>'+esc(p.date||'')+' · '+mx(p.amount)+(p.void?' · ANULADO':'')+'</span>'+(p.void?'':'<button class="btn secondary" data-void="'+esc(p.id)+'">Anular</button>')+'</div>').join('')+'</div></details></div>'+ 
      '<div class="card"><details><summary style="cursor:pointer;font-size:20px;font-weight:800">Factura</summary><form id="invoiceForm" style="margin-top:14px">'+ 
        '<label>¿Requiere factura?<select name="needed">'+['Pendiente de definir','Sí','No'].map(x=>'<option '+(inv.needed===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+ 
        '<label>Estado<select name="status">'+['Pendiente','Emitida','Entregada','Cancelada'].map(x=>'<option '+(inv.status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+ 
        '<label>Folio (opcional)<input name="folio" value="'+esc(inv.folio||'')+'"></label>'+ 
        '<label>Fecha de emisión<input type="date" name="issued" value="'+esc(inv.issued||'')+'"></label>'+ 
        '<label>Fecha de entrega<input type="date" name="delivered" value="'+esc(inv.delivered||'')+'"></label>'+ 
        '<button class="btn">Guardar factura</button></form></details></div>';
    stylePanel();
    panel.querySelector('#finBack').onclick=main;
    panel.querySelector('#balanceForm').onsubmit=e=>{e.preventDefault();const d=new FormData(e.currentTarget),saldo=Number(d.get('saldo'));if(!Number.isFinite(saldo)||saldo<0)return;a.version=3;a.saldo=saldo;a.due=String(d.get('due')||'');a.notes=String(d.get('notes')||'').trim();persist(c,a,'Saldo actualizado','Saldo pendiente: '+mx(saldo));openClient(id)};
    panel.querySelector('#paymentForm').onsubmit=e=>{e.preventDefault();const d=new FormData(e.currentTarget),amount=Number(d.get('amount'));if(!Number.isFinite(amount)||amount<=0)return;if(amount>Number(a.saldo||0)){alert('El pago es mayor que el saldo actual. Primero corrige el saldo del cliente.');return}a.payments.push({id:'p'+Date.now()+Math.random().toString(36).slice(2),amount,date:String(d.get('date')||today()),method:String(d.get('method')||''),note:String(d.get('note')||''),void:false});a.saldo=Math.max(0,Number(a.saldo)-amount);persist(c,a,'Pago registrado',mx(amount)+' · saldo restante '+mx(a.saldo));openClient(id)};
    panel.querySelectorAll('[data-void]').forEach(b=>b.onclick=()=>{const p=a.payments.find(x=>String(x.id)===String(b.dataset.void));if(!p||p.void)return;const reason=prompt('Motivo para anular este pago:');if(!reason?.trim())return;if(!confirm('¿Anular este pago? El importe volverá al saldo pendiente.'))return;p.void=true;p.voidReason=reason.trim();a.saldo=Number(a.saldo||0)+Number(p.amount||0);persist(c,a,'Pago anulado',mx(p.amount)+' · '+reason.trim());openClient(id)});
    panel.querySelector('#invoiceForm').onsubmit=e=>{e.preventDefault();const d=new FormData(e.currentTarget);a.invoice={needed:String(d.get('needed')),status:String(d.get('status')),folio:String(d.get('folio')||''),issued:String(d.get('issued')||''),delivered:String(d.get('delivered')||'')};if(a.invoice.status==='Entregada'&&(!a.invoice.issued||!a.invoice.delivered)){alert('Indica las fechas de emisión y entrega.');return}persist(c,a,'Facturación actualizada',a.invoice.needed+' · '+a.invoice.status);openClient(id)};
  }

  button.onclick=main;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();