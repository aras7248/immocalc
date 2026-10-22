'use client';
import {useState,useEffect} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {parseSavedObjectRow,type SavedObject} from '@/domain/immocalc/state';
export function useSavedObjects(userId:string|undefined,client:SupabaseClient){
 const [savedObjects,setSavedObjects]=useState<SavedObject[]>([]);const [loadError,setLoadError]=useState<string|null>(null);
 useEffect(()=>{let active=true;if(!userId)return;
  void (async()=>{const {data,error}=await client.from('immocalc_saved_objects').select('*').eq('user_id',userId).order('created_at',{ascending:false});if(!active)return;
   if(error){setLoadError('Gespeicherte Objekte konnten nicht geladen werden. Bitte versuche es erneut.');return;}
   setLoadError(null);setSavedObjects((data??[]).map(parseSavedObjectRow).filter((v):v is SavedObject=>v!==null));
  })();return()=>{active=false;};
 },[client,userId]);
 return {savedObjects,setSavedObjects,loadError};
}
