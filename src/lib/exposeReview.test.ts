import test from 'node:test';
import assert from 'node:assert/strict';
import { editExposeReview, validateExposeReview, syncReviewedPremium } from './exposeReview.ts';

test('editing import preview preserves original object and labels corrected evidence', () => {
  const source = { address: 'Altstraße 1', facts: { facts: [{key:'address',label:'Adresse',value:'Altstraße 1'}], warnings: [] } };
  const edited = editExposeReview(source, 'address', 'Neustraße 2');
  assert.equal(source.address, 'Altstraße 1');
  assert.equal(edited.address, 'Neustraße 2');
  assert.match(edited.facts!.facts[0].label, /Nutzerkorrektur/);
  assert.equal(edited.facts!.facts[0].value, 'Neustraße 2');
  assert.equal(edited.facts!.warnings.length, 1);
});
test('zero commission disables broker, empty commission does not change existing settings', () => {
  assert.equal(editExposeReview({maklerProzent:'4,76'}, 'maklerProzent', '0').hasMakler, false);
  assert.equal(editExposeReview({hasMakler:true}, 'maklerProzent', '').hasMakler, undefined);
  assert.equal(editExposeReview({commissionWarning:'Unklar'}, 'maklerProzent', '3,57').commissionWarning, undefined);
});
test('review validates German numbers and rejects malformed or negative values', () => {
  assert.equal(validateExposeReview({kaufpreis:'496.175',wohnflaeche:'223,5',mietePM:'0',maklerProzent:'4,76',baujahr:'1997'}), null);
  for (const invalid of [{kaufpreis:'-5'}, {wohnflaeche:'0'}, {mietePM:'1,2,3'}, {maklerProzent:'101'}, {baujahr:'abcd'}]) assert.ok(validateExposeReview(invalid));
  assert.equal(validateExposeReview({kaufpreis:'',mietePM:''}), null);
});

test('confirmed import replaces stale premium values and retains premium scenarios', () => {
  const premium = {purchasePrice:350000,livingArea:268,monthlyRent:1000,federalState:'BW',brokerPercent:3.57,hasBroker:true,renovationCosts:25000};
  const next = syncReviewedPremium(premium, {kaufpreis:'480.000',wohnflaeche:'225',mietePM:'2.200',bundesland:'NI',maklerProzent:'0',hasMakler:false});
  assert.deepEqual(next, {purchasePrice:480000,livingArea:225,monthlyRent:2200,federalState:'NI',brokerPercent:0,hasBroker:false,renovationCosts:25000});
  assert.deepEqual(syncReviewedPremium(premium, {}), premium);
  assert.equal(syncReviewedPremium(premium, {mietePM:'0'}).monthlyRent, 0);
  assert.equal(premium.monthlyRent, 1000);
});

test('annual rent stays exact in premium and preview edits invalidate or refresh the counterpart', () => {
  const premium = {purchasePrice:350000,livingArea:268,monthlyRent:1000,federalState:'BW',brokerPercent:3.57,hasBroker:true};
  const reviewed = {mietePA:'55.000', mietePM:'4.583,33', anzahlEinheiten:'12'};
  assert.equal(syncReviewedPremium(premium, reviewed).monthlyRent * 12, 55000);
  assert.equal(editExposeReview(reviewed, 'mietePM', '5.000').mietePA, undefined);
  assert.equal(editExposeReview(reviewed, 'mietePA', '60.000').mietePM, '5.000');
  assert.equal(validateExposeReview(reviewed), null);
  assert.ok(validateExposeReview({anzahlEinheiten:'1,5'}));
});
