
const today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Mexico_City'});
const money=c=>(c/100).toLocaleString('es-MX',{style:'currency',currency:'MXN'});
const stages=['Pendiente de tramitar','En trámite','Requiere atención','Cancelada'];
const reasons=['Pendiente identificar el cargo o depósito','Falta factura','Falta emitir complemento','Falta recibir complemento','Diferencia de fecha','Diferencia de importe','Otro'];
const actions=['Tramitar cancelación','Revisar respuesta del SAT','Contactar al cliente','Vincular sustitución','Corregir complemento'];
const uuidPattern=/\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/ig;
const book=data=>JSON.parse(data.bankRegister||'{"docs":[],"cases":[]}');
const active=m=>!m.archived;
const balance=m=>m.credit+m.debit-m.invoices.filter(f=>f.status==='Vigente').reduce((sum,f)=>sum+f.allocated,0);
function catalog(data){
 const records=new Map(book(data).docs.map(d=>[d.uuid,d]));
 for(const m of data.movements.filter(active))for(const f of m.invoices){
  const key=f.uuid.toUpperCase();
  if(key&&!records.has(key))records.set(key,{...f,uuid:key,name:m.fiscalName,side:m.credit?'Emitida':'Recibida',kind:'invoice'});
  for(const p of f.complements){
   const id=p.uuid.toUpperCase();
   if(id&&!records.has(id))records.set(id,{...p,uuid:id,name:m.fiscalName,side:m.credit?'Emitida':'Recibida',kind:'payment',links:[]});
  }
 }
 return [...records.values()];
}
const used=(data,id)=>data.movements.filter(active).reduce((sum,m)=>sum+m.invoices.filter(f=>f.uuid.toUpperCase()===id&&f.status==='Vigente').reduce((n,f)=>n+f.allocated,0),0);
const closed=c=>c.stage==='Cancelada'&&!c.next;
function plus(days){const date=new Date(today()+'T12:00:00');date.setDate(date.getDate()+days);return date.toLocaleDateString('sv-SE')}
function pendingRows(data,period){
 const rows=[];
 for(const m of data.movements.filter(m=>active(m)&&m.period===period.id)){
  const rest=balance(m);
  if(rest||(!m.type&&!m.reviewed))rows.push([m.date,m.concept,rest?'Importe por vincular':'Observación',rest/100,m.notes]);
  for(const f of m.invoices.filter(f=>f.status==='Vigente')){
   if(f.method==='PPD'&&!f.complements.some(p=>!book(data).cases.some(c=>c.uuid===p.uuid.toUpperCase()&&c.stage==='Cancelada')))rows.push([m.date,f.folio||f.uuid,m.credit?'Falta emitir complemento':'Falta recibir complemento','',m.notes]);
   for(const p of f.complements)if(p.paymentDate&&p.paymentDate!==m.date)rows.push([m.date,p.uuid,'Revisar fecha de pago: '+p.paymentDate,'',m.notes]);
  }
 }
 for(const f of catalog(data).filter(f=>f.kind==='invoice'&&(f.date?.startsWith(period.month)||(!f.date&&f.importMonth===period.month))&&f.status!=='Cancelada')){
  const left=f.total-used(data,f.uuid);
  if(left||f.total==null)rows.push([f.date,f.folio||f.uuid,'Factura pendiente de vincular',f.total==null?'':left/100,f.note||'']);
 }
 for(const p of catalog(data).filter(f=>f.kind==='payment'&&f.status!=='Cancelada'&&(f.date?.startsWith(period.month)||f.importMonth===period.month))){
   if(!data.movements.filter(active).some(m=>m.invoices.some(f=>f.complements.some(c=>c.uuid.toUpperCase()===p.uuid))))rows.push([p.date,p.folio||p.uuid,'Complemento sin vincular','',p.note||'']);
 }
 for(const c of book(data).cases.filter(c=>!closed(c)))rows.push([c.next,c.uuid,c.action,'',c.note]);
 return rows.sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
}
export function addSheets(wb,data,period){
 const add=(name,headers,rows)=>{const s=wb.addWorksheet(name);s.addRow(headers);rows.forEach(row=>s.addRow(row));s.getRow(1).font={bold:true};s.views=[{state:'frozen',ySplit:1}];s.columns.forEach(col=>col.width=26)};
 const docs=catalog(data),moves=data.movements.filter(m=>m.period===period.id&&active(m));
 for(const side of ['Emitida','Recibida'])add('SAT '+side.toLowerCase()+'s',['Fecha','Nombre fiscal','CFDI interno','UUID','Tipo','Total','Aplicado','Pendiente','Nota'],docs.filter(f=>f.side===side&&(f.date?.startsWith(period.month)||f.importMonth===period.month||moves.some(m=>m.invoices.some(i=>i.uuid.toUpperCase()===f.uuid)))).map(f=>[f.date,f.name,f.folio,f.uuid,f.kind==='payment'?'Complemento':'Factura',f.total==null?'':f.total/100,used(data,f.uuid)/100,f.total==null?'':(f.total-used(data,f.uuid))/100,f.note]));
 add('Pagos y facturas SAT',['Complemento','Factura','Fecha pago','Parcialidad','Saldo anterior','Importe pagado','Saldo insoluto'],docs.flatMap(f=>(f.links||[]).filter(l=>l.paymentDate?.startsWith(period.month)||f.date?.startsWith(period.month)).map(l=>[f.uuid,l.invoiceUuid,l.paymentDate,l.partial,l.before,l.amount/100,l.after])));
 add('Pendientes por resolver',['Fecha','Referencia','Pendiente','Importe','Nota'],pendingRows(data,period));
 add('Cancelaciones y sustituciones',['UUID','Estado','Acción','Seguimiento','Sustituye con UUID','Nota','Fecha del cambio'],book(data).cases.flatMap(c=>c.history.filter(h=>h.on.startsWith(period.month)||(!closed(c)&&h===c.history.at(-1))).map(h=>[c.uuid,h.stage,h.action,h.next,h.replacement,h.note,h.on])));
}
async function pdfRows(file,side){
 const base=new URL('./',import.meta.url).href;
 const pdfjs=await import(base+'pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.mjs';
 const pdf=await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;
 let text='';
 try{for(let page=1;page<=pdf.numPages;page++){const p=await pdf.getPage(page);const content=await p.getTextContent();text+=content.items.map(i=>i.str||'').join(' ')+'\n'}}finally{await pdf.destroy()}
 const ids=[...text.matchAll(uuidPattern)];
 if(!ids.length)throw Error('El PDF no contiene UUID legibles. Usa el PDF con texto o el XML.');
 return ids.map((hit,i)=>{const part=text.slice(hit.index+36,ids[i+1]?.index??text.length);
 const date=part.match(/\b20\d\d-\d\d-\d\d\b/)?.[0]||'';
 const parties=[...part.matchAll(/\b[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}\b/g)];const party=parties[side==='Emitida'?1:0];const display=party?(part.slice(party.index+party[0].length).split(/\b(?:[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}|20\d{2}-\d\d-\d\d)\b|\$/)[0].trim().slice(0,120)):'';
 const amounts=[...part.matchAll(/\$\s*([\d,]+\.\d{2})/g)];
 return {uuid:hit[0].toUpperCase(),side,kind:'invoice',date,total:amounts.length===1?Math.round(Number(amounts[0][1].replaceAll(',',''))*100):null,folio:'',name:display,method:'',links:[]};});
}
export function Banking({R,data,save,period,selectPeriod,newPeriod,importBank,download,parseXML,newInvoice,legacy,busy,attach,error}){
 const h=R.createElement,[tab,tabTo]=R.useState('Movimientos'),[msg,tell]=R.useState(''),[side,setSide]=R.useState('Emitida'),[preview,setPreview]=R.useState([]),[query,search]=R.useState(''),[draft,edit]=R.useState(null);
 const reg=book(data),docs=catalog(data),moves=data.movements.filter(m=>active(m)&&m.period===period?.id);
 const btn=(label,fn,disabled=false)=>h('button',{type:'button',disabled:disabled||busy,onClick:()=>Promise.resolve().then(fn).catch(e=>tell(e.message))},label);
 const opt=(values,value,change)=>h('select',{value:value||'',onChange:e=>change(e.target.value)},values.map(x=>{const [v,l]=Array.isArray(x)?x:[x,x];return h('option',{value:v,key:v},l)}));
 const field=(label,el)=>h('label',null,label,el);
 const input=(value,change,type='text')=>h('input',{type,value:value??'',step:type==='number'?'.01':undefined,onChange:e=>change(e.target.value)});
 const change=(key,v)=>edit({...draft,[key]:v});
 const commit=async (patch,register=reg)=>{if(await save({...data,...patch,bankRegister:JSON.stringify(register)})){tell('Guardado');edit(null);return true}tell('No se guardó. Revisa tu conexión y vuelve a abrir el expediente si cambió en otra sesión.');return false};
 const card=(key,...kids)=>h('article',{key,className:'bank-card'},...kids);
 const doImport=async files=>{const batch=[];for(const file of files){if(file.size>20*1024*1024)throw Error('El archivo supera 20 MB.');
 if(/\.pdf$/i.test(file.name))batch.push(...await pdfRows(file,side));else{
 const raw=await file.text(),items=parseXML(raw,today()),xml=new DOMParser().parseFromString(raw,'application/xml'),related=Array.from(xml.getElementsByTagNameNS('*','DoctoRelacionado'));
 for(const [idx,item] of items.entries()){let f=batch.find(f=>f.uuid===item.uuid);if(!f){f={...item,side,name:(side==='Emitida'?item.receiver:item.issuer).name,links:[]};batch.push(f)}
 if(item.kind==='payment')f.links.push({...item,before:related[idx]?.getAttribute('ImpSaldoAnt'),after:related[idx]?.getAttribute('ImpSaldoInsoluto')});}
 }}
 setPreview(batch.map(row=>({...row,importMonth:period?.month||today().slice(0,7)})));tell('Revisa los datos leídos antes de confirmar.');};
 const file=(label,accept,onFiles,multiple=false)=>field(label,h('input',{type:'file',accept,multiple,disabled:busy,onChange:e=>{const files=Array.from(e.target.files);e.target.value='';if(files.length)Promise.resolve(onFiles(files)).catch(err=>tell(err.message))}}));
 const savePreview=async()=>{for(const row of preview){if(row.total!=null&&(!Number.isFinite(row.total)||row.total<0))throw Error('Revisa el importe del comprobante.');for(const l of row.links||[]){if(!l.invoiceUuid||!l.paymentDate||!(l.amount>0))throw Error('Completa factura, fecha e importe del pago relacionado.');}}const merged=new Map(reg.docs.map(f=>[f.uuid,f]));for(const row of preview){const prev=merged.get(row.uuid)||{};merged.set(row.uuid,{...prev,...Object.fromEntries(Object.entries(row).filter(([k,v])=>v!==null&&v!==''&&(!Array.isArray(v)||v.length))),uuid:row.uuid})}if(await commit({}, {...reg,docs:[...merged.values()]}))setPreview([])};
 const startCase=f=>{const c=reg.cases.find(c=>c.uuid===f.uuid);edit({mode:'case',uuid:f.uuid,stage:'Pendiente de tramitar',action:actions[0],next:today(),note:'',replacement:'',...c})};
 const saveCase=async()=>{const c={...draft};delete c.mode;
 if((c.stage!=='Cancelada'||c.action==='Vincular sustitución')&&!c.next)throw Error('Elige la fecha del siguiente seguimiento.');
 if(c.replacement&&(!new RegExp('^'+uuidPattern.source+'$','i').test(c.replacement)||c.replacement.toUpperCase()===c.uuid))throw Error('Revisa el UUID sustituto.');
 if(c.stage==='Cancelada'&&c.action!=='Vincular sustitución')c.next='';
 c.history=[...(c.history||[]),{on:today(),stage:c.stage,action:c.action,next:c.next,note:c.note,replacement:c.replacement,reason:c.reason}];
 if(c.stage==='Cancelada'&&c.action==='Vincular sustitución'&&!c.replacement&&!c.next)throw Error('Selecciona la fecha para vincular la sustitución.');
 const list=docs.map(f=>f.uuid===c.uuid?{...f,status:c.stage==='Cancelada'?'Cancelada':f.status}:f);
 const movements=data.movements.map(m=>({...m,invoices:m.invoices.map(f=>c.stage==='Cancelada'&&f.uuid.toUpperCase()===c.uuid?{...f,status:c.replacement?'Sustituida':'Cancelada',replacement:c.replacement}:f)}));
 await commit({movements},{...reg,docs:list,cases:[...reg.cases.filter(x=>x.uuid!==c.uuid),c]})};
 const link=async()=>{const m=moves.find(m=>m.id===draft.mid),f=docs.find(f=>f.uuid===draft.uuid),amount=Math.round(Number(draft.amount)*100);
 if(!m||!f||f.kind==='payment'||f.status==='Cancelada'||!(amount>0)||amount>balance(m)||f.total==null||amount>f.total-used(data,f.uuid))throw Error('Revisa el importe disponible del movimiento y de la factura.');
 const inv=structuredClone(m.invoices),existing=inv.find(i=>i.uuid.toUpperCase()===f.uuid&&i.status==='Vigente'),i=existing||{...newInvoice(),uuid:f.uuid,folio:f.folio||'',date:f.date||'',method:f.method||'',total:f.total};
 i.allocated+=amount;if(!existing)inv.push(i);
 await commit({movements:data.movements.map(x=>x.id===m.id?{...m,invoices:inv,fiscalName:m.fiscalName||f.name||''}:x)})};
 const applyPayment=async(m,i,f,l)=>{
  const movements=structuredClone(data.movements);
  const inv=movements.find(x=>x.id===m.id).invoices.find(x=>x.id===i.id);
  if(movements.some(x=>x.invoices.some(y=>y.complements.some(p=>p.xmlKey===l.key||p.notes==='SAT '+l.key))))throw Error('Esta parcialidad ya está vinculada.');
  inv.complements.push({id:crypto.randomUUID(),xmlKey:l.key,uuid:f.uuid,folio:f.folio||'',date:f.date,paymentDate:l.paymentDate,amount:l.amount,notes:'SAT '+l.key});
  await commit({movements});
 };
 const setDoc=(i,k,v)=>setPreview(preview.map((f,n)=>n===i?{...f,[k]:v}:f));
 const changeLink=(i,n,key,value)=>setDoc(i,'links',preview[i].links.map((l,j)=>j===n?{...l,[key]:value}:l));
 const caseCard=c=>card(c.uuid,h('strong',null,(docs.find(f=>f.uuid===c.uuid)?.folio||c.uuid)+' · '+c.stage),h('p',null,(c.next&&c.next<today()?'Vencido · ':'')+[c.next,c.action,c.note].filter(Boolean).join(' · ')),btn('Dar seguimiento',()=>startCase({uuid:c.uuid})));
 const calendar=location.hash==='#calendario';
 R.useEffect(()=>{if(window.parent===window)return;window.parent.postMessage({kind:'simoun-bank-agenda',items:reg.cases.filter(c=>!closed(c)&&c.next).map(c=>({id:c.uuid,date:c.next,label:c.action,name:docs.find(f=>f.uuid===c.uuid)?.folio||c.uuid}))},location.origin);return()=>window.parent.postMessage({kind:'simoun-bank-agenda',items:[]},location.origin)},[data]);
 R.useEffect(()=>{if(draft)document.querySelector('.bank h3')?.scrollIntoView({block:'nearest'})},[draft?.mode]);
 R.useEffect(()=>{const id=new URLSearchParams(location.search).get('seguimiento');if(id&&reg.cases.some(c=>c.uuid===id))startCase({uuid:id})},[]);
 const editor=draft&&card('editor',h('h3',null,draft.mode==='case'?'Seguimiento de cancelación':draft.mode==='link'?'Vincular factura':'Clasificar movimiento'),
 draft.mode==='case'?[
 field('Estado',opt(stages,draft.stage,v=>edit({...draft,stage:v,action:v==='Cancelada'?'Cerrar seguimiento':actions[stages.indexOf(v)],next:v==='Cancelada'?'':draft.next||today()}))),
 field('Próxima acción',opt([...actions,'Cerrar seguimiento'],draft.action,v=>change('action',v))),
 field('Fecha de seguimiento',input(draft.next,v=>change('next',v),'date')),
 ...[0,1,3].map((n,i)=>btn(['Hoy','Mañana','En 3 días'][i],()=>change('next',plus(n)))),
 field('Elegir sustituto registrado',opt([['','Seleccionar'],...docs.filter(f=>f.uuid!==draft.uuid).map(f=>[f.uuid,[f.folio,f.uuid].filter(Boolean).join(' · ')])],draft.replacement,v=>change('replacement',v))),field('UUID sustituto (opcional)',input(draft.replacement,v=>change('replacement',v))),
 field('Motivo',opt(['','Solicitud del cliente','Falta de pago','Error en el comprobante','Sustitución','Otro'],draft.reason,v=>change('reason',v))),field('Nota opcional',input(draft.note,v=>change('note',v))),btn('Guardar seguimiento',saveCase),
 draft.stage==='Cancelada'&&btn('Adjuntar acuse al periodo',()=>attach(period.id),!period),
 ...(draft.history||[]).map((h1,i)=>h('small',{key:i},[h1.on,h1.stage,h1.note].filter(Boolean).join(' · ')))
 ]:draft.mode==='link'?[
 field('Buscar por nombre, folio o UUID',input(draft.q||'',v=>change('q',v))),
 field('Factura',opt([['','Seleccionar'],...docs.filter(f=>f.kind!=='payment'&&f.status!=='Cancelada'&&[f.name,f.uuid,f.folio].join(' ').toLowerCase().includes((draft.q||'').toLowerCase())).sort((a,b)=>Number(b.side===draft.side)-Number(a.side===draft.side)).map(f=>[f.uuid,[f.name,f.folio,f.uuid].filter(Boolean).join(' · ')])],draft.uuid,v=>{const f=docs.find(f=>f.uuid===v);edit({...draft,uuid:v,amount:f?Math.max(0,Math.min(draft.rest,f.total-used(data,v)))/100:''})})),
 field('Importe aplicado',input(draft.amount,v=>change('amount',v),'number')),btn('Confirmar vínculo',link)
 ]:[field('Clasificación',opt(['','Compra','Gasto','Venta','Otro'],draft.type,v=>change('type',v))),field('Motivo de pendiente',opt(['',...reasons],draft.reason,v=>change('reason',v))),field(draft.type==='Otro'?'Especificar y anotar resolución':'Nota opcional',input(draft.note,v=>change('note',v))),btn('Guardar',()=>commit({movements:data.movements.map(m=>m.id===draft.mid?{...m,type:draft.type,notes:[draft.reason,draft.note].filter(Boolean).join(' · ')}:m)}))],btn('Cerrar',()=>edit(null)));
 return h('main',{className:'bank'},h('h1',null,calendar?'Seguimientos de conciliación':'Conciliación bancaria'),error&&h('p',{role:'alert'},error),msg&&h('p',{role:'status'},msg),editor,
 calendar?reg.cases.filter(c=>!closed(c)).map(caseCard):[
 h('div',{className:'bank-bar'},field('Cuenta y mes',opt([['','Elegir periodo'],...data.periods.map(p=>[p.id,p.name+' · '+p.month])],period?.id,selectPeriod)),btn('Nuevo periodo',newPeriod),btn('Excel para el contador',download,!period),btn('Expediente y adjuntos',legacy)),
 h('div',{className:'bank-bar'},...['Movimientos','Facturas SAT','Pendientes'].map(t=>btn(t,()=>{tabTo(t);edit(null)},t===tab))),
 tab==='Movimientos'?[period?file('Importar estado de cuenta Excel','.xlsx',files=>importBank(files[0])):h('p',null,'Crea o elige el periodo para importar el estado de cuenta.'),...moves.map(m=>card(m.id,h('strong',null,m.date+' · '+m.concept),h('p',null,[m.credit?'Ingreso':'Egreso',money(m.credit||m.debit),m.type,m.notes,'Por vincular '+money(balance(m))].filter(Boolean).join(' · ')),btn('Clasificar / nota',()=>edit({mode:'movement',mid:m.id,type:m.type,note:m.notes,reason:''})),btn('Vincular factura',()=>edit({mode:'link',mid:m.id,rest:balance(m),side:m.credit?'Emitida':'Recibida'}),balance(m)<=0),btn('Editar y adjuntar XML',()=>legacy(m)),...m.invoices.map(i=>card(i.id,[i.folio,i.uuid,money(i.allocated),i.status].join(' · '),...i.complements.map(p=>h('small',{key:p.id},'Complemento '+p.folio+' · '+p.paymentDate+' · '+money(p.amount))),...docs.filter(f=>f.kind==='payment'&&f.status!=='Cancelada').flatMap(f=>(f.links||[]).filter(l=>l.invoiceUuid.toUpperCase()===i.uuid.toUpperCase()&&!i.complements.some(p=>p.uuid===f.uuid&&p.paymentDate===l.paymentDate&&p.amount===l.amount)).map(l=>btn('Vincular pago '+(f.folio||f.uuid)+' · '+l.paymentDate+' · '+money(l.amount),()=>applyPayment(m,i,f,l))))))))]:
 tab==='Facturas SAT'?[field('Relación',opt(['Emitida','Recibida'],side,setSide)),file('Importar relación SAT en PDF o CFDI en XML','.pdf,.xml',doImport,true),
 ...preview.map((f,i)=>card('p'+i,h('b',null,f.uuid),field('Tipo',opt([['invoice','Factura'],['payment','Complemento']],f.kind,v=>setDoc(i,'kind',v))),field('Nombre fiscal',input(f.name,v=>setDoc(i,'name',v))),field('CFDI interno',input(f.folio,v=>setDoc(i,'folio',v))),field('Nota de resolución',input(f.note,v=>setDoc(i,'note',v))),field('Fecha de emisión',input(f.date,v=>setDoc(i,'date',v),'date')),field('Total MXN',input(f.total==null?'':f.total/100,v=>setDoc(i,'total',v===''?null:Math.round(Number(v)*100)),'number')),field('Método',opt(['','PUE','PPD'],f.method,v=>setDoc(i,'method',v))),f.kind==='payment'&&btn('Relacionar factura',()=>setDoc(i,'links',[...(f.links||[]),{key:crypto.randomUUID(),invoiceUuid:'',paymentDate:today(),amount:0,partial:'',before:'',after:''}])),...(f.links||[]).map((l,n)=>card(l.key,field('Factura relacionada',opt([['','Elegir'],...new Map([[l.invoiceUuid,l.invoiceUuid],...docs.filter(d=>d.kind==='invoice').map(d=>[d.uuid,(d.folio||'')+' '+d.uuid])]).entries()],l.invoiceUuid,v=>changeLink(i,n,'invoiceUuid',v))),field('Fecha de pago',input(l.paymentDate,v=>changeLink(i,n,'paymentDate',v),'date')),field('Importe pagado',input(l.amount/100,v=>changeLink(i,n,'amount',Math.round(Number(v)*100)),'number')),field('Parcialidad',input(l.partial,v=>changeLink(i,n,'partial',v))),field('Saldo anterior',input(l.before,v=>changeLink(i,n,'before',v),'number')),field('Saldo insoluto',input(l.after,v=>changeLink(i,n,'after',v),'number')),btn('Quitar relación',()=>setDoc(i,'links',f.links.filter((_,j)=>j!==n))))))),preview.length>0&&btn('Confirmar registros',savePreview),preview.length>0&&btn('Descartar vista previa',()=>setPreview([])),
 field('Buscar en todos los meses',input(query,search)),...docs.filter(f=>f.side===side&&[f.uuid,f.folio,f.name,f.date].join(' ').toLowerCase().includes(query.toLowerCase())).map(f=>card(f.uuid,h('b',null,[f.folio,f.name,f.kind==='payment'?'Complemento':'Factura'].filter(Boolean).join(' · ')),h('p',null,[f.date,f.uuid,f.total!=null?money(f.total):'Importe por revisar',f.status].filter(Boolean).join(' · ')),btn('Editar datos',()=>setPreview([{...f}])),btn('Cancelación / sustitución',()=>startCase(f)),...(f.links||[]).map(l=>h('p',{key:l.key},l.invoiceUuid+' · '+l.paymentDate+' · '+money(l.amount)))))]:
 [h('h3',null,'Cancelaciones de todos los meses'),...reg.cases.map(caseCard),h('h3',null,'Pendientes del periodo'),...(period?pendingRows(data,period):[]).map((row,i)=>card(i,row.filter(x=>x!=='').join(' · ')))]
 ]);
}
