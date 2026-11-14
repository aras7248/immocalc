import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProperty, type ValuationInput } from "./valuation.ts";

const sample: ValuationInput = {
  address:"Teststraße 1, 12345 Teststadt",type:"Mehrfamilienhaus",area:100,year:1980,
  askingPrice:300000,annualRent:18000,
  comparisonPricesPerSqm:[2800,3000,3200],comparisonSources:["Angebot A","Angebot B","Angebot C"],
  federalState:"NRW",interest:4,repayment:1.5,
  maintenancePerSqmMonthly:1,managementMonthly:30,reserveMonthly:50,
  notaryPercent:2,brokerPercent:3.57,renovationBudget:0,remarks:"",
};
test("Vergleichspreise werden korrekt in Objektwerte umgerechnet",()=>{
  const result=evaluateProperty(sample);
  assert.deepEqual(result.comparisonRange,{low:280000,middle:300000,high:320000});
  assert.equal(result.offerDifference,0);
  assert.ok(result.finance);
});
test("Fehlende Vergleichsquellen blockieren den Preisvergleich",()=>{
  const result=evaluateProperty({...sample,comparisonSources:["","", ""]});
  assert.equal(result.comparisonRange,null);
  assert.ok(result.warnings.some(x=>x.includes("Quelle")));
});
test("Sanierung verringert nur die rechnerische Investitionsgrenze",()=>{
  const base=evaluateProperty(sample),renovated=evaluateProperty({...sample,renovationBudget:10000});
  assert.equal(renovated.investmentLimit,(base.investmentLimit??0)-10000);
  assert.deepEqual(renovated.comparisonRange,base.comparisonRange);
});
