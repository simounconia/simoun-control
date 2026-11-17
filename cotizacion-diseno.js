/* Plantilla 3 SIMOUN: cotizacion ejecutiva. Las remisiones conservan su diseño. */
function docQuoteHTML(d){
  const c=d.client||{}, s=d.simoun||{}, t=d.terms||{};
  const clean=v=>esc(String(v==null?'':v));
  const has=v=>String(v==null?'':v).trim().length>0;
  const address=s.address||'Blvd. García de León 777, Chapultepec Sur, 58260 Morelia, Mich.';
  const phone=s.whatsapp||s.phone||'443 489 2474';
  const line=(label,value)=>has(value)?'<div class="datum"><span>'+clean(label)+'</span><b>'+clean(value)+'</b></div>':'';
  const rows=[
    line('Nombre / empresa',c.name),
    line('Atención a',c.contact),
    line('Domicilio',c.address),
    line('Teléfono',c.phone),
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
  const notes=has(d.notes)?'<section class="notes"><h2>Notas</h2><p>'+clean(d.notes).replace(/\n/g,'<br>')+'</p></section>':'';
  const signature=d.includeSignature&&d.signatureImage?
    '<section class="signature"><img src="'+d.signatureImage+'" alt="Firma administrativa"><b>Jessica Pimentel G.R - Administrativo</b></section>':'';
  const logo=typeof SIMOUN_LOGO_DATA==='string'?'<img class="brand-logo" src="'+SIMOUN_LOGO_DATA+'" alt="Logo SIMOUN">':'<strong class="brand-fallback">SIMOUN</strong>';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+clean(docFilename(d))+'</title>'+
  '<style>'+
  '*{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#fff;color:#202c3e;font:12px Arial,Helvetica,sans-serif;line-height:1.47;max-width:840px;margin:0 auto;padding:24px 28px}'+
  '.top-accent{height:6px;background:linear-gradient(90deg,#0a3677,#1683dc);margin:-24px -28px 21px}'+
  '.brand-row{display:flex;align-items:center;gap:22px;justify-content:space-between}.brand-left{width:51%;max-width:380px}.brand-logo{width:100%;max-height:115px;object-fit:contain;object-position:left center}.brand-fallback{font-size:32px;color:#073a85}.brand-right{border-left:2px solid #b7c4d4;padding-left:21px;flex:1;color:#16385e}.brand-right b{font-size:17px;color:#0a306c}.brand-right small{display:block;margin-top:5px;color:#667789;font-size:11px}'+
  '.titlebar{display:flex;justify-content:space-between;align-items:center;gap:14px;margin:24px 0 21px}.titlebar h1{font-size:29px;letter-spacing:.6px;margin:0;font-weight:800;color:#0b2d60}.titlebar .rule{height:2px;background:#2580ca;flex:1}.folio{background:#eef3f8;border-radius:10px;padding:9px 12px;min-width:156px;font-size:11px}.folio div{display:flex;gap:9px;justify-content:space-between}.folio span{color:#5d7186}.folio b{color:#173f70}'+
  '.section-title{display:flex;align-items:center;gap:9px;margin:18px 0 9px;page-break-after:avoid;break-after:avoid}.section-icon{width:28px;height:28px;background:#0a4b96;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;color:white;font-size:15px;font-weight:800}.section-title h2{font-size:17px;margin:0;color:#123c76}.section-title .title-rule{height:2px;background:#1c73bf;flex:1}'+
  '.client-panel{background:#f3f6f9;border-radius:9px;padding:11px 15px;display:grid;grid-template-columns:1fr 1fr;column-gap:19px;row-gap:5px}.datum{display:flex;gap:8px;align-items:baseline;min-width:0;font-size:11px;overflow-wrap:anywhere}.datum span{font-weight:700;color:#41627f;white-space:nowrap}.datum b{font-weight:500;color:#253343}.datum:has(span:first-child:last-child){grid-column:auto}.client-panel .datum:has(b){break-inside:avoid}'+
  '.quote-option{margin-top:11px}.quote-option h3{color:#0b4a90;margin:14px 0 3px;font-size:14px}.option-description{margin:2px 0 10px;color:#536c85;white-space:pre-wrap}'+
  'table{border-collapse:collapse;width:100%;table-layout:fixed;margin-top:9px;border:1px solid #c8d4e3}th{background:#0a468d;color:#fff;font-weight:700;font-size:11px;padding:10px 8px}td{border-bottom:1px solid #d8e1eb;padding:9px 8px;vertical-align:top;overflow-wrap:anywhere}th:first-child,td:first-child{width:49%;text-align:left}th:nth-child(2),td:nth-child(2){width:13%}th:nth-child(3),td:nth-child(3){width:20%}th:nth-child(4),td:nth-child(4){width:18%}tbody tr:nth-child(even){background:#f6f8fb}thead{display:table-header-group}tr{break-inside:avoid;page-break-inside:avoid}.center{text-align:center}.money{text-align:right;white-space:nowrap}'+
  '.totals{margin:12px 0 17px auto;max-width:330px;break-inside:avoid;page-break-inside:avoid}.totals>div{display:flex;justify-content:space-between;gap:12px;padding:7px 12px;font-size:12px;background:#f0f4f8;border:1px solid #dbe4ed}.totals .grand{background:#0c4a95;color:#fff;font-size:16px;border:1px solid #0c4a95;border-radius:0 0 6px 6px;font-weight:700;padding:9px 12px}.totals .grand b{white-space:nowrap}'+
  '.conditions{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;padding:11px 14px;background:#f3f6f9;border-radius:9px}.conditions .datum{display:block}.conditions .datum span{display:block;margin-bottom:3px}.conditions .datum b{display:block}'+
  '.notes{margin-top:14px;background:#f7f9fb;border-left:3px solid #1a71bb;padding:9px 13px;break-inside:avoid}.notes h2{font-size:13px;margin:0 0 3px;color:#1c4d82}.notes p{margin:0;white-space:normal;overflow-wrap:anywhere}'+
  '.signature{margin-top:18px;break-inside:avoid}.signature img{max-width:215px;max-height:78px;object-fit:contain;display:block}.signature b{display:block;font-size:11px;color:#22456e}'+
  '.footer{margin-top:24px;padding-top:12px;border-top:2px solid #1b6cbd;display:flex;justify-content:space-between;gap:24px;color:#264767;font-size:10px;break-inside:avoid;page-break-inside:avoid}.footer span{display:block}.footer strong{color:#0a397b}'+
  '@page{size:letter;margin:13mm} @media print{body{padding:0;max-width:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.top-accent{margin:0 0 21px}h1,h2,h3{break-after:avoid}}'+
  '</style></head><body><div class="top-accent"></div>'+
  '<header class="brand-row"><div class="brand-left">'+logo+'</div><div class="brand-right"><b>SIMOUN · Control Operativo</b><small>Alarmas, cámaras, videoportero y cerca eléctrica para la seguridad de tu hogar y tu negocio.</small></div></header>'+
  '<div class="titlebar"><h1>COTIZACIÓN</h1><div class="rule"></div><div class="folio"><div><span>Folio:</span><b>'+clean(d.folio||'')+'</b></div><div><span>Fecha:</span><b>'+clean(fmt(d.date))+'</b></div></div></div>'+
  '<section><div class="section-title"><span class="section-icon">●</span><h2>Datos del cliente</h2><span class="title-rule"></span></div><div class="client-panel">'+rows+'</div></section>'+
  '<div class="section-title"><span class="section-icon">≡</span><h2>Detalle</h2><span class="title-rule"></span></div>'+
  options+(terms?'<section><div class="section-title"><span class="section-icon">✓</span><h2>Condiciones</h2><span class="title-rule"></span></div><div class="conditions">'+terms+'</div></section>':'')+notes+signature+
  '<footer class="footer"><span><strong>Dirección</strong><br>'+clean(address)+'</span><span><strong>WhatsApp / Teléfono</strong><br>'+clean(phone)+(s.email?'<br>'+clean(s.email):'')+'</span></footer>'+
  '</body></html>';
}
const docPublicHTMLBeforeBrandUpdate=docPublicHTML;
docPublicHTML=function(d,kind){
  return kind==='quote'?docQuoteHTML(d):docPublicHTMLBeforeBrandUpdate(d,kind);
};
