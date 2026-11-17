/* Plantilla 3 SIMOUN: cotizacion ejecutiva. Las remisiones conservan su diseño. */
function docQuoteHTML(d){
  const c=d.client||{}, s=d.simoun||{}, t=d.terms||{};
  const clean=v=>esc(String(v==null?'':v));
  const has=v=>String(v==null?'':v).trim().length>0;
  const address=s.address||'Blvd. García de León 777, Chapultepec Sur, 58260 Morelia, Mich.';
  const phone=s.whatsapp||s.phone||'443 489 2474';
  const line=(label,value)=>has(value)?'<div class="datum'+(['Nombre / empresa','Proyecto','Domicilio','Lugar de instalación'].includes(label)?' wide':'')+'"><span>'+clean(label)+'</span><b>'+clean(value)+'</b></div>':'';
  const rows=[
    line('Nombre / empresa',c.name),
    line('Contacto',[...new Set([c.contact,c.phone,c.whatsapp].filter(Boolean))].join(' · ')),
    line('Domicilio',c.address),
    line('Correo',c.email),
    line('Proyecto',c.projectName),
    line('Lugar de instalación',t.serviceAddress)
  ].filter(Boolean).join('');
  const options=(d.options||[]).map((o,i)=>{
    const title=has(o.title)?o.title:'Opción '+(i+1);
    const showTitle=(d.options||[]).length>1 || (title!=='Opción 1'&&title!=='Opción '+(i+1));
    const lines=(o.lines||[]);
    const body=lines.map(x=>'<tr><td>'+clean(x.description)+'</td><td class="center">'+Number(x.quantity||0).toLocaleString('es-MX',{maximumFractionDigits:2})+'</td><td class="money">'+money(x.unitPrice)+'</td><td class="money">'+money(Number(x.quantity||0)*Number(x.unitPrice||0))+'</td></tr>').join('');
    const total=docTotals(lines,!!d.includeIVA);
    return '<section class="quote-option">'+
      (showTitle?'<h3>'+clean(title)+'</h3>':'')+
      (has(o.description)?'<p class="option-description">'+clean(o.description)+'</p>':'')+
      '<table><thead><tr><th>Concepto</th><th class="center">Cantidad</th><th class="money">Precio unitario</th><th class="money">Importe</th></tr></thead><tbody>'+body+'</tbody></table>'+
      '<div class="totals"><div><span>Subtotal</span><b>'+money(total.subtotal)+'</b></div>'+
      (d.includeIVA?'<div><span>IVA (16%)</span><b>'+money(total.tax)+'</b></div>':'')+
      '<div class="grand"><span>Total'+(d.includeIVA?'':' (sin IVA)')+'</span><b>'+money(total.total)+'</b></div></div></section>';
  }).join('');
  const terms=[
    line('Vigencia',t.validity),
    line('Tiempo de entrega',t.deliveryTime),
    line('Garantía',t.warranty),
    line('Condiciones de pago',t.paymentTerms),
    line('Anticipo',t.deposit)
  ].filter(Boolean).join('');
  const notes=has(d.notes)?'<section class="notes"><div class="section-title"><span class="section-icon">✎</span><h2>Notas</h2></div><p>'+clean(d.notes).replace(/\n/g,'<br>')+'</p></section>':'';
  const termsPanel=terms?'<section class="terms-card"><div class="section-title"><span class="section-icon">✓</span><h2>Condiciones</h2></div><div class="conditions">'+terms+'</div></section>':'';
  const extras=(termsPanel||notes)?'<div class="quote-extras'+(termsPanel&&notes?'':' single')+'">'+termsPanel+notes+'</div>':'';
  const signature=d.includeSignature&&d.signatureImage?
    '<section class="signature"><img src="'+d.signatureImage+'" alt="Firma administrativa"><b>Jessica Pimentel G.R - Administrativo</b></section>':'';
  const logo=typeof SIMOUN_LOGO_DATA==='string'?'<img class="brand-logo" src="'+SIMOUN_LOGO_DATA+'" alt="Logo SIMOUN">':'<strong class="brand-fallback">SIMOUN</strong>';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+clean(docFilename(d))+'</title>'+
  '<style>'+
  '*{box-sizing:border-box}'+
  'html,body{margin:0;padding:0;background:#fff}'+
  'body{padding:0!important;max-width:none!important}'+
  '.simoun-pdf-root{width:100%;max-width:840px;margin:0 auto;padding:11px 13px;background:#fff;color:#202c3e;font:11.5px Arial,Helvetica,sans-serif;line-height:1.34}'+
  '.top-accent{height:4px;background:linear-gradient(90deg,#0a3677,#1683dc);margin:-11px -13px 8px}'+
  '.brand-row{display:flex;align-items:center;gap:12px;justify-content:space-between;background:#f6f9fd;border-radius:8px;padding:7px 10px;border:1px solid #dfe8f3}'+
  '.brand-left{width:43%;max-width:285px}'+
  '.brand-logo{width:100%;max-height:63px;object-fit:contain;object-position:left center}'+
  '.brand-fallback{font-size:25px;color:#073a85}'+
  '.brand-right{border-left:2px solid #c6d6e6;padding-left:12px;flex:1;min-width:0;color:#16385e}'+
  '.brand-right b{font-size:12px;color:#0a306c}'+
  '.brand-right small{display:block;margin-top:3px;color:#526a80;font-size:10px;line-height:1.32}'+
  '.titlebar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 0 8px}'+
  '.titlebar h1{font-size:23px;letter-spacing:.4px;margin:0;font-weight:800;color:#0b2d60}'+
  '.titlebar .rule{height:2px;background:#2580ca;flex:1}'+
  '.folio{background:#eef3f8;border-radius:7px;padding:5px 8px;min-width:172px;font-size:10px}'+
  '.folio div{display:flex;gap:7px;justify-content:space-between;padding:1px 0}'+
  '.folio span{color:#5d7186}'+
  '.folio b{color:#173f70}'+
  '.section-title{display:flex;align-items:center;gap:6px;margin:10px 0 6px;page-break-after:avoid;break-after:avoid}'+
  '.section-icon{width:20px;height:20px;background:#0a4b96;border-radius:4px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;flex-shrink:0}'+
  '.section-title h2{font-size:13px;margin:0;color:#123c76}'+
  '.section-title .title-rule{height:1px;background:#8cb8df;flex:1}'+
  '.client-panel{background:#f3f6f9;border:1px solid #dce7f3;border-radius:8px;padding:7px 11px;display:grid;grid-template-columns:1fr 1fr;column-gap:13px;row-gap:3px}'+
  '.datum{display:flex;gap:6px;align-items:baseline;min-width:0;font-size:10.5px;overflow-wrap:anywhere}'+
  '.datum span{font-weight:700;color:#41627f;white-space:nowrap}'+
  '.datum b{font-weight:500;color:#253343}'+
  '.client-panel .datum.wide{grid-column:1/-1}'+
  '.client-panel .datum{break-inside:avoid}'+
  '.quote-option{margin-top:4px;padding:0;break-inside:auto}'+
  '.quote-option h3{color:#0b4a90;margin:7px 0 3px;font-size:12px}'+
  '.option-description{margin:2px 0 5px;color:#536c85;white-space:pre-wrap;font-size:10px}'+
  'table{border-collapse:collapse;width:100%;table-layout:fixed;margin-top:5px;border:1px solid #c8d4e3;font-size:11px}'+
  'th{background:#0a468d;color:#fff;font-weight:700;font-size:10px;padding:6px 6px}'+
  'td{border-bottom:1px solid #d8e1eb;padding:5px 6px;vertical-align:top;overflow-wrap:anywhere;line-height:1.23}'+
  'th:first-child,td:first-child{width:52%;text-align:left}'+
  'th:nth-child(2),td:nth-child(2){width:12%}'+
  'th:nth-child(3),td:nth-child(3){width:19%}'+
  'th:nth-child(4),td:nth-child(4){width:17%}'+
  'tbody tr:nth-child(even){background:#f6f8fb}'+
  'thead{display:table-header-group}'+
  'tr{break-inside:avoid;page-break-inside:avoid}'+
  '.center{text-align:center}'+
  '.money{text-align:right;white-space:nowrap}'+
  '.totals{margin:7px 0 8px auto;max-width:300px;break-inside:avoid;page-break-inside:avoid}'+
  '.totals>div{display:flex;justify-content:space-between;gap:12px;padding:4px 10px;font-size:10.5px;background:#f0f4f8;border:1px solid #dbe4ed}'+
  '.totals .grand{background:#0c4a95;color:#fff;font-size:13px;border:1px solid #0c4a95;border-radius:0 0 5px 5px;font-weight:700;padding:6px 10px}'+
  '.totals .grand b{white-space:nowrap}'+
  '.quote-extras{display:grid;grid-template-columns:1fr 1fr;align-items:start;gap:9px;margin-top:7px}'+
  '.quote-extras.single{grid-template-columns:1fr}'+
  '.quote-extras>section{min-width:0;border:1px solid #dce7f3;border-radius:8px;background:#f7f9fc;padding:8px 10px;break-inside:avoid}'+
  '.quote-extras .section-title{margin:0 0 5px}'+
  '.conditions{display:grid;grid-template-columns:1fr;gap:4px;background:transparent;padding:0}'+
  '.conditions .datum{display:block}'+
  '.conditions .datum span{font-weight:700;display:inline;margin-right:5px}'+
  '.conditions .datum b{display:inline;font-weight:500}'+
  '.quote-extras .notes{margin:0;border-left:3px solid #1a71bb}'+
  '.notes p{margin:0;white-space:normal;overflow-wrap:anywhere;font-size:10.5px;line-height:1.35}'+
  '.signature{margin-top:8px;break-inside:avoid}'+
  '.signature img{max-width:185px;max-height:55px;object-fit:contain;display:block}'+
  '.signature b{display:block;font-size:10px;color:#22456e}'+
  '.footer{margin-top:9px;padding-top:6px;border-top:2px solid #1b6cbd;display:flex;justify-content:space-between;gap:12px;color:#264767;font-size:9px;break-inside:avoid;page-break-inside:avoid}'+
  '.footer span{display:block}'+
  '.footer strong{color:#0a397b}'+
  '@page{size:letter;margin:11mm}'+
  '@media print{body{padding:0;max-width:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.simoun-pdf-root{max-width:none}.top-accent{margin:-11px -13px 8px}h1,h2,h3{break-after:avoid}}'+
  '</style></head><body><main class="simoun-pdf-root simoun-quote-sheet"><div class="top-accent"></div>'+
  '<header class="brand-row"><div class="brand-left">'+logo+'</div><div class="brand-right"><b>Seguridad electrónica</b><small>Alarmas, cámaras, videoportero y cerca eléctrica para la seguridad de tu hogar y tu negocio.</small></div></header>'+
  '<div class="titlebar"><h1>COTIZACIÓN</h1><div class="rule"></div><div class="folio"><div><span>Folio:</span><b>'+clean(d.folio||'')+'</b></div><div><span>Fecha:</span><b>'+clean(fmt(d.date))+'</b></div></div></div>'+
  '<section><div class="section-title"><span class="section-icon">●</span><h2>Datos del cliente</h2><span class="title-rule"></span></div><div class="client-panel">'+rows+'</div></section>'+
  '<div class="section-title"><span class="section-icon">≡</span><h2>Detalle</h2><span class="title-rule"></span></div>'+
  options+extras+signature+
  '<footer class="footer"><span><strong>Dirección</strong><br>'+clean(address)+'</span><span><strong>WhatsApp / Teléfono</strong><br>'+clean(phone)+(s.email?'<br>'+clean(s.email):'')+'</span></footer>'+
  '</main></body></html>';
}
const docPublicHTMLBeforeBrandUpdate=docPublicHTML;
docPublicHTML=function(d,kind){
  return kind==='quote'?docQuoteHTML(d):docPublicHTMLBeforeBrandUpdate(d,kind);
};
