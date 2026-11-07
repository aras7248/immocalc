import assert from "node:assert/strict";
import test from "node:test";
import { criticalQuestions, reviewExpose, type ExposeImport } from "./expose.ts";
import type { ValuationInput } from "./valuation.ts";

const f=(key:string,value:string,page:number=1)=>({key,value,page,label:key,evidence:value});
const doc=(pages:ExposeImport["pages"],count=pages.length):ExposeImport=>({filename:"Test.pdf",pageCount:count,pages,createdAt:"2026-11-07T00:00:00Z"});
const sample:ValuationInput={
  address:"Beispielweg 1, Teststadt",type:"Mehrfamilienhaus",area:100,year:1995,askingPrice:250000,annualRent:12000,
  comparisonPricesPerSqm:[],comparisonSources:[],federalState:"NRW",interest:4,repayment:1.5,
  maintenancePerSqmMonthly:1,managementMonthly:30,reserveMonthly:50,notaryPercent:2,brokerPercent:0,
  renovationBudget:0,remarks:""
};

test("Jede Seite muss erfolgreich verarbeitet sein",()=>{
  const report=reviewExpose(doc([
    {page:1,status:"read",summary:"erste Seite",facts:[f("address","Beispielweg 1")]},
    {page:2,status:"unreadable",summary:"nicht erkennbar",facts:[]}
  ]));
  assert.equal(report.complete,false);
  assert.ok(criticalQuestions(sample,report,"vermietet").some(q=>q.includes("nicht auf allen Seiten")));
});

test("Alle belegten Fakten bleiben mit Seitenzahl erhalten",()=>{
  const report=reviewExpose(doc([{page:1,status:"read",summary:"",facts:[
    f("askingPrice","250.000 €"),f("area","100 m²"),f("year","1995"),
    f("monthlyColdRent","1.000 €"),f("other","Fassade 2008 gestrichen"),
  ]}]));
  assert.equal(report.updates.askingPrice,250000);
  assert.equal(report.updates.area,100);
  assert.equal(report.updates.annualRent,12000);
  assert.equal(report.findings.length,5);
  assert.equal(report.findings[4].page,1);
});

test("Widersprüche bei Kaufpreisen dürfen nicht automatisch überschrieben werden",()=>{
  const report=reviewExpose(doc([
    {page:1,status:"read",summary:"",facts:[f("askingPrice","250.000 €",1)]},
    {page:2,status:"read",summary:"",facts:[f("askingPrice","280.000 €",2)]},
  ]));
  assert.equal(report.updates.askingPrice,undefined);
  assert.ok(report.conflicts.some(c=>c.key==="askingPrice"));
  assert.ok(criticalQuestions(sample,report,"vermietet").some(q=>q.includes("Widersprüchliche")));
});

test("Bei vermieteten Immobilien darf die Ist-Miete nicht fehlen",()=>{
  const report=reviewExpose(doc([{page:1,status:"read",summary:"",facts:[]}]));
  assert.ok(criticalQuestions({...sample,annualRent:0},report,"vermietet").some(q=>q.includes("Kaltmiete")));
});
