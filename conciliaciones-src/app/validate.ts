import {z} from 'zod';
const str=z.string().max(10000),id=z.string().min(1).max(100),money=z.number().int().safe(),date=z.string().max(30);
const complement=z.object({xmlKey:str.optional(),id,folio:str,uuid:str,date,paymentDate:date,amount:money,notes:str});
const invoice=z.object({id,folio:str,uuid:str,date,due:date,total:money,allocated:money,method:z.enum(['','PUE','PPD']),status:z.enum(['Vigente','Cancelada','Sustituida']),replacement:str,notes:str,complements:z.array(complement).max(100)});
export const schema=z.object({periods:z.array(z.object({id,name:str,month:z.string().regex(/^\d{4}-\d{2}$/),opening:money,closing:money,currency:z.literal('MXN')})).max(500),clients:z.array(z.object({id,name:str,rfc:str,regime:str,usage:str,postal:str,address:str,email:str,phone:str,contact:str,notes:str})).max(5000),movements:z.array(z.object({archived:z.boolean().optional(),id,period:id,date,concept:str,reference:str,debit:money.min(0),credit:money.min(0),balance:money.nullable(),type:z.enum(['','Gasto','Compra','Venta','Traspaso','Otro']),clientId:str,fiscalName:str,notes:str,reviewed:z.boolean(),noReceipt:z.boolean(),invoices:z.array(invoice).max(100),fingerprint:str,source:str})).max(30000)});
export function validateData(input:unknown){
 const data=schema.parse(input), ids=new Set<string>();
 for(const item of [...data.periods,...data.clients,...data.movements]){if(ids.has(item.id))throw Error('Identificador duplicado');ids.add(item.id)}
 for(const m of data.movements){const p=data.periods.find(p=>p.id===m.period);if(!p||!m.date.startsWith(p.month)||!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||!!m.debit===!!m.credit)throw Error('Movimiento inválido');if(m.clientId&&!data.clients.some(c=>c.id===m.clientId))throw Error('Cliente inexistente')}
 return data;
}
