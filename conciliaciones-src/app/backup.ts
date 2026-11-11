import type {Data,Attachment} from './model';
export const documentPath=(f:Attachment)=>`Documentos/${f.entity}/${f.id}_${f.name.replace(/[^\p{L}\p{N}._-]/gu,'_')}`;
export async function fullBackup(data:Data,files:Attachment[],fetcher:typeof fetch=fetch){
 if(files.reduce((n,f)=>n+f.size,0)>250*1024*1024)throw Error('El respaldo supera 250 MB. Solicita dividirlo antes de migrar.');
 const {zipSync,strToU8}=await import('fflate');const entries:Record<string,Uint8Array>={'Respaldo_registros.json':strToU8(JSON.stringify({version:2,data,files},null,2))};
 for(const f of files){const r=await fetcher('/api/files?id='+encodeURIComponent(f.id));if(!r.ok)throw Error('No se pudo descargar '+f.name+'. No se generó un respaldo incompleto.');const b=new Uint8Array(await r.arrayBuffer());if(b.length!==f.size)throw Error('Tamaño inesperado en '+f.name);entries[documentPath(f)]=b}
 const b=zipSync(entries,{level:0}),u=URL.createObjectURL(new Blob([b as BlobPart],{type:'application/zip'})),a=document.createElement('a');a.href=u;a.download='Respaldo_completo_SIMOUN_'+new Date().toISOString().slice(0,10)+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(u),5000);
}
