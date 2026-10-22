'use client';
import { useEffect, useId, useRef } from 'react';
export interface DialogRequest { message: string; kind: 'message'|'confirm'|'prompt'; defaultValue?: string; choices?:{label:string;value:string}[] }
export function AppDialog({request,onClose}:{request:DialogRequest;onClose:(value:string|null)=>void}){
 const ref=useRef<HTMLDialogElement>(null); const input=useRef<HTMLInputElement>(null); const id=useId();
 useEffect(()=>{ const previous=document.activeElement;const node=ref.current;node?.showModal();return()=>{node?.close();if(previous instanceof HTMLElement)previous.focus();};},[]);
 return <dialog ref={ref} aria-labelledby={id} onCancel={e=>{e.preventDefault();onClose(null);}} className="app-dialog">
  <form onSubmit={e=>{e.preventDefault();onClose(request.kind==='prompt'?input.current?.value??'':'yes');}}>
   <h2 id={id}>ImmoCalc</h2><p>{request.message}</p>
   {request.kind==='prompt'&&<label>Objektname<input ref={input} defaultValue={request.defaultValue} autoFocus/></label>}
   <div className="dialog-actions">{request.choices?.map(choice=><button type="button" key={choice.value} onClick={()=>onClose(choice.value)}>{choice.label}</button>)}{request.kind!=='message'&&<button type="button" onClick={()=>onClose(null)}>Abbrechen</button>}{!request.choices&&<button type="submit">{request.kind==='message'?'OK':'Bestätigen'}</button>}</div>
  </form>
 </dialog>;
}
