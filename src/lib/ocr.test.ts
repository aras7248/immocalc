import assert from 'node:assert/strict';import test from 'node:test';import {extractOcrFields} from './ocr.ts';
const cases:[string,object][]=[
 ['Grundstück 800 m², Wohnfläche: 120 m² Baujahr: 1980',{wohnflaeche:'120',baujahr:'1980'}],
 ['Telefon 05251 1980 Besichtigung 20.10.2026',{}],
 ['Grundstücksfläche 900 qm Nutzfläche 30 qm',{}],
 ['Wohnfl. ca. 82,5 qm, Bj. 1992',{wohnflaeche:'82,5',baujahr:'1992'}],
 ['120 m2',{wohnflaeche:'120'}],
 ['120 m²',{wohnflaeche:'120'}],
 ['70 m2 90 m2',{}],
 ['Kaufpreis: 350.000 EUR Kaltmiete: 900 €',{kaufpreis:'350.000',mietePM:'900'}],
 ['Jahreskaltmiete 21.900 € Exposé erstellt 2020',{}],
 ['Wohnfläche 0 m² Baujahr 2099',{}],
 ['Bauj. 1911 Wohnfläche: 47 m²',{baujahr:'1911',wohnflaeche:'47'}]
];
for(const [text,expected] of cases)test('B5: '+text,()=>assert.deepEqual(extractOcrFields(text),expected));
