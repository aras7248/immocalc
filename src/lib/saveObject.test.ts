import assert from 'node:assert/strict';import test from 'node:test';import {saveObjectVersioned,ObjectSaveConflict} from './saveObject.ts';
import type {SupabaseClient} from '@supabase/supabase-js';
function mock(data:unknown){const filters:unknown[]=[];const chain={update:()=>chain,eq:(...args:unknown[])=>{filters.push(args);return chain;},select:()=>chain,maybeSingle:async()=>({data,error:null})};return {client:{from:()=>chain} as unknown as Pick<SupabaseClient,'from'>,filters};}
test('C4: update uses owner and loaded timestamp and detects stale versions',async()=>{
 const payload={user_id:'owner',calc_data:{}};const stale=mock(null);
 await assert.rejects(saveObjectVersioned(stale.client,payload,{id:'object',updatedAt:'old-version'}),ObjectSaveConflict);
 assert.deepEqual(stale.filters,[['id','object'],['user_id','owner'],['updated_at','old-version']]);
 const fresh=mock({id:'object',updated_at:'new-version'});assert.deepEqual(await saveObjectVersioned(fresh.client,payload,{id:'object',updatedAt:'old-version'}),{id:'object',updated_at:'new-version'});
 await assert.rejects(saveObjectVersioned(fresh.client,payload,{id:'object',updatedAt:null}),ObjectSaveConflict);
});
