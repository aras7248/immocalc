import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateProjection } from './projection.ts';
const input = { purchasePrice: 100000, annualRent: 12000, federalState: 'NRW', notaryPercent: 2, brokerPercent: 0, livingArea: 100, maintenancePerSqmMonthly: 1, managementMonthly: 0, reserveMonthly: 0, interestPercent: 4, repaymentPercent: 2, fixedInterestYears: 10 };
test('A6: monthly amortization agrees with closed-form balance and total principal paid', () => {
 const p = calculateProjection(input, 10); const r = .04 / 12;
 const expected = 100000 * (1+r)**120 - 500 * ((1+r)**120-1)/r;
 assert.ok(Math.abs(p.rows[9].remainingDebt - expected) < 1e-6);
 assert.ok(Math.abs(p.rows.reduce((s,y)=>s+y.repayment,0) - (100000-expected)) < 1e-6);
 assert.equal(p.remainingDebtAtFixedInterest, p.rows[9].remainingDebt);
 assert.ok(p.rows[9].interest < p.rows[0].interest);
});
test('A6: rent, costs and cumulative cashflow use separate annual growth', () => {
 const p = calculateProjection({...input, vacancyPercent: 2, annualRentGrowthPercent: 3, annualCostGrowthPercent: 2}, 2);
 assert.equal(p.rows[0].annualRent, 11760); assert.equal(p.rows[1].annualRent, 11760*1.03);
 assert.equal(p.rows[1].operatingCosts, 1200*1.02);
 assert.equal(p.rows[1].cumulativeCashFlow, p.rows[0].cashFlow+p.rows[1].cashFlow);
 assert.equal(p.remainingDebtAtFixedInterest, null);
});
test('A6: no debt, early payoff and zero interest remain consistent', () => {
 assert.equal(calculateProjection({...input,equityPercentOfPrice:100},30).rows[29].payment,0);
 const p=calculateProjection({...input,interestPercent:0,repaymentPercent:100},2);
 assert.equal(p.rows[0].repayment,100000); assert.equal(p.rows[1].remainingDebt,0);
 assert.equal(p.rows[1].payment,0);
 assert.equal(calculateProjection(input,100).rows.length,30);
});
