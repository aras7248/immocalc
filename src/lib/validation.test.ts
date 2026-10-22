import assert from 'node:assert/strict';import test from 'node:test';import {validateFields} from './validation.ts';
const parse=(s:string)=>Number(s.replace(',','.'));
test('B3: invalid, negative, fractional and out-of-range fields are visible',()=>{
 const r=validateFields({wohnflaeche:'0',zins:'16',tilgung:'-1',notarProzent:'11',fixedInterestYears:'1.5',verwaltungPm:'.'},parse);
 for(const f of ['wohnflaeche','zins','tilgung','notarProzent','fixedInterestYears','verwaltungPm'])assert.ok(r[f]);
 assert.deepEqual(validateFields({wohnflaeche:'100',zins:'4',fixedInterestYears:''},parse),{});
});
