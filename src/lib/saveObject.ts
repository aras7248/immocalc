import type { SupabaseClient } from '@supabase/supabase-js';
export class ObjectSaveConflict extends Error { constructor(){super('Das Objekt wurde zwischenzeitlich geändert oder gelöscht.');this.name='ObjectSaveConflict';} }
export async function saveObjectVersioned(client:Pick<SupabaseClient,'from'>,payload:{user_id:string;calc_data:object},existing?:{id:string;updatedAt:string|null}){
 if(existing){
  if(!existing.updatedAt)throw new ObjectSaveConflict();
  const {data,error}=await client.from('immocalc_saved_objects').update(payload).eq('id',existing.id).eq('user_id',payload.user_id).eq('updated_at',existing.updatedAt).select('id,updated_at').maybeSingle();
  if(error)throw error;if(!data)throw new ObjectSaveConflict();return data;
 }
 const {data,error}=await client.from('immocalc_saved_objects').insert(payload).select('id,updated_at').single();
 if(error)throw error;return data;
}
