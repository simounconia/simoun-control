/* Recibos de pago SIMOUN: comprobantes imprimibles sin firma. */
function receiptStore(){
  state.commercialDocs ||= {};
  state.commercialDocs.receipts ||= [];
  state.commercialDocs.receiptCounter ||= 0;
  return state.commercialDocs;
}
function receiptNextFolio(){
  const docs=receiptStore(),year=new Date().getFullYear();
  const max=docs.receipts.reduce((m,d)=>{
    const hit=String(d.folio||'').match(/^REC-(\d{4})-(\d+)$/);
    return hit&&Number(hit[1])===year?Math.max(m,Number(hit[2])):m;
  },0);
  return 'REC-'+year+'-'+String(Math.max(docs.receiptCounter||0,max)+1).padStart(4,'0');
}
function receiptFileName(d){
  const clean=s=>String(s||'').normalize('NFC').replace(/[^\p{L}\p{N} ._-]/gu,'').replace(/\s+/g,' ').trim().slice(0,100);
  return clean(d.folio)+' - '+(clean(d.clientName)||'Sin cliente')+' - SIMOUN';
}
function receiptForm(d){
 const edit=!!d,client=d||{},date=docDate();
 const field=(name,title,value,type='text',required='')=>'<label class="field"><span>'+title+'</span><input name="'+name+'" type="'+type+'" value="'+esc(value??'')+'" '+required+'></label>';
 return '<form class="doc-form" onsubmit="receiptSave(event,'+(edit?("'"+d.id+"'"):'null')+')">'+
 '<div class="doc-form-title"><h2>'+(edit?'Editar recibo':'Nuevo recibo de pago')+'</h2><span class="badge blue">'+esc(d?.folio||receiptNextFolio())+'</span></div>'+
 '<div class="row">'+field('date','Fecha del recibo',client.date||date,'date','required')+field('paymentDate','Fecha del pago',client.paymentDate||date,'date','required')+'</div>'+
 '<label class="field"><span>Cliente registrado (opcional)</span><select onchange="receiptFillClient(this)"><option value="">Capturar manualmente</option>'+
 (state.clients||[]).map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name||'Sin nombre')+'</option>').join('')+'</select></label>'+
 '<div class="row">'+field('clientName','Nombre del cliente',client.clientName,'text','required')+field('clientAddress','Dirección',client.clientAddress)+'</div>'+
 '<div class="row">'+field('clientWhatsApp','WhatsApp',client.clientWhatsApp,'tel')+field('amount','Importe recibido ($ MXN)',client.amount??'','number','required')+'</div>'+
 '<label class="field"><span>Concepto del pago</span><textarea name="concept" required placeholder="Ej. Anticipo por instalación de 5 cámaras con 1 disco duro de 2 TB">'+esc(client.concept||'')+'</textarea></label>'+
 '<div class="row">'+field('balance','Saldo pendiente ($ MXN)',client.balance??0,'number','required')+
 '<label class="field"><span>Tipo de pago</span><select name="paymentType">'+['Anticipo','Abono','Liquidación','Pago total','Otro'].map(t=>'<option '+((client.paymentType||'Anticipo')===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label></div>'+
 '<div class="row"><label class="field"><span>Forma de pago</span><select name="paymentMethod">'+['No especificada','Efectivo','Transferencia','Depósito','Tarjeta','Otra'].map(t=>'<option '+((client.paymentMethod||'No especificada')===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
 '<label class="field"><span>Referencia (opcional)</span><input name="reference" value="'+esc(client.reference||'')+'"></label></div>'+
 '<label class="field"><span>Condiciones o aclaraciones visibles</span><textarea name="terms" placeholder="Ej. El saldo restante se pagará al terminar el trabajo.">'+esc(client.terms??'')+'</textarea></label>'+
 '<div class="toolbar"><button class="btn" type="submit">'+(edit?'Guardar cambios':'Guardar recibo y asignar folio')+'</button>'+
 (edit?'<button class="btn secondary" type="button" onclick="receiptCancelEdit()">Cancelar edición</button>':'')+'</div></form>';
}
function receiptFillClient(select){
 const c=(state.clients||[]).find(x=>x.id===select.value);
 if(!c)return;
 const form=select.closest('form');form.elements.clientName.value=c.name||c.company||'';
 form.elements.clientAddress.value=c.address||'';
 form.elements.clientWhatsApp.value=c.whatsapp||c.phone||'';
}
let receiptEditingId=null;
function receiptRender(){
 const root=document.getElementById('recibos');if(!root)return;
 const docs=receiptStore(),d=docs.receipts.find(x=>x.id===receiptEditingId);
 root.innerHTML='<div class="doc-hero"><div><span>SIMOUN · COMPROBANTES</span><h1>Recibos de pago</h1><p>Registra anticipos, abonos, liquidaciones o pagos completos. Sin firma.</p></div><div class="doc-total">'+docs.receipts.length+'<small>recibos guardados</small></div></div>'+
 '<div class="doc-layout"><section class="card doc-create-card">'+receiptForm(d)+'</section><section class="card doc-history"><h2>Recibos guardados</h2>'+
 (docs.receipts.length?docs.receipts.slice().reverse().map(x=>'<article class="doc-history-card"><div class="doc-history-info"><strong>'+esc(x.folio)+'</strong><span>'+esc(x.clientName)+'</span><small>'+esc(fmt(x.date))+' · Recibido: '+money(x.amount)+' · Pendiente: '+money(x.balance)+'</small></div><div class="split-actions"><button class="btn sm secondary" onclick="receiptEdit(\''+x.id+'\')">Editar</button><button class="btn sm secondary" onclick="receiptDownload(\''+x.id+'\')">Descargar</button><button class="btn sm light" onclick="receiptPrint(\''+x.id+'\')">Imprimir / PDF</button><button class="btn sm danger" onclick="receiptDelete(\''+x.id+'\')">Borrar</button></div></article>').join(''):'<p class="muted">Todavía no hay recibos guardados.</p>')+'</section></div>';
}
function receiptSave(e,id){
 e.preventDefault();const f=new FormData(e.currentTarget);
 const val=k=>String(f.get(k)||'').trim();
 const amount=Number(val('amount')),balance=Number(val('balance'));
 if(!val('clientName')||!val('concept')||!val('date')||!val('paymentDate')||!Number.isFinite(amount)||amount<=0||!Number.isFinite(balance)||balance<0){
   alert('Completa cliente, fechas, concepto e importes válidos.');return;
 }
 const docs=receiptStore();let d=id?docs.receipts.find(x=>x.id===id):null;
 if(id&&!d){alert('No se encontró el recibo.');return}
 if(!d){
  const folio=receiptNextFolio();
  docs.receiptCounter=Number(folio.split('-')[2]);d={id:uid(),folio,createdAt:new Date().toISOString()};
  docs.receipts.push(d);
 }
 Object.assign(d,{date:val('date'),paymentDate:val('paymentDate'),clientName:val('clientName'),clientAddress:val('clientAddress'),clientWhatsApp:val('clientWhatsApp'),concept:val('concept'),amount,balance,paymentType:val('paymentType'),paymentMethod:val('paymentMethod'),reference:val('reference'),terms:val('terms')});
 receiptEditingId=null;save();receiptRender();alert('Recibo '+d.folio+' guardado.');
}
function receiptEdit(id){receiptEditingId=id;receiptRender();document.getElementById('recibos')?.scrollIntoView({behavior:'smooth',block:'start'})}
function receiptCancelEdit(){receiptEditingId=null;receiptRender()}
function receiptDelete(id){
 const d=receiptStore().receipts.find(x=>x.id===id);if(!d||!confirmDelete('¿Borrar el recibo '+d.folio+'? El folio no se reutilizará.'))return;
 receiptStore().receipts=receiptStore().receipts.filter(x=>x.id!==id);
 if(receiptEditingId===id)receiptEditingId=null;
 save();receiptRender();
}
function receiptFind(id){return receiptStore().receipts.find(x=>x.id===id)}
function receiptHTML(d){
 const e=esc;
 const dateText=date=>new Date(date+'T12:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
 const line=(label,value)=>value?'<div class="fieldrow"><b>'+label+'</b><span>'+e(value)+'</span></div>':'';
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(receiptFileName(d))+'</title><style>'+
 'body{font:14px Arial,sans-serif;color:#20324a;max-width:800px;margin:30px auto;padding:0 24px}header{display:flex;justify-content:space-between;gap:12px;border-bottom:3px solid #12375d;padding-bottom:18px}.brand{font-weight:800;font-size:29px;color:#143c67}.subtitle,.muted{color:#63758c}.right{text-align:right}h2{font-size:15px;color:#14436c;border-bottom:1px solid #dbe5f0;padding:10px 0;margin-top:28px}.fieldrow{display:grid;grid-template-columns:115px 1fr;gap:12px;padding:7px 0;white-space:pre-wrap}.concept{padding:12px 0;white-space:pre-wrap;line-height:1.5}.amount{display:flex;justify-content:space-between;gap:10px;align-items:center;background:#eaf3fb;border-radius:8px;padding:15px;margin-top:22px;font-weight:bold}.amount strong{font-size:21px;color:#143c67}.balance{display:flex;justify-content:space-between;gap:10px;margin-top:14px;padding:12px 15px;border:1px solid #cbd8e5;border-radius:8px;font-weight:bold}.terms{margin-top:25px;white-space:pre-wrap}footer{border-top:1px solid #cbd8e5;margin-top:55px;padding-top:15px;font-size:12px;line-height:1.7;color:#4f6074}@media print{body{margin:0 auto;padding:0 12mm}}'+
 '</style></head><body><header><div><div class="brand">SIMOUN</div><div class="subtitle">Sistema de Monitoreo Universal</div></div><div class="right"><b>RECIBO DE PAGO</b><div>Morelia, Michoacán</div><div>'+e(dateText(d.date))+'</div><small class="muted">'+e(d.folio)+'</small></div></header>'+
 '<h2>DATOS DEL CLIENTE</h2>'+line('Cliente:',d.clientName)+line('Dirección:',d.clientAddress)+line('WhatsApp:',d.clientWhatsApp)+
 '<h2>CONCEPTO DEL PAGO</h2><div class="concept">'+e(d.concept)+'</div>'+
 '<div class="amount"><span>'+e((d.paymentType||'Pago')==='Anticipo'?'ANTICIPO RECIBIDO':(d.paymentType||'Pago').toUpperCase()+' RECIBIDO')+'</span><strong>'+money(d.amount)+' MXN</strong></div>'+
 '<p class="muted">Fecha de pago: '+e(dateText(d.paymentDate))+'</p>'+
 '<div class="balance"><span>SALDO PENDIENTE</span><strong>'+money(d.balance)+' MXN</strong></div>'+
 (d.paymentMethod&&d.paymentMethod!=='No especificada'?'<p>Forma de pago: '+e(d.paymentMethod)+(d.reference?' · Referencia: '+e(d.reference):'')+'</p>':'')+
 (d.terms?'<p class="terms">'+e(d.terms)+'</p>':'')+
 '<footer><b>SIMOUN | Sistema de Monitoreo Universal</b><br>Blvd. Rafael García de León #777-A, Chapultepec Sur<br>Morelia, Michoacán, México. C.P. 58260<br>Tel. 443 489 2474 | 443 324 8181<br>Correo: simounpagos@gmail.com | www.simounseguridad.com</footer></body></html>';
}
function receiptDownload(id){
 const d=receiptFind(id);if(!d)return;
 const blob=new Blob([receiptHTML(d)],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=receiptFileName(d)+'.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function receiptPrint(id){
 const d=receiptFind(id);if(!d)return;
 const w=window.open('','_blank');if(!w){alert('Permite ventanas emergentes para imprimir o guardar como PDF.');return}
 w.document.open();w.document.write(receiptHTML(d));w.document.close();setTimeout(()=>{w.focus();w.print()},500);
}
