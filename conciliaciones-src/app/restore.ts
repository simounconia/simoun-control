import {unzipSync,strFromU8} from 'fflate';
import {z} from 'zod';
import {validateData} from './validate';
import {documentPath} from './backup';
import type {Data,Attachment} from './model';
const attachment=z.object({id:z.string().uuid(),entity:z.string().min(1),name:z.string().min(1).max(200),kind:z.string().max(100),size:z.number().int().min(0).max(20971520),created:z.string().datetime()});
function canonical(v:any):string{if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';return JSON.stringify(v)}
export function prepareRestore(bytes:Uint8Array,current:Data,currentFiles:Attachment[]){
 if(bytes.length>270*1024*1024)throw Error('ZIP demasiado grande. Máximo 270 MB.');let size=0;
 const entries=unzipSync(bytes,{filter(f){size+=f.originalSize;if(size>270*1024*1024)throw Error('Contenido descomprimido demasiado grande.');return true}});
 const raw=entries['Respaldo_registros.json'];if(!raw||raw.length>15000000)throw Error('Falta un Respaldo_registros.json válido de SIMOUN.');
 const manifest=JSON.parse(strFromU8(raw));if(![1,2].includes(manifest.version))throw Error('Versión de respaldo no reconocida.');
 const incoming=validateData(manifest.version===2?manifest.data:{periods:[manifest.period],movements:manifest.movements,clients:manifest.clients});const files=z.array(attachment).max(50000).parse(manifest.files);
 const conflicts:string[]=[];let added=0;function merge<T extends {id:string}>(old:T[],fresh:T[],label:string){const map=new Map(old.map(x=>[x.id,x]));for(const x of fresh){const existing=map.get(x.id);if(existing&&canonical(existing)!==canonical(x))conflicts.push(`${label}: ${x.id}`);else if(!existing){map.set(x.id,x);added++}}return [...map.values()]}
 const data=validateData({periods:merge(current.periods,incoming.periods,'Cuenta'),clients:merge(current.clients,incoming.clients,'Cliente'),movements:merge(current.movements,incoming.movements,'Movimiento')});
 const ids=new Set([...data.periods,...data.clients,...data.movements].map(x=>x.id)),fileIds=new Set<string>(),uploads:{meta:Attachment;bytes:Uint8Array}[]=[];
 for(const f of files){if(fileIds.has(f.id))throw Error('ID de archivo repetido en el respaldo.');fileIds.add(f.id);if(!ids.has(f.entity))throw Error('Archivo sin registro relacionado: '+f.name);const b=entries[documentPath(f)];if(!b||b.length!==f.size)throw Error('Falta el archivo completo: '+f.name);const old=currentFiles.find(x=>x.id===f.id);if(old){if(old.entity!==f.entity||old.name!==f.name||old.size!==f.size)conflicts.push('Archivo: '+f.name)}else uploads.push({meta:f,bytes:b})}
 return {data,uploads,conflicts,added,periods:incoming.periods.length,movements:incoming.movements.length,clients:incoming.clients.length};
}
