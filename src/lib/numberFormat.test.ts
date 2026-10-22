import assert from 'node:assert/strict';import test from 'node:test';import {parseNumber,formatAcc} from './numberFormat.ts';
test('B4: established German, decimal-dot and decorated inputs remain compatible',()=>{
 const cases: [string,number][]=[['1.234,56',1234.56],['1234,56',1234.56],['1.234',1.234],['1,234',1.234],['0.125',.125],['3.571',3.571],['12.345',12345],['-5',-5],['€ 350.000',350000],['12 %',12],['',0],['abc',0],['1,2,3',0]];
 for(const [raw,expected] of cases)assert.equal(parseNumber(raw),expected,raw);
 assert.equal(formatAcc(1234.56),'1.234,56');assert.equal(formatAcc(Infinity),'0,00');
});
