/* Documentos corporativos SIMOUN: remisiones y recibos con diseño uniforme.
   Solo cambia la presentación; no modifica registros, precios ni estados privados. */
const SIMOUN_DOC_SLOGAN='Alarmas, cámaras, videoportero y cerca eléctrica para la seguridad de tu hogar y tu negocio.';
const SIMOUN_DOC_ADDRESS='Blvd. García de León 777, Chapultepec Sur, 58260 Morelia, Mich.';
const SIMOUN_DOC_PHONE='443 489 2474';

function simounDocText(value){
  return esc(String(value==null?'':value));
}
function simounDocHas(value){
  return String(value==null?'':value).trim().length>0;
}
function simounDocLine(label,value){
  return simounDocHas(value)?'<div class="datum"><span>'+simounDocText(label)+'</span><b>'+simounDocText(value)+'</b></div>':'';
}
function simounDocDate(value){
  return value?simounDocText(fmt(value)):'';
}
function simounDocStyle(){
  // Reutiliza exactamente el estilo de la cotización aprobada.
  if(!simounDocStyle.cached){
    const demo=docQuoteHTML({folio:'',date:'',client:{},simoun:{},options:[]});
    const match=demo.match(/<style>([\s\S]*?)<\/style>/);
    simounDocStyle.cached=(match?match[1]:'')+
    '.doc-subtitle{color:#516982;margin:0 0 12px;font-size:11px}'+
    '.doc-concept{background:#f2f6fa;border:1px solid #dbe6f1;border-radius:9px;padding:13px 15px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.6;margin:6px 0 17px}'+
    '.doc-payment-main{background:#0c4a95;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 18px;border-radius:9px;margin:18px 0 11px;break-inside:avoid}'+
    '.doc-payment-main span{display:block;font-size:13px;font-weight:700;letter-spacing:.35px}.doc-payment-main strong{font-size:23px;white-space:nowrap}'+
    '.doc-balance{border:1px solid #cddaea;border-radius:9px;background:#eff4f9;padding:13px 18px;display:flex;align-items:center;justify-content:space-between;gap:18px;break-inside:avoid}'+
    '.doc-balance span{font-weight:700;color:#315475}.doc-balance strong{font-size:19px;color:#174479;white-space:nowrap}'+
    '.doc-payment-info{background:#f3f6f9;border-radius:9px;padding:11px 15px;display:grid;grid-template-columns:1fr 1fr;gap:7px 20px}'+
    '.doc-note{margin-top:16px;border-left:3px solid #2674ba;padding:11px 13px;background:#f7f9fc;break-inside:avoid;white-space:pre-wrap;overflow-wrap:anywhere}'+
    '.doc-panel-long{display:grid;grid-template-columns:1fr 1fr;gap:7px 17px}'+
    '@media print{.doc-payment-main,.doc-balance,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}';
  }
  return simounDocStyle.cached;
}
function simounDocCompany(d){
  const saved=(typeof docStore==='function'?docStore().company:{})||{};
  const docCompany=d?.simoun||{};
  return {
    name:docCompany.name||saved.name||'SIMOUN',
    address:docCompany.address||saved.address||SIMOUN_DOC_ADDRESS,
    phone:docCompany.whatsapp||docCompany.phone||saved.whatsapp||saved.phone||SIMOUN_DOC_PHONE,
    email:docCompany.email||saved.email||''
  };
}
function simounDocSection(title,icon){
  return '<div class="section-title"><span class="section-icon">'+simounDocText(icon||'•')+'</span><h2>'+simounDocText(title)+'</h2><span class="title-rule"></span></div>';
}
function simounDocPage(title,folio,date,company,contents){
  const logo=typeof SIMOUN_LOGO_DATA==='string'?
    '<img class="brand-logo" src="'+SIMOUN_LOGO_DATA+'" alt="Logo SIMOUN">':
    '<strong class="brand-fallback">SIMOUN</strong>';
  const companyText=company||{};
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>'+simounDocText(title+' '+(folio||''))+'</title><style>'+simounDocStyle()+'</style></head>'+
  '<body><div class="top-accent"></div>'+
  '<header class="brand-row"><div class="brand-left">'+logo+'</div><div class="brand-right"><b>SIMOUN · Control Operativo</b><small>'+simounDocText(SIMOUN_DOC_SLOGAN)+'</small></div></header>'+
  '<div class="titlebar"><h1>'+simounDocText(title.toUpperCase())+'</h1><div class="rule"></div>'+
  '<div class="folio"><div><span>Folio:</span><b>'+simounDocText(folio)+'</b></div>'+
  '<div><span>Fecha:</span><b>'+simounDocDate(date)+'</b></div></div></div>'+
  contents+
  '<footer class="footer"><span><strong>Dirección</strong><br>'+simounDocText(companyText.address||SIMOUN_DOC_ADDRESS)+'</span>'+
  '<span><strong>WhatsApp / Teléfono</strong><br>'+simounDocText(companyText.phone||SIMOUN_DOC_PHONE)+
  (simounDocHas(companyText.email)?'<br>'+simounDocText(companyText.email):'')+'</span></footer>'+
  '</body></html>';
}
function simounRemissionHTML(d){
  const c=d.client||{};
  const clientDetails=[
    simounDocLine('Nombre / empresa',c.name),
    simounDocLine('Atención a',c.contact),
    simounDocLine('Domicilio',c.address),
    simounDocLine('Teléfono',c.phone),
    simounDocLine('WhatsApp',c.whatsapp),
    simounDocLine('Correo',c.email),
    simounDocLine('Proyecto',c.projectName)
  ].filter(Boolean).join('');
  const lines=d.options?.[0]?.lines||[];
  const itemRows=lines.map(item=>{
    const quantity=Number(item.quantity||0);
    const unitPrice=Number(item.unitPrice||0);
    return '<tr><td>'+simounDocText(item.description)+'</td>'+
      '<td class="center">'+quantity.toLocaleString('es-MX',{maximumFractionDigits:2})+'</td>'+
      '<td class="money">'+money(unitPrice)+'</td><td class="money">'+money(quantity*unitPrice)+'</td></tr>';
  }).join('');
  const totals=docTotals(lines,!!d.includeIVA);
  const totalBlock='<div class="totals"><div><span>Subtotal</span><b>'+money(totals.subtotal)+'</b></div>'+
    (d.includeIVA?'<div><span>IVA (16%)</span><b>'+money(totals.tax)+'</b></div>':'')+
    '<div class="grand"><span>Total'+(d.includeIVA?'':' (sin IVA)')+'</span><b>'+money(totals.total)+'</b></div></div>';
  const notes=simounDocHas(d.notes)?
    simounDocSection('Observaciones','✓')+'<div class="doc-note">'+simounDocText(d.notes)+'</div>':'';
  const body=
    simounDocSection('Datos del cliente','●')+'<div class="client-panel">'+clientDetails+'</div>'+
    simounDocSection('Detalle de la remisión','≡')+
    '<table><thead><tr><th>Concepto</th><th class="center">Cantidad</th>'+
    '<th class="money">Precio unitario</th><th class="money">Importe</th></tr></thead><tbody>'+itemRows+'</tbody></table>'+
    totalBlock+notes;
  return simounDocPage('Remisión',d.folio,d.date,simounDocCompany(d),body);
}
function simounReceiptHTML(d){
  const clientDetails=[
    simounDocLine('Nombre del cliente',d.clientName),
    simounDocLine('Domicilio',d.clientAddress),
    simounDocLine('WhatsApp',d.clientWhatsApp)
  ].filter(Boolean).join('');
  const paymentDetails=[
    simounDocLine('Fecha del pago',d.paymentDate?fmt(d.paymentDate):''),
    simounDocLine('Tipo de pago',d.paymentType),
    simounDocLine('Forma de pago',d.paymentMethod==='No especificada'?'':d.paymentMethod),
    simounDocLine('Referencia',d.reference)
  ].filter(Boolean).join('');
  const paymentLabel=(d.paymentType||'Pago')==='Anticipo'?'ANTICIPO RECIBIDO':'IMPORTE RECIBIDO';
  const body=
    simounDocSection('Datos del cliente','●')+'<div class="client-panel">'+clientDetails+'</div>'+
    simounDocSection('Concepto del pago','≡')+
    '<div class="doc-concept">'+simounDocText(d.concept||'')+'</div>'+
    simounDocSection('Datos del pago','✓')+
    '<div class="doc-payment-info">'+paymentDetails+'</div>'+
    '<div class="doc-payment-main"><span>'+simounDocText(paymentLabel)+'</span><strong>'+money(d.amount)+' MXN</strong></div>'+
    '<div class="doc-balance"><span>Saldo pendiente</span><strong>'+money(d.balance)+' MXN</strong></div>'+
    (simounDocHas(d.terms)?simounDocSection('Aclaraciones','•')+'<div class="doc-note">'+simounDocText(d.terms)+'</div>':'');
  // Los recibos de esta app se generan sin firma y nunca incluyen notas privadas.
  return simounDocPage('Recibo de pago',d.folio,d.date,simounDocCompany(null),body);
}
// Mantener el diseño aprobado de cotizaciones y usarlo también en remisiones.
const simounPreviousPublicHTML=docPublicHTML;
docPublicHTML=function(d,kind){
  return kind==='remission'?simounRemissionHTML(d):simounPreviousPublicHTML(d,kind);
};
receiptHTML=function(d){
  return simounReceiptHTML(d);
};
