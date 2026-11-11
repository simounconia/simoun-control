import {Movement} from './model';
const norm=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
export function bankKey(m:Movement){return JSON.stringify([m.period,m.date,norm(m.concept),norm(m.reference),m.debit,m.credit])}
export function duplicateGroups(ms:Movement[]){const map=new Map<string,Movement[]>();for(const m of ms.filter(m=>!m.archived)){const key=bankKey(m);map.set(key,[...(map.get(key)||[]),m])}return [...map.values()].filter(g=>g.length>1)}
export function saveMovement(ms:Movement[],draft:Movement,editingId:string|null){if(editingId){if(draft.id!==editingId||ms.filter(m=>m.id===editingId).length!==1)throw Error('El movimiento original no coincide. Recarga antes de guardar; no se creará una copia.');return ms.map(m=>m.id===editingId?{...draft,id:editingId,fingerprint:m.fingerprint,source:m.source}:m)}if(ms.some(m=>m.id===draft.id))throw Error('Este movimiento ya fue guardado. Cierra y vuelve a abrirlo para editar.');return [...ms,draft]}
