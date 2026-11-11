import {createClient} from '@supabase/supabase-js';
import {validateData} from './validate';
import type {Attachment} from './model';
export const ACCOUNT='simoun.con.ia@gmail.com';
export const sb=createClient('https://jpnexyvpoeyzqrrdixln.supabase.co','sb_publishable_VUVaAzr3uC_4c0sFR18qCA_SlBMMm97',{auth:{storageKey:'simoun-conciliaciones-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const bucket='simoun-conciliaciones';
const message=(e:any)=>e?.message||'No se pudo completar la operación.';
export async function loadData(){const {data,error}=await sb.from('simoun_recon_state').select('data,version').eq('id','principal').single();if(error||!data)throw Error('No tienes acceso al expediente o la sesión venció. Vuelve a entrar.');return data}
export async function saveData(input:any){const data=validateData(input.data);if(input.editMovementId){const current=await loadData();if(current.version!==input.version)throw Error('El expediente cambió. Recarga antes de guardar.');const oldIds=current.data.movements.map((x:any)=>x.id).sort(),newIds=data.movements.map(x=>x.id).sort();if(!oldIds.includes(input.editMovementId)||JSON.stringify(oldIds)!==JSON.stringify(newIds))throw Error('Editar debe conservar los mismos movimientos.');}
 const {data:row,error}=await sb.from('simoun_recon_state').update({data,version:input.version+1}).eq('id','principal').eq('version',input.version).select('version').maybeSingle();if(error)throw Error(message(error));if(!row)throw Error('Hay cambios en otra pestaña. Recarga antes de continuar; tus cambios no se guardaron.');return row;
}
export async function listFiles():Promise<Attachment[]>{const all:Attachment[]=[];for(let start=0;;start+=1000){const {data,error}=await sb.from('simoun_recon_files').select('*').order('id').range(start,start+999);if(error)throw Error(message(error));all.push(...data);if(data.length<1000)return all}}
export async function uploadFile(file:File,entity:string,kind:string,id:string=crypto.randomUUID(),created=new Date().toISOString()){
 if(file.size>20*1024*1024||! /\.(pdf|xml|png|jpe?g|webp|xlsx)$/i.test(file.name))throw Error('Elige PDF, XML, imagen o XLSX de hasta 20 MB.');
 const current=await loadData();if(![...current.data.periods,...current.data.movements,...current.data.clients].some((x:any)=>x.id===entity))throw Error('Guarda primero el registro.');
 const f={id,entity,name:file.name.replace(/[\r\n/\\]/g,'_').slice(0,200),size:file.size,kind:kind.slice(0,100),created};
 const {error}=await sb.storage.from(bucket).upload(id,file,{contentType:'application/octet-stream',upsert:false});
 if(error){ // A previous interrupted import may have uploaded the object before its metadata.
  const {data:prior,error:readError}=await sb.storage.from(bucket).download(id);
  if(readError||!prior||prior.size!==file.size||await digest(prior)!==await digest(file))throw Error(message(error));
 }
 const {error:metaError}=await sb.from('simoun_recon_files').insert(f);if(metaError)throw Error('El archivo se subió, pero falta registrar sus datos. Reintenta la importación. '+message(metaError));return f;
}
async function digest(blob:Blob){const b=await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());return Array.from(new Uint8Array(b)).join(',')}
export async function fileBlob(id:string){const {data,error}=await sb.storage.from(bucket).download(id);if(error||!data)throw Error('No se pudo descargar el adjunto.');return data}
export async function downloadFile(f:Attachment){const b=await fileBlob(f.id),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),5000)}
export async function apiFetch(url:string,options?:RequestInit):Promise<Response>{try{
 const u=new URL(url,'https://local.invalid');let result:any;
 if(u.pathname==='/api/data'){result=options?.method==='PUT'?await saveData(JSON.parse(String(options.body))):await loadData()}
 else if(u.pathname==='/api/files'&&u.searchParams.has('id'))return new Response(await fileBlob(u.searchParams.get('id')!));
 else if(u.pathname==='/api/files'&&options?.method==='POST'){const f=options.body as FormData;result=await uploadFile(f.get('file') as File,String(f.get('entity')),String(f.get('kind')))}
 else if(u.pathname==='/api/files')result=await listFiles();else throw Error('Ruta no encontrada');
 return Response.json(result);
 }catch(e){return Response.json({error:message(e)},{status:400})}}
