import assert from 'node:assert/strict';import test from 'node:test';import {POST} from '../app/api/billing/webhook/route.ts';
test('E3: inactive billing endpoint does not claim an available payment or entitlement change',async()=>{
 const response=await POST();assert.equal(response.status,501);assert.deepEqual(await response.json(),{enabled:false,error:'Zahlungen sind noch nicht eingerichtet. Es wurde keine Berechtigung geändert.'});
});
