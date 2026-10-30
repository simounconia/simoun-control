/* Cotizaciones y remisiones descargables */
const DOC_COMPANY_DEFAULT={name:'SIMOUN',legalName:'',rfc:'',address:'',phone:'',email:''};
function docStore(){
  state.commercialDocs ||= {company:{...DOC_COMPANY_DEFAULT},quotes:[],remissions:[]};
  state.commercialDocs.company ||= {...DOC_COMPANY_DEFAULT};
  state.commercialDocs.quotes ||= []; state.commercialDocs.remissions ||= [];
  return state.commercialDocs;
}
function docDate(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function docPrefix(kind){return kind==='quote'?'COT':'REM'}
function docList(kind){return kind==='quote'?docStore().quotes:docStore().remissions}
function docNextFolio(kind){
  const prefix=docPrefix(kind)+'-'+new Date().getFullYear()+'-';
  const max=docList(kind).reduce((n,d)=>{const m=String(d.folio||'').match(new RegExp('^'+prefix+'(\\\\d+)$'));return m?Math.max(n,Number(m[1])):n},0);
  return prefix+String(max+1).padStart(4,'0');
}
function docInput(name,label,value,placeholder,type){
  return '<label class="field"><span>'+label+'</span><input name="'+name+'" value="'+esc(value||'')+'" placeholder="'+esc(placeholder||'')+'" type="'+(type||'text')+'"></label>';
}
function docCompanyForm(){
  const c=docStore().company;
  return '<details class="doc-company"><summary>Datos de SIMOUN para los documentos</summary><p class="muted">Completa estos datos una vez; se reutilizarán en los siguientes documentos.</p><form onsubmit="docSaveCompany(event)">'+
    '<div class="row">'+docInput('name','Nombre comercial',c.name||'SIMOUN','SIMOUN')+docInput('legalName','Razón social',c.legalName,'Razón social registrada')+'</div>'+
    '<div class="row">'+docInput('rfc','RFC',c.rfc,'RFC de SIMOUN')+docInput('phone','Teléfono',c.phone,'Teléfono de contacto')+'</div>'+
    '<div class="row">'+docInput('email','Correo',c.email,'Correo de contacto','email')+docInput('address','Dirección',c.address,'Domicilio de SIMOUN')+'</div>'+
    '<button class="btn secondary" type="submit">Guardar datos de SIMOUN</button></form></details>';
}
function docClientOptions(){
  return '<option value="">Capturar cliente manualmente</option>'+state.clients.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name||'Sin nombre')+(c.company?' · '+esc(c.company):'')+'</option>').join('');
}
function docClientFields(){
  return '<div class="row">'+docInput('clientName','Cliente','', 'Nombre o razón social')+docInput('clientCompany','Empresa','','Empresa')+'</div>'+
    '<div class="row">'+docInput('clientRFC','RFC','','RFC del cliente')+docInput('clientContact','Contacto','','Persona de contacto')+'</div>'+
    '<div class="row">'+docInput('clientPhone','Teléfono','','Teléfono')+docInput('clientEmail','Correo','','Correo','email')+'</div>'+
    '<label class="field"><span>Dirección del cliente</span><textarea name="clientAddress" placeholder="Domicilio del cliente"></textarea></label>';
}
function docLineRow(){
  return '<div class="doc-line" data-line><input data-description placeholder="Producto o servicio" aria-label="Producto o servicio"><input data-qty type="number" min="0.01" step="0.01" value="1" aria-label="Cantidad"><input data-price type="number" min="0" step="0.01" placeholder="Precio neto unitario" aria-label="Precio neto unitario"><button class="btn sm danger" type="button" onclick="docRemoveLine(this)" aria-label="Quitar renglón">×</button></div>';
}
function docOptionCard(n){
  return '<article class="doc-option" data-option><div class="doc-option-head"><strong>Opción '+n+'</strong><button class="btn sm danger" type="button" onclick="docRemoveOption(this)">Quitar opción</button></div>'+
    '<div class="row">'+docInput('optionTitle','Nombre de la opción','','Ej. Básica, recomendada, premium')+docInput('optionDescription','Descripción breve','','Alcance o diferencia')+'</div>'+
    '<div class="doc-lines-head"><strong>Conceptos</strong><span>Captura los precios antes de IVA.</span></div><div data-lines>'+docLineRow()+'</div><button class="btn sm secondary" type="button" onclick="docAddLine(this)">+ Agregar concepto</button></article>';
}
function docItems(kind){
  return kind==='quote'?'<div class="doc-option-list" id="quoteOptions">'+docOptionCard(1)+docOptionCard(2)+'</div><button class="btn secondary" type="button" onclick="docAddOption()">+ Agregar otra opción</button>':
    '<div class="doc-lines-head"><strong>Conceptos de la remisión</strong><span>Captura los precios antes de IVA.</span></div><div class="doc-remit-lines" data-lines>'+docLineRow()+'</div><button class="btn secondary" type="button" onclick="docAddLine(this)">+ Agregar concepto</button>';
}
function docForm(kind){
  const quote=kind==='quote',label=quote?'cotización':'remisión',id=quote?'quote':'remit';
  return '<form class="doc-form" id="'+id+'Form" onsubmit="docCreate(event,\''+kind+'\')"><div class="doc-form-title"><h2>Nueva '+label+'</h2><span class="badge blue">Folio siguiente: '+esc(docNextFolio(kind))+'</span></div>'+
    '<div class="row"><label class="field"><span>Fecha</span><input name="date" type="date" value="'+docDate()+'" required></label><label class="field"><span>Seleccionar cliente existente</span><select name="clientSelect" onchange="docFillClient(\''+kind+'\',this)">'+docClientOptions()+'</select></label></div>'+
    '<div class="doc-subhead">Datos del cliente</div>'+docClientFields()+'<div class="doc-subhead">'+(quote?'Opciones':'Conceptos')+'</div>'+docItems(kind)+
    '<label class="switch-line"><input type="checkbox" name="includeIVA"><span>Incluir IVA del 16% en el documento</span></label>'+
    '<label class="field"><span>Notas para el cliente</span><textarea name="notes" placeholder="Condiciones, vigencia o información adicional visible para el cliente"></textarea></label>'+
    '<label class="field doc-private"><span>Nota privada para SIMOUN</span><textarea name="privateNote" placeholder="Modelos, costo, proveedor u otros datos internos. No aparecerán en el documento descargable."></textarea></label>'+
    '<button class="btn doc-create" type="submit">Guardar '+label+' y asignar folio</button></form>';
}
function docRender(kind){
  const quote=kind==='quote',id=quote?'cotizaciones':'remisiones',title=quote?'Cotizaciones':'Remisiones',items=docList(kind),root=document.getElementById(id);
  if(!root)return;
  root.innerHTML='<div class="doc-hero"><div><span>SIMOUN · DOCUMENTOS</span><h1>'+title+'</h1><p>'+(quote?'Prepara propuestas con dos o más opciones.':'Prepara remisiones con folio, sin opciones.')+'</p></div><div class="doc-total">'+items.length+'<small>documentos guardados</small></div></div>'+
    docCompanyForm()+'<div class="doc-layout"><section class="card doc-create-card">'+docForm(kind)+'</section><section class="card doc-history"><div class="doc-history-head"><h2>Historial de '+title.toLowerCase()+'</h2><span class="muted">Folios consecutivos</span></div>'+
    (items.length?items.slice().reverse().map(d=>docHistoryCard(d,kind)).join(''):'<div class="empty">Todavía no hay '+title.toLowerCase()+' guardadas.</div>')+'</section></div>';
}
function renderQuotes(){docRender('quote')}
function renderRemissions(){docRender('remission')}
function docSaveCompany(e){
  e.preventDefault();const f=new FormData(e.currentTarget),c=docStore().company;
  ['name','legalName','rfc','address','phone','email'].forEach(k=>c[k]=String(f.get(k)||'').trim());
  if(!c.name)c.name='SIMOUN';save();
}
function docFillClient(kind,select){
  const c=state.clients.find(x=>x.id===select.value);if(!c)return;
  const form=document.getElementById(kind==='quote'?'quoteForm':'remitForm');if(!form)return;
  const set=(key,value)=>{if(form.elements[key])form.elements[key].value=value||''};
  set('clientName',c.name);set('clientCompany',c.company);set('clientContact',c.contact);
  set('clientPhone',c.phone||c.whatsapp);set('clientAddress',c.address);set('clientRFC',c.rfc||c.taxId||'');set('clientEmail',c.email||'');
}
function docAddLine(button){
  const form=button.closest('form'),holder=button.parentElement.querySelector('[data-lines]')||form.querySelector('.doc-remit-lines');
  if(holder)holder.insertAdjacentHTML('beforeend',docLineRow());
}
function docRemoveLine(button){
  const holder=button.closest('[data-lines]');
  if(holder&&holder.querySelectorAll('[data-line]').length>1)button.closest('[data-line]').remove();
}
function docAddOption(){
  const holder=document.getElementById('quoteOptions');
  if(holder)holder.insertAdjacentHTML('beforeend',docOptionCard(holder.querySelectorAll('[data-option]').length+1));
}
function docRemoveOption(button){
  const holder=document.getElementById('quoteOptions');
  if(holder&&holder.querySelectorAll('[data-option]').length>2)button.closest('[data-option]').remove();
  else alert('La cotización debe conservar al menos dos opciones.');
}
function docReadLines(holder){
  return Array.from(holder.querySelectorAll('[data-line]')).map(line=>({
    description:line.querySelector('[data-description]').value.trim(),
    quantity:Number(line.querySelector('[data-qty]').value||0),
    unitPrice:Number(line.querySelector('[data-price]').value||0)
  })).filter(x=>x.description);
}
function docCreate(e,kind){
  e.preventDefault();const form=e.currentTarget,fd=new FormData(form),quote=kind==='quote';
  const client={name:String(fd.get('clientName')||'').trim(),company:String(fd.get('clientCompany')||'').trim(),rfc:String(fd.get('clientRFC')||'').trim(),
    contact:String(fd.get('clientContact')||'').trim(),phone:String(fd.get('clientPhone')||'').trim(),email:String(fd.get('clientEmail')||'').trim(),address:String(fd.get('clientAddress')||'').trim()};
  if(!client.name){alert('Escribe el nombre del cliente o razón social.');return}
  let options=[];
  if(quote){
    const cards=Array.from(form.querySelectorAll('[data-option]'));
    if(cards.length<2){alert('La cotización debe incluir al menos dos opciones.');return}
    options=cards.map((card,i)=>({title:card.querySelector('[name="optionTitle"]').value.trim()||'Opción '+(i+1),
      description:card.querySelector('[name="optionDescription"]').value.trim(),lines:docReadLines(card.querySelector('[data-lines]'))}));
    if(options.some(x=>!x.lines.length)){alert('Agrega al menos un concepto en cada opción.');return}
  }else{
    const lines=docReadLines(form.querySelector('.doc-remit-lines'));
    if(!lines.length){alert('Agrega al menos un concepto a la remisión.');return}
    options=[{title:'Remisión',description:'',lines}];
  }
  const docs=docStore(),company=docs.company;
  const companyForm=document.querySelector('#'+(quote?'cotizaciones':'remisiones')+' .doc-company form');
  if(companyForm){const cf=new FormData(companyForm);['name','legalName','rfc','address','phone','email'].forEach(k=>company[k]=String(cf.get(k)||'').trim());if(!company.name)company.name='SIMOUN'}
  const d={id:uid(),folio:docNextFolio(kind),date:String(fd.get('date')||docDate()),createdAt:new Date().toISOString(),
    simoun:{...company},client,options,includeIVA:fd.get('includeIVA')==='on',notes:String(fd.get('notes')||'').trim(),privateNote:String(fd.get('privateNote')||'').trim()};
  (quote?docs.quotes:docs.remissions).push(d);save();alert((quote?'Cotización':'Remisión')+' guardada con folio '+d.folio+'.');
}
function docSubtotal(lines){return lines.reduce((sum,x)=>sum+(Number(x.quantity)||0)*(Number(x.unitPrice)||0),0)}
function docTotals(lines,iva){const subtotal=docSubtotal(lines),tax=iva?subtotal*.16:0;return{subtotal,tax,total:subtotal+tax}}
function docHistoryCard(d,kind){
  const quote=kind==='quote',summary=quote?d.options.map((o,i)=>'Opción '+(i+1)+': '+money(docTotals(o.lines,d.includeIVA).total)).join(' · '):money(docTotals((d.options[0]||{}).lines||[],d.includeIVA).total);
  return '<article class="doc-history-card"><div class="doc-history-info"><strong>'+esc(d.folio)+'</strong><span>'+esc(d.client.name||'')+(d.client.company?' · '+esc(d.client.company):'')+'</span><small>'+esc(fmt(d.date))+' · '+(quote?d.options.length+' opciones':'Remisión')+' · '+summary+'</small>'+
    (d.privateNote?'<small class="doc-private-badge">Nota privada guardada en SIMOUN</small>':'')+'</div><div class="split-actions"><button class="btn sm secondary" onclick="docDownload(\''+kind+'\',\''+d.id+'\')">Descargar archivo</button><button class="btn sm light" onclick="docPrint(\''+kind+'\',\''+d.id+'\')">Imprimir / Guardar PDF</button></div></article>';
}
function docPublicHTML(d,kind){
  const quote=kind==='quote',title=quote?'Cotización':'Remisión';
  const table=lines=>'<table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio unitario</th><th>Importe</th></tr></thead><tbody>'+
    lines.map(x=>'<tr><td>'+esc(x.description)+'</td><td>'+Number(x.quantity).toLocaleString('es-MX')+'</td><td>'+money(x.unitPrice)+'</td><td>'+money(x.quantity*x.unitPrice)+'</td></tr>').join('')+'</tbody></table>';
  const totals=lines=>{const t=docTotals(lines,d.includeIVA);return '<div class="totals"><div><span>Subtotal</span><b>'+money(t.subtotal)+'</b></div>'+(d.includeIVA?'<div><span>IVA 16%</span><b>'+money(t.tax)+'</b></div>':'')+'<div class="grand"><span>Total'+(d.includeIVA?' con IVA':' neto')+'</span><b>'+money(t.total)+'</b></div></div>'};
  const opts=quote?d.options.map((o,i)=>'<section class="option"><h2>'+esc(o.title||'Opción '+(i+1))+'</h2>'+(o.description?'<p>'+esc(o.description)+'</p>':'')+table(o.lines)+totals(o.lines)+'</section>').join(''):
    table((d.options[0]||{}).lines||[])+totals((d.options[0]||{}).lines||[]);
  const s=d.simoun||{},c=d.client||{};
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title+' '+d.folio)+'</title><style>'+
    'body{font:14px Arial,sans-serif;color:#17283c;margin:36px auto;max-width:850px;padding:0 24px}header{display:flex;justify-content:space-between;border-bottom:3px solid #0b2c55;padding-bottom:16px}h1{color:#0b2c55;margin:0}h2{color:#164a78}.muted{color:#58697c}.folio{text-align:right;font-size:16px;font-weight:bold}.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:22px 0}.party h3{margin:0 0 7px;color:#164a78}p{line-height:1.45;margin:4px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:9px 7px;border-bottom:1px solid #dce4ef}th{background:#eef3f8}.totals{margin:12px 0 18px auto;max-width:300px}.totals div{display:flex;justify-content:space-between;padding:5px}.grand{border-top:2px solid #0b2c55;font-size:16px;color:#0b2c55}.option{margin:24px 0;page-break-inside:avoid}.notes{border:1px solid #dce4ef;border-radius:8px;padding:12px;margin-top:22px;white-space:pre-wrap}@media print{body{margin:0 auto;padding:0 10mm}}@media(max-width:600px){.parties{grid-template-columns:1fr}body{padding:0 14px}}'+
    '</style></head><body><header><div><h1>'+esc(s.name||'SIMOUN')+'</h1><p>'+(s.legalName?esc(s.legalName)+'<br>':'')+(s.rfc?'RFC: '+esc(s.rfc)+'<br>':'')+(s.address?esc(s.address)+'<br>':'')+(s.phone?esc(s.phone)+'<br>':'')+(s.email?esc(s.email):'')+'</p></div><div class="folio">'+esc(title.toUpperCase())+'<br>'+esc(d.folio)+'<p class="muted">Fecha: '+esc(fmt(d.date))+'</p></div></header>'+
    '<div class="parties"><div class="party"><h3>Cliente</h3><p><b>'+esc(c.name||'')+'</b><br>'+(c.company?esc(c.company)+'<br>':'')+(c.rfc?'RFC: '+esc(c.rfc)+'<br>':'')+(c.contact?esc(c.contact)+'<br>':'')+(c.phone?esc(c.phone)+'<br>':'')+(c.email?esc(c.email)+'<br>':'')+esc(c.address||'')+'</p></div></div>'+
    opts+(d.notes?'<div class="notes"><b>Notas</b><br>'+esc(d.notes).replace(/\\n/g,'<br>')+'</div>':'')+'<p class="muted" style="margin-top:30px">Gracias por su preferencia · '+esc(s.name||'SIMOUN')+'</p></body></html>';
}
function docFind(kind,id){return docList(kind).find(x=>x.id===id)}
function docDownload(kind,id){
  const d=docFind(kind,id);if(!d)return;
  const blob=new Blob([docPublicHTML(d,kind)],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=d.folio+'.html';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function docPrint(kind,id){
  const d=docFind(kind,id);if(!d)return;
  const w=window.open('','_blank');if(!w){alert('Permite la ventana emergente para imprimir o guardar el documento como PDF.');return}
  w.document.open();w.document.write(docPublicHTML(d,kind));w.document.close();setTimeout(()=>{w.focus();w.print()},500);
}
function docStyle(){
  const s=document.createElement('style');
  s.textContent='#cotizaciones .doc-hero,#remisiones .doc-hero{display:flex;justify-content:space-between;align-items:center;gap:15px;background:linear-gradient(135deg,#0b2c55,#246b91);color:#fff;border-radius:18px;padding:20px;margin-bottom:14px}#cotizaciones .doc-hero h1,#remisiones .doc-hero h1{margin:5px 0;font-size:24px}#cotizaciones .doc-hero p,#remisiones .doc-hero p{margin:0;opacity:.85}#cotizaciones .doc-hero>div:first-child>span,#remisiones .doc-hero>div:first-child>span{font-size:11px;letter-spacing:.12em;font-weight:800}.doc-total{font-size:24px;font-weight:850;text-align:center;min-width:90px}.doc-total small{display:block;font-size:11px;font-weight:600;color:#fff}.doc-company{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:14px}.doc-company summary{font-weight:800;cursor:pointer;color:var(--brand)}.doc-company form{display:grid;gap:10px;margin-top:12px}.doc-company p{margin:8px 0}.doc-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:14px;align-items:start}.doc-form{display:grid;gap:12px}.doc-form-title,.doc-option-head,.doc-history-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.doc-form-title h2,.doc-history-head h2{margin:0}.doc-subhead{font-weight:850;color:#164a78;border-bottom:1px solid var(--line);padding-bottom:6px;margin-top:4px}.doc-form .field{display:grid;gap:5px}.doc-form .field>span{font-size:12px;color:var(--muted);font-weight:750}.doc-form textarea{min-height:76px;padding:10px;border:1px solid var(--line);border-radius:10px;resize:vertical}.doc-option{border:1px solid var(--line);border-radius:13px;background:#f9fbfd;padding:12px;margin:9px 0;display:grid;gap:10px}.doc-option-head strong{color:#164a78}.doc-lines-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:13px;margin:8px 0}.doc-lines-head span{color:var(--muted);font-size:11px}.doc-line{display:grid;grid-template-columns:minmax(120px,1fr) 90px minmax(130px,170px) auto;gap:7px;margin:7px 0}.doc-line input{width:100%;min-width:0;padding:9px;border:1px solid var(--line);border-radius:9px}.doc-private{border:1px dashed #d59b46;background:#fffaf1;padding:10px;border-radius:11px}.doc-private>span{color:#855000!important}.doc-create{min-height:48px}.doc-history{display:grid;gap:10px}.doc-history-head{margin-bottom:4px}.doc-history-card{display:grid;gap:10px;border:1px solid var(--line);border-radius:12px;padding:11px;background:#fbfcfe}.doc-history-info{display:grid;gap:3px;min-width:0}.doc-history-info>strong{color:#0b2c55}.doc-history-info>span{font-size:13px}.doc-history-info small{font-size:11px;color:var(--muted)}.doc-private-badge{color:#855000!important}.doc-history-card .split-actions{justify-content:flex-start}@media(max-width:850px){.doc-layout{grid-template-columns:1fr}}@media(max-width:600px){#cotizaciones .doc-hero,#remisiones .doc-hero{padding:15px}#cotizaciones .doc-hero h1,#remisiones .doc-hero h1{font-size:21px}.doc-line{grid-template-columns:1fr 1fr auto}.doc-line input:first-child{grid-column:1/-1}.doc-line .btn{min-height:40px}.doc-history-card{gap:8px}}';
  document.head.appendChild(s);
}
docStyle();renderQuotes();renderRemissions();
