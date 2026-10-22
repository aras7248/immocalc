'use client';
import { useRef, useState } from 'react';
import type { DialogRequest } from '@/components/immocalc/AppDialog';
export function useAppDialog(){
 const [request,setRequest]=useState<DialogRequest|null>(null);
 const resolve=useRef<((v:string|null)=>void)|null>(null);
 const ask=(value:DialogRequest)=>new Promise<string|null>(done=>{resolve.current?.(null);resolve.current=done;setRequest(value);});
 const close=(value:string|null)=>{resolve.current?.(value);resolve.current=null;setRequest(null);};
 return {request,close,ask,notify:(message:string)=>ask({message,kind:'message'}),confirmAction:async(message:string)=>(await ask({message,kind:'confirm'}))!==null,promptValue:(message:string,defaultValue:string)=>ask({message,kind:'prompt',defaultValue})};
}
