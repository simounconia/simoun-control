import {h,render} from './vendor/preact.js';
import {useState,useEffect} from './vendor/hooks.js';
import {Banking,addSheets} from './pantalla.js';

const R={createElement:h,useState,useEffect};
const localDay=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Mexico_City'});
const id=()=>crypto.randomUUID();
const norm=s=>String(s??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let loaded=null,loading=null,owner='',generation=0,requestedCase='';
const api=()=>window.SimounSync;
function agenda(data){
 const reg=JSON.parse(data?.bankRegister||'{"docs":[],"cases":[]}');
 bankAgenda=reg.cases.filter(c=>c.next).map(c=>({id:c.uuid,date:c.next,label:c.action,name:reg.docs.find(f=>f.uuid===c.uuid)?.folio||c.uuid}));
 renderCalendar();
}
function clear(){generation++;loaded=null;loading=null;owner='';requestedCase='';agenda(null);render(null,document.getElementById('banco'));}
window.clearOperatingBank=clear;
window.openOperatingBank=async function(caseId=''){
 if(caseId)requestedCase=caseId;
 const root=document.getElementById('banco');
 if(!api()?.loggedIn()||!api()?.isAdmin()){
   if(owner)clear();
   render(h('div',{class:'card'},h('h2',null,'Conciliación bancaria'),h('p',null,'Entra con la cuenta administrativa de Control Operativo.'),h('button',{class:'btn',onClick:()=>api().openSettings()},'Acceso SIMOUN'),h('button',{class:'btn secondary',onClick:()=>window.openOperatingBank()},'Actualizar acceso')),root);return;
 }
 if(owner!==api().currentEmail()){clear();owner=api().currentEmail();requestedCase=caseId;}
 const epoch=generation;
 try{
 if(!loaded){loading||=api().readOperatingBank();const row=await loading;if(epoch!==generation)return;loaded=row;}
 agenda(loaded.data);render(h(App,{key:requestedCase||owner,caseId:requestedCase}),root);
 }catch(e){if(epoch!==generation)return;loading=null;render(h('div',{class:'card'},'No se pudo cargar la conciliación. ',h('button',{class:'btn',onClick:()=>window.openOperatingBank()},'Reintentar')),root)}
};
function newInvoice(){return {id:id(),allocated:0,status:'Vigente',notes:'',replacement:'',complements:[]};}
function cents(v){const n=Number(String(v??'').replace(/[$,\s]/g,''));if(!Number.isFinite(n))throw Error('Importe inválido.');return Math.round(n*100);}
function bankDate(v){if(v instanceof Date)return v.toISOString().slice(0,10);
 if(typeof v==='number')return new Date(Date.UTC(1899,11,30)+Math.round(v)*86400000).toISOString().slice(0,10);
 let s=String(v??'').trim().replace(/^(\d{2})\/(\d{2})\/(\d{4})$/,'$3-$2-$1');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error('Fecha inválida');return s;
}
let excelLoad;
async function excel(){if(!window.ExcelJS){excelLoad||=new Promise((ok,fail)=>{const tag=document.createElement('script');tag.src=new URL('./vendor/excel.js',import.meta.url);tag.onload=ok;tag.onerror=()=>{excelLoad=null;fail(Error('No se pudo cargar Excel.'))};document.head.append(tag)});await excelLoad}return new window.ExcelJS.Workbook()}
export async function readBank(file,period,existing){
 if(file.size>20*1024*1024)throw Error('El máximo es 20 MB por archivo.');
 const wb=await excel();await wb.xlsx.load(await file.arrayBuffer());
 const sheet=wb.worksheets.find(s=>s.getRow(1).values.some(x=>norm(x)==='fecha'));if(!sheet)throw Error('Falta el encabezado Fecha.');
 const headers=sheet.getRow(1).values.map(norm);
 const cols=[['fecha'],['nombre del movimiento','movimiento','concepto','descripcion'],['ingreso','abono'],['egreso','cargo'],['saldo']].map(names=>headers.findIndex(n=>names.includes(n)));
 if(cols.some(c=>c<1))throw Error('Se requieren Fecha, Nombre del movimiento, Ingreso, Egreso y Saldo.');
 const rows=[],seen=new Set(existing.filter(m=>m.period===period.id).map(m=>m.fingerprint));
 sheet.eachRow((row,n)=>{if(n===1)return;try{let [date,title,credit,debit,balance]=cols.map(c=>{const v=row.getCell(c).value;return v?.result??v});
 if(![date,title,credit,debit,balance].some(v=>v!=null&&v!==''))return;
 date=bankDate(date);credit=cents(credit);debit=cents(debit);
 if(!date.startsWith(period.month)||!String(title??'').trim()||credit<0||debit<0||!!credit===!!debit)throw Error('Revisa mes, concepto e importes.');
 balance=balance==null||balance===''?null:cents(balance);const fingerprint=JSON.stringify([date,title,credit,debit,balance]);
 rows.push({id:id(),period:period.id,date,concept:String(title).trim(),credit,debit,balance,fingerprint,selected:!seen.has(fingerprint),duplicate:seen.has(fingerprint),invoices:[],type:'',notes:''});seen.add(fingerprint)
 }catch(e){throw Error('Fila '+n+' · '+e.message)}});
 if(!rows.length)throw Error('La hoja no contiene movimientos.');return rows
}
export function parseXML(text){
 const xml=new DOMParser().parseFromString(text,'application/xml'),root=xml.documentElement;
 if(root.localName!=='Comprobante'||xml.getElementsByTagName('parsererror').length)throw Error('XML de CFDI inválido.');
 const nodes=(p,n)=>Array.from(p.getElementsByTagNameNS('*',n)),attr=(p,k)=>p?.getAttribute(k)||'';
 const uuid=attr(nodes(root,'TimbreFiscalDigital')[0],'UUID').toUpperCase();
 if(!/^[\dA-F]{8}(?:-[\dA-F]{4}){3}-[\dA-F]{12}$/.test(uuid))throw Error('Falta un UUID válido.');
 const party=n=>({name:attr(nodes(root,n)[0],'Nombre'),rfc:attr(nodes(root,n)[0],'Rfc')});
 const base={uuid,folio:attr(root,'Serie')+attr(root,'Folio'),date:attr(root,'Fecha').slice(0,10),issuer:party('Emisor'),receiver:party('Receptor'),method:attr(root,'MetodoPago')};
 if(attr(root,'TipoDeComprobante')!=='P'){
 if(attr(root,'Moneda')!=='MXN')throw Error('Se requiere revisar la conversión a MXN.');return [{...base,kind:'invoice',total:cents(attr(root,'Total'))}];}
 const all=nodes(root,'Pago').flatMap((p,i)=>nodes(p,'DoctoRelacionado').map((d,j)=>{if(attr(d,'MonedaDR')!=='MXN'||attr(p,'MonedaP')!=='MXN')throw Error('Revisa la moneda del pago.');
 return {...base,kind:'payment',key:uuid+':'+i+':'+j,invoiceUuid:attr(d,'IdDocumento').toUpperCase(),paymentDate:attr(p,'FechaPago').slice(0,10),amount:cents(attr(d,'ImpPagado')),partial:attr(d,'NumParcialidad')};}));
 if(!all.length)throw Error('El complemento no tiene facturas relacionadas.');return all
}
async function exportMonth(data,period){
 const wb=await excel(),s=wb.addWorksheet('Conciliación bancaria');
 s.addRow(['Fecha','Nombre del movimiento','Ingreso','Egreso','Saldo','Clasificación','Cliente','Nota','CFDI internos','UUID','Importe vinculado','Por vincular']);
 const links=wb.addWorksheet('Vínculos bancarios');links.addRow(['Fecha banco','Movimiento','CFDI interno','UUID','Aplicado','Estado','Complementos']);
 for(const m of data.movements.filter(m=>m.period===period.id).sort((a,b)=>a.date.localeCompare(b.date))){
 const sum=m.invoices.filter(f=>f.status==='Vigente').reduce((v,f)=>v+f.allocated,0);
 s.addRow([m.date,m.concept,m.credit/100,m.debit/100,m.balance==null?'':m.balance/100,m.type,m.fiscalName,m.notes,m.invoices.map(f=>f.folio).join(', '),m.invoices.map(f=>f.uuid).join(', '),sum/100,(m.credit+m.debit-sum)/100]);
 m.invoices.forEach(f=>links.addRow([m.date,m.concept,f.folio,f.uuid,f.allocated/100,f.status,f.complements.map(p=>p.uuid).join(', ')]));}
 addSheets(wb,data,period);wb.eachSheet(s=>{s.columns.forEach(c=>c.width=24);s.getRow(1).font={bold:true};s.views=[{state:'frozen',ySplit:1}]});
 const url=URL.createObjectURL(new Blob([await wb.xlsx.writeBuffer()]));const a=document.createElement('a');a.href=url;a.download='SIMOUN-conciliacion-'+period.month+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)
}
function App({caseId}){
 const [row,setRow]=useState(loaded),[selected,choose]=useState(row.data.periods.at(-1)?.id||''),[panel,setPanel]=useState(''),[rows,setRows]=useState([]),[error,tell]=useState(''),[busy,setBusy]=useState(false);
 const data=row.data,period=data.periods.find(p=>p.id===selected),epoch=generation;
 const save=async next=>{setBusy(true);try{const updated=await api().writeOperatingBank(row.revision,next);if(epoch!==generation)return false;loaded=updated;setRow(updated);agenda(next);tell('');return true}catch(e){tell(e.message);return false}finally{setBusy(false)}};
 const button=(label,fn)=>h('button',{type:'button',class:'btn secondary',disabled:busy,onClick:fn},label);
 const addPeriod=async e=>{e.preventDefault();const f=new FormData(e.currentTarget),name=f.get('name').trim(),month=f.get('month');if(!name)return;const old=data.periods.find(p=>p.month===month&&norm(p.name)===norm(name));if(old){choose(old.id);setPanel('');return}const p={id:id(),name,month};if(await save({...data,periods:[...data.periods,p]})){choose(p.id);setPanel('')}};
 return h('div',null,error&&h('div',{class:'notice',role:'alert'},error,button('Volver a cargar',()=>{loaded=null;loading=null;generation++;render(null,document.getElementById('banco'));window.openOperatingBank()})),
 panel==='period'&&h('form',{class:'card bank-panel',onSubmit:addPeriod},h('h3',null,'Nuevo periodo'),h('label',null,'Cuenta',h('input',{name:'name',list:'bank-accounts',required:true})),h('datalist',{id:'bank-accounts'},[...new Set(data.periods.map(p=>p.name))].map(n=>h('option',{value:n}))),h('label',null,'Mes',h('input',{type:'month',name:'month',value:localDay().slice(0,7),required:true})),h('button',{class:'btn',disabled:busy},'Guardar periodo'),button('Cerrar',()=>setPanel(''))),
 panel==='import'&&h('div',{class:'card bank-panel'},h('h3',null,'Revisar estado de cuenta'),h('div',{style:'max-height:40vh;overflow:auto'},rows.map((m,i)=>h('label',{key:m.id},h('input',{type:'checkbox',checked:m.selected,onChange:e=>setRows(rows.map((x,j)=>i===j?{...x,selected:e.target.checked}:x))}),m.date+' · '+m.concept+' · '+(m.credit?'Ingreso ':'Egreso ')+(m.credit||m.debit)/100+(m.duplicate?' · Posible duplicado':'')))),button('Confirmar importación',async()=>{if(await save({...data,movements:[...data.movements,...rows.filter(r=>r.selected).map(({selected,duplicate,...m})=>m)]})){setPanel('');setRows([])}}),button('Cancelar',()=>setPanel(''))),
 h(Banking,{R,data,save,period,selectPeriod:p=>{setPanel('');setRows([]);choose(p)},newPeriod:()=>setPanel('period'),importBank:async file=>{setRows(await readBank(file,period,data.movements));setPanel('import');document.getElementById('banco').scrollIntoView({block:'start'})},download:()=>exportMonth(data,period),parseXML,newInvoice,busy,caseId,clients:state.clients||[],attachProof:async(file)=>{if(file.size>10*1024*1024)throw Error('Máximo 10 MB.');const key=id();await api().uploadDocument(key,file,file.name);return{id:key,name:file.name}},openProof:async p=>{const blob=await api().downloadDocument(p.id,p.name);if(!blob)throw Error('No se pudo abrir el acuse.');const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=p.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000)}}))
}
