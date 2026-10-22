import assert from 'node:assert/strict';import test from 'node:test';import {parseSavedObjectRow} from '../domain/immocalc/state.ts';
test('D2: saved-object adapter preserves explicit values and fills versioned defaults',()=>{
 const row=parseSavedObjectRow({id:'object',created_at:'2026-01-01',updated_at:'version',calc_data:{calc:{kaufpreis:'123.000,00',instandhaltungQm:'0,00'},rentIncrease:-10,scenarioCostIncreasePercent:-2}});
 assert.ok(row);assert.equal(row.calc.kaufpreis,'123.000,00');assert.equal(row.calc.instandhaltungQm,'0,00');assert.equal(row.calc.equityPercentOfPrice,'0,00');assert.equal(row.calc.vacancyPercent,'2,00');assert.equal(row.rev.angebotspreis,row.calc.kaufpreis);assert.equal(row.updatedAt,'version');assert.equal(row.rentIncrease,-10);
 assert.equal(parseSavedObjectRow({id:123}),null);
});
