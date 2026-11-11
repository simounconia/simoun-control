import {Movement,Invoice,Client,blankInvoice,blankComplement} from './model';
export type XmlItem={key:string;kind:'invoice'|'payment';folio:string;uuid:string;date:string;method:''|'PUE'|'PPD';total:number;invoiceUuid:string;invoiceFolio:string;paymentDate:string;amount:number;partial:string;issuer:{name:string;rfc:string};receiver:{name:string;rfc:string};selected:boolean};
const attr=(e:Element|null,k:string)=>e?.getAttribute(k)?.trim()||'';
const list=(e:Element|Document,ns:string,n:string)=>Array.from(e.getElementsByTagNameNS(ns,n));
function cents(v:string){if(!/^\d+(\.\d{1,6})?$/.test(v))throw Error('Importe XML inválido.');const n=Number(v);if(!Number.isFinite(n)||n>1e12)throw Error('Importe fuera de rango.');return Math.round(n*100)}
function uuid(v:string){if(!/^[\da-f]{8}-([\da-f]{4}-){3}[\da-f]{12}$/i.test(v))throw Error('Falta un UUID timbrado válido.');return v.toUpperCase()}
function date(v:string){const d=v.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error('Fecha XML inválida.');return d}
const folio=(e:Element)=>[attr(e,'Serie'),attr(e,'Folio')].filter(Boolean).join('');
export function parseCfdi(text:string,bankDate:string,Parser:typeof DOMParser=DOMParser):XmlItem[]{
 if(text.length>5*1024*1024)throw Error('El XML supera 5 MB para lectura automática.');if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('No se admiten declaraciones externas en el XML.');
 const doc=new Parser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('El archivo no es XML válido.');const root=doc.documentElement,ns=root.namespaceURI||'';
 if(root.localName!=='Comprobante'||!['http://www.sat.gob.mx/cfd/4','http://www.sat.gob.mx/cfd/3'].includes(ns))throw Error('Se requiere un CFDI 4.0 o 3.3.');
 const stamp=list(root,'http://www.sat.gob.mx/TimbreFiscalDigital','TimbreFiscalDigital')[0],em=list(root,ns,'Emisor')[0],re=list(root,ns,'Receptor')[0];
 const base={folio:folio(root),uuid:uuid(attr(stamp,'UUID')),date:date(attr(root,'Fecha')),issuer:{name:attr(em,'Nombre'),rfc:attr(em,'Rfc')},receiver:{name:attr(re,'Nombre'),rfc:attr(re,'Rfc')}};
 const type=attr(root,'TipoDeComprobante');
 if(type==='I'){if(attr(root,'Moneda')!=='MXN')throw Error('La lectura automática de importes solo admite MXN; captura manualmente la conversión.');const method=attr(root,'MetodoPago');if(!['PPD','PUE'].includes(method))throw Error('Método de pago no reconocido.');return [{...base,key:base.uuid,kind:'invoice',method:method as 'PUE'|'PPD',total:cents(attr(root,'Total')),invoiceUuid:'',invoiceFolio:'',paymentDate:'',amount:0,partial:'',selected:true}]}
 if(type!=='P')throw Error('La lectura automática admite facturas de ingreso y complementos de pago. Este XML se conserva como adjunto.');
 const rows:XmlItem[]=[];
 for(const pns of ['http://www.sat.gob.mx/Pagos20','http://www.sat.gob.mx/Pagos']){
  list(root,pns,'Pago').forEach((p,pi)=>{if(attr(p,'MonedaP')!=='MXN')throw Error('El pago no está en MXN. Conserva el XML y captura la conversión manualmente.');const paymentDate=date(attr(p,'FechaPago'));
   list(p,pns,'DoctoRelacionado').forEach((dr,di)=>{if(attr(dr,'MonedaDR')!=='MXN')throw Error('Una factura relacionada no está en MXN; requiere revisión manual.');const inv=uuid(attr(dr,'IdDocumento'));rows.push({...base,key:base.uuid+':'+pns+':'+pi+':'+di,kind:'payment',method:'PPD',total:0,invoiceUuid:inv,invoiceFolio:folio(dr),paymentDate,amount:cents(attr(dr,'ImpPagado')),partial:attr(dr,'NumParcialidad'),selected:paymentDate===bankDate})})
  })
 }
 if(!rows.length)throw Error('No se encontraron documentos relacionados en el complemento.');return rows;
}
export function applyCfdi(original:Movement,items:XmlItem[],clients:Client[]){const m=structuredClone(original);const warnings:string[]=[];let applied=0;
 for(const row of items.filter(r=>r.selected)){
 const party=m.credit?row.receiver:row.issuer;if(!m.fiscalName){m.fiscalName=party.name;const client=clients.find(c=>c.rfc.toUpperCase()===party.rfc.toUpperCase()&&c.rfc);if(client)m.clientId=client.id}
 if(row.kind==='invoice'){
 let i=m.invoices.find(i=>i.uuid.toUpperCase()===row.uuid);if(!i)i=m.invoices.find(i=>!i.uuid&&i.folio===row.folio&&row.folio);if(!i){i=blankInvoice();m.invoices.push(i)}
 i.uuid=row.uuid;i.folio=i.folio||row.folio;i.date=row.date;i.method=row.method;i.total=row.total;
 if(!i.allocated){const remaining=m.credit+m.debit-m.invoices.filter(x=>x.id!==i!.id&&x.status==='Vigente').reduce((s,x)=>s+x.allocated,0);const paymentAmount=i.complements.reduce((s,c)=>s+c.amount,0);if(paymentAmount&&paymentAmount<=remaining&&paymentAmount<=i.total)i.allocated=paymentAmount;else if(row.total===remaining)i.allocated=row.total;else warnings.push('Revisa el importe aplicado: la factura y el movimiento tienen importes distintos.')}
 applied++;continue;
 }
 let i=m.invoices.find(i=>i.uuid.toUpperCase()===row.invoiceUuid);if(!i){i={...blankInvoice(),uuid:row.invoiceUuid,folio:row.invoiceFolio,method:'PPD'};m.invoices.push(i);warnings.push('Falta el XML de la factura relacionada. No se infiere su fecha ni su total a partir del complemento.')}
 const key=row.uuid+'|'+row.paymentDate+'|'+row.partial;
 let c=i.complements.find(c=>c.xmlKey===key||(!c.xmlKey&&c.uuid.toUpperCase()===row.uuid&&c.paymentDate===row.paymentDate));if(!c){c=blankComplement();i.complements.push(c)}
 c.xmlKey=key;c.folio=c.folio||row.folio;c.uuid=row.uuid;c.date=row.date;c.paymentDate=row.paymentDate;c.amount=row.amount;c.notes=c.notes||('Parcialidad '+(row.partial||'no indicada'));
 if(i.total>0&&!i.allocated){const sum=i.complements.reduce((s,c)=>s+c.amount,0),remaining=m.credit+m.debit-m.invoices.filter(x=>x.id!==i!.id&&x.status==='Vigente').reduce((s,x)=>s+x.allocated,0);if(sum<=i.total&&sum<=remaining)i.allocated=sum}
 if(row.paymentDate!==m.date)warnings.push('La fecha del pago difiere de la fecha bancaria; revisa la relación.');applied++;
 }
 return {movement:m,warnings:[...new Set(warnings)],applied};
}
