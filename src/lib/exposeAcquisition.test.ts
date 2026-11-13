import test from 'node:test';
import assert from 'node:assert/strict';
import { extractPropertyState, extractBuyerCommission } from './exposeAcquisition.ts';
import { extractExposeTextData } from './exposeImport.ts';

test('actual exposé structure yields property state and stated buyer commission', () => {
  const result = extractExposeTextData('Adresse: Mittelweg 56, 33106 Paderborn-Elsen\nKaufpreis: 496.175€ zzgl. 4,76% inkl.19 MwSt\nMaklercourtage\nProvision\tProvision, vom Käufer 4,76% inkl.MwSt\nWohnfläche: 223 m²');
  assert.equal(result.bundesland, 'NRW');
  assert.equal(result.maklerProzent, '4,76');
  assert.equal(result.hasMakler, true);
  assert.equal(result.kaufpreis, '496.175');
});
test('property postcode determines state, unrelated contact location does not', () => {
  assert.equal(extractPropertyState('Hauptstraße 1, 70173 Stuttgart', 'Kontakt: 33106 Paderborn'), 'BW');
  assert.equal(extractPropertyState(undefined, 'Kontakt: 70173 Stuttgart'), undefined);
  assert.equal(extractPropertyState('Teststraße 1, 99999 Unbekannt', ''), undefined);
  assert.equal(extractPropertyState('Teststraße 1, 33106 Paderborn', 'Bundesland: Bayern'), undefined);
});
test('missing or contradictory commissions do not silently become a default', () => {
  assert.deepEqual(extractBuyerCommission('Maklerprovision nach Vereinbarung'), {});
  assert.ok(extractBuyerCommission('Käuferprovision: 3,57 % inkl. MwSt\nProvision: 4,76 % inkl. MwSt').commissionWarning);
  assert.ok(extractBuyerCommission('Provision: 3 % zzgl. MwSt').commissionWarning);
  assert.ok(extractBuyerCommission('Gesamtprovision: 7,14 %').commissionWarning);
});
test('seller commission is not charged to buyer, and zero remains explicit', () => {
  assert.deepEqual(extractBuyerCommission('Verkäuferprovision: 7,14 %'), {});
  assert.deepEqual(extractBuyerCommission('Käuferprovision: 3,57 % inkl. MwSt\nVerkäuferprovision: 3,57 %'), {maklerProzent:'3,57',hasMakler:true});
  assert.deepEqual(extractExposeTextData('Provision: 0 %\nKaufpreis: 100.000 EUR').hasMakler, false);
  assert.deepEqual(extractBuyerCommission('provisionsfrei'), {maklerProzent:'0',hasMakler:false});
});
