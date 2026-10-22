import { calculateStandard, type StandardCalculationInput } from './calculations.ts';
import { normalizeScenarioPercent } from './scenario.ts';

export type ProjectionInput = Omit<StandardCalculationInput, 'fixedInterestYears'> & {
  fixedInterestYears?: number | null;
  annualRentGrowthPercent?: number;
  annualCostGrowthPercent?: number;
};
export interface ProjectionYear {
  year: number; interest: number; repayment: number; payment: number; remainingDebt: number;
  annualRent: number; operatingCosts: number; cashFlow: number; cumulativeCashFlow: number;
}
export function calculateProjection(input: ProjectionInput, years = 10) {
  const horizon = Number.isFinite(years) ? Math.min(30, Math.max(1, Math.floor(years))) : 10;
  const initial = calculateStandard({ ...input, fixedInterestYears: input.fixedInterestYears ?? undefined });
  const rentGrowth = normalizeScenarioPercent(input.annualRentGrowthPercent ?? 0) / 100;
  const costGrowth = normalizeScenarioPercent(input.annualCostGrowthPercent ?? 2) / 100;
  const rate = initial.input.interestPercent / 100 / 12;
  const payment = initial.financing.annuityMonthly;
  let balance = initial.financing.principal;
  let cumulative = 0;
  const rows: ProjectionYear[] = [];
  for (let year = 1; year <= horizon; year++) {
    let interest = 0; let repayment = 0; let payments = 0;
    for (let month = 0; month < 12 && balance > 0; month++) {
      const monthlyInterest = balance * rate;
      const amountDue = balance + monthlyInterest;
      const actualPayment = amountDue - payment < 1e-8 ? amountDue : payment;
      const principalPaid = Math.max(0, actualPayment - monthlyInterest);
      balance = Math.max(0, balance - principalPaid);
      interest += monthlyInterest; repayment += principalPaid; payments += actualPayment;
    }
    const annualRent = initial.base.effectiveAnnualRent * (1 + rentGrowth) ** (year - 1);
    const operatingCosts = initial.operatingCosts.totalAnnual * (1 + costGrowth) ** (year - 1);
    const cashFlow = annualRent - operatingCosts - payments;
    cumulative += cashFlow;
    rows.push({ year, interest, repayment, payment: payments, remainingDebt: balance, annualRent, operatingCosts, cashFlow, cumulativeCashFlow: cumulative });
  }
  const term = initial.financing.fixedInterestYears;
  return { rows, initialDebt: initial.financing.principal, totalEquityRequired: initial.totalEquityRequired,
    fixedInterestYears: term, remainingDebtAtFixedInterest: term && term <= horizon ? rows[term - 1].remainingDebt : null,
    extrapolatesBeyondFixedInterest: term !== null && horizon > term };
}

export interface ProjectionSettings { years:number; annualRentGrowthPercent:number; annualCostGrowthPercent:number }
export const DEFAULT_PROJECTION_SETTINGS:ProjectionSettings={years:10,annualRentGrowthPercent:0,annualCostGrowthPercent:2};
export function readProjectionSettings(value:unknown):ProjectionSettings{
 const row=typeof value==='object'&&value!==null?value as Record<string,unknown>:{};
 return {years:typeof row.years==='number'&&Number.isFinite(row.years)?Math.min(30,Math.max(1,Math.floor(row.years))):10,annualRentGrowthPercent:normalizeScenarioPercent(row.annualRentGrowthPercent??0),annualCostGrowthPercent:normalizeScenarioPercent(row.annualCostGrowthPercent??2)};
}
