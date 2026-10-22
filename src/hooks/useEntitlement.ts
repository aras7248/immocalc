'use client';
import {useState,useEffect} from 'react';import type {SupabaseClient} from '@supabase/supabase-js';import {resolveAccessLevel} from '@/domain/immocalc/premium';
export function useEntitlement(userId:string|undefined,client:SupabaseClient){
 const [snapshot,setSnapshot]=useState<{owner:string;row:unknown;error:boolean}|null>(null);
 useEffect(()=>{let active=true;let expiry:ReturnType<typeof setTimeout>|undefined;
  if(userId)void (async()=>{const {data,error}=await client.from('immocalc_entitlements').select('level,valid_until,source').eq('user_id',userId).maybeSingle();if(!active)return;setSnapshot({owner:userId,row:error?null:data,error:Boolean(error)});
   if(data?.valid_until){const delay=Date.parse(data.valid_until)-Date.now();if(delay>0&&delay<2147483647)expiry=setTimeout(()=>setSnapshot({owner:userId,row:null,error:false}),delay+1);}
  })();return()=>{active=false;if(expiry)clearTimeout(expiry);};
 },[client,userId]);
 const current=snapshot?.owner===userId?snapshot:null;
 return {level:resolveAccessLevel(current?.row),loading:Boolean(userId&&!current),error:current?.error??false};
}
