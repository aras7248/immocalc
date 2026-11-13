import {
  calculateAcquisitionCosts,
  calculateOperatingCosts,
} from "../../lib/calculations.ts";

export const PREMIUM_ANALYSIS_SCHEMA_VERSION = 1 as const;
export const PREMIUM_CALCULATION_VERSION = "2026.1" as const;

export type PremiumPlanId = "investor" | "professional";
export type ImmocalcAccessLevel = "free" | PremiumPlanId | "admin";

export interface PremiumPlanDefinition {
  id: PremiumPlanId;
  name: string;
  description: string;
  projectLimit: number | null;
}

export const PREMIUM_PLAN_DEFINITIONS: Record<PremiumPlanId, PremiumPlanDefinition> = {
  investor: {
    id: "investor",
    name: "Investor",
    description: "Für private Investoren und Einsteiger.",
    projectLimit: 3,
  },
  professional: {
    id: "professional",
    name: "Professional",
    description: "Für Profis mit wachsendem Portfolio.",
    projectLimit: null,
  },
};

export interface PremiumAnalysisEnvelope<TInput = unknown, TResult = unknown> {
  schemaVersion: typeof PREMIUM_ANALYSIS_SCHEMA_VERSION;
  calculationVersion: typeof PREMIUM_CALCULATION_VERSION;
  input: TInput;
  result: TResult | null;
}

export function hasPremiumAccess(level: ImmocalcAccessLevel) {
  return level !== "free";
}

export function getPremiumProjectLimit(level: ImmocalcAccessLevel) {
  if (level === "free") return 0;
  if (level === "admin" || level === "professional") return null;
  return PREMIUM_PLAN_DEFINITIONS[level].projectLimit;
}

export function canCreatePremiumProject(level: ImmocalcAccessLevel, currentProjectCount: number) {
  const limit = getPremiumProjectLimit(level);
  if (limit === null) return true;
  return Math.max(0, currentProjectCount) < limit;
}

export function createPremiumAnalysisEnvelope<TInput>(input: TInput): PremiumAnalysisEnvelope<TInput> {
  return {
    schemaVersion: PREMIUM_ANALYSIS_SCHEMA_VERSION,
    calculationVersion: PREMIUM_CALCULATION_VERSION,
    input,
    result: null,
  };
}

export interface PremiumLoan {
  name: string;
  amount: number;
  interestPercent: number;
  repaymentPercent: number;
  fixedInterestYears: number;
  interestOnlyYears?: number;
  followUpInterestPercent: number;
}

export interface PremiumInvestmentInput {
  additionalLoans?: PremiumLoan[];
  purchasePrice: number;
  livingArea: number;
  monthlyRent: number;
  federalState: string;
  notaryPercent: number;
  brokerPercent: number;
  hasBroker: boolean;
  maintenancePerSqmMonthly: number;
  managementMonthly: number;
  reserveMonthly: number;
  nonRecoverableHoaMonthly?: number;
  otherOwnerCostsMonthly?: number;
  vacancyPercent: number;
  rentDefaultPercent?: number;
  renovationCosts: number;
  otherInitialCosts: number;
  costBufferPercent: number;
  equityAmount: number;
  interestPercent: number;
  repaymentPercent: number;
  fixedInterestYears: number;
  interestOnlyYears?: number;
  followUpInterestPercent: number;
  specialRepaymentAnnual: number;
  rentGrowthPercent: number;
  costGrowthPercent: number;
  valueGrowthPercent: number;
  exitCostPercent: number;
  forecastYears: number;
}

export interface PremiumNormalizedInput extends PremiumInvestmentInput {
  fixedInterestYears: number;
  forecastYears: number;
}

export interface PremiumProjectionYear {
  year: number;
  grossRent: number;
  effectiveRent: number;
  operatingCosts: number;
  noi: number;
  interestRatePercent: number;
  interest: number;
  repayment: number;
  specialRepayment: number;
  debtService: number;
  cashFlow: number;
  cumulativeCashFlow: number;
  remainingDebt: number;
  propertyValue: number;
  equityInProperty: number;
}

export interface PremiumScenarioSummary {
  id: "conservative" | "realistic" | "optimistic" | "stress";
  label: string;
  monthlyCashFlowYearOne: number;
  dscrYearOne: number;
  remainingDebtAtExit: number;
  equityAtExit: number;
  totalProfit: number;
  irrPercent: number;
}

export interface PremiumInvestmentResult {
  loans: Array<Pick<PremiumLoan, "name" | "amount" | "interestPercent" | "repaymentPercent"> & {
    interestOnlyYears: number;
    initialMonthlyRate: number;
    monthlyDebtServiceYearOne: number;
    remainingDebtAtExit: number;
  }>;
  input: PremiumNormalizedInput;
  acquisitionCosts: ReturnType<typeof calculateAcquisitionCosts>;
  acquisitionCostAmount: number;
  initialCostAmount: number;
  costBufferAmount: number;
  totalInvestment: number;
  equityUsed: number;
  loanAmount: number;
  purchasePricePerSqm: number;
  totalInvestmentPerSqm: number;
  scheduledAnnualRent: number;
  effectiveAnnualRent: number;
  operatingCostsAnnual: number;
  noiAnnual: number;
  annualDebtService: number;
  monthlyCashFlow: number;
  annualCashFlow: number;
  grossRentalYieldPercent: number;
  netRentalYieldPercent: number;
  cashOnCashReturnPercent: number;
  loanToValuePercent: number;
  dscr: number;
  breakEvenRentPerSqm: number;
  maximumVacancyPercent: number;
  salePrice: number;
  saleCosts: number;
  remainingDebtAtExit: number;
  netSaleProceeds: number;
  cumulativeCashFlow: number;
  totalProfit: number;
  equityMultiple: number;
  irrPercent: number;
  projection: PremiumProjectionYear[];
  scenarios: PremiumScenarioSummary[];
}

type PremiumModelResult = Omit<PremiumInvestmentResult, "scenarios">;

function clampFinite(value: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(Math.max(value, minimum), maximum);
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}

export function normalizePremiumLoans(value: unknown): PremiumLoan[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const loan = entry as Partial<PremiumLoan>;
    return [{
      name: typeof loan.name === "string" ? loan.name.trim().slice(0, 80) : "",
      amount: clampFinite(loan.amount ?? 0),
      interestPercent: clampFinite(loan.interestPercent ?? 0, 0, 30),
      repaymentPercent: clampFinite(loan.repaymentPercent ?? 0, 0, 30),
      fixedInterestYears: Math.round(clampFinite(loan.fixedInterestYears ?? 10, 1, 50)),
      interestOnlyYears: Math.floor(clampFinite(loan.interestOnlyYears ?? 0, 0, 50)),
      followUpInterestPercent: clampFinite(loan.followUpInterestPercent ?? 0, 0, 30),
    }];
  });
}

export function shiftPremiumLoanRates(input: PremiumInvestmentInput, interest: number, followUp = 0) {
  return {
    interestPercent: input.interestPercent + interest,
    followUpInterestPercent: input.followUpInterestPercent + followUp,
    additionalLoans: input.additionalLoans?.map(loan => ({
      ...loan,
      interestPercent: loan.interestPercent + interest,
      followUpInterestPercent: loan.followUpInterestPercent + followUp,
    })),
  };
}

function normalizePremiumInput(input: PremiumInvestmentInput): PremiumNormalizedInput {
  return {
    additionalLoans: normalizePremiumLoans(input.additionalLoans),
    purchasePrice: clampFinite(input.purchasePrice),
    livingArea: clampFinite(input.livingArea),
    monthlyRent: clampFinite(input.monthlyRent),
    federalState: typeof input.federalState === "string" ? input.federalState.trim().toUpperCase() : "",
    notaryPercent: clampFinite(input.notaryPercent, 0, 20),
    brokerPercent: clampFinite(input.brokerPercent, 0, 20),
    hasBroker: input.hasBroker === true,
    maintenancePerSqmMonthly: clampFinite(input.maintenancePerSqmMonthly),
    managementMonthly: clampFinite(input.managementMonthly),
    reserveMonthly: clampFinite(input.reserveMonthly),
    nonRecoverableHoaMonthly: clampFinite(input.nonRecoverableHoaMonthly ?? 0),
    otherOwnerCostsMonthly: clampFinite(input.otherOwnerCostsMonthly ?? 0),
    vacancyPercent: clampFinite(input.vacancyPercent, 0, 100),
    rentDefaultPercent: clampFinite(input.rentDefaultPercent ?? 0, 0, 100),
    renovationCosts: clampFinite(input.renovationCosts),
    otherInitialCosts: clampFinite(input.otherInitialCosts),
    costBufferPercent: clampFinite(input.costBufferPercent, 0, 100),
    equityAmount: clampFinite(input.equityAmount),
    interestPercent: clampFinite(input.interestPercent, 0, 30),
    repaymentPercent: clampFinite(input.repaymentPercent, 0, 30),
    fixedInterestYears: Math.round(clampFinite(input.fixedInterestYears, 1, 50)),
    interestOnlyYears: Math.floor(clampFinite(input.interestOnlyYears ?? 0, 0, 50)),
    followUpInterestPercent: clampFinite(input.followUpInterestPercent, 0, 30),
    specialRepaymentAnnual: clampFinite(input.specialRepaymentAnnual),
    rentGrowthPercent: clampFinite(input.rentGrowthPercent, -20, 50),
    costGrowthPercent: clampFinite(input.costGrowthPercent, -20, 50),
    valueGrowthPercent: clampFinite(input.valueGrowthPercent, -20, 50),
    exitCostPercent: clampFinite(input.exitCostPercent, 0, 30),
    forecastYears: Math.round(clampFinite(input.forecastYears, 1, 50)),
  };
}

function calculateIrr(cashFlows: number[]): number {
  if (cashFlows.length < 2 || cashFlows[0] >= 0 || !cashFlows.some((value) => value > 0)) {
    return 0;
  }

  const netPresentValue = (rate: number) => cashFlows.reduce(
    (sum, cashFlow, index) => sum + cashFlow / ((1 + rate) ** index),
    0,
  );

  let lower = -0.99;
  let upper = 10;
  let lowerValue = netPresentValue(lower);
  let upperValue = netPresentValue(upper);

  if (lowerValue * upperValue > 0) return 0;

  for (let iteration = 0; iteration < 160; iteration += 1) {
    const middle = (lower + upper) / 2;
    const middleValue = netPresentValue(middle);

    if (Math.abs(middleValue) < 0.000001) return middle * 100;
    if (lowerValue * middleValue <= 0) {
      upper = middle;
      upperValue = middleValue;
    } else {
      lower = middle;
      lowerValue = middleValue;
    }
  }

  return ((lower + upper) / 2) * 100;
}

function calculatePremiumModel(rawInput: PremiumInvestmentInput): PremiumModelResult {
  const input = normalizePremiumInput(rawInput);
  const acquisitionCosts = calculateAcquisitionCosts(input.purchasePrice, input);
  const initialCostAmount = input.renovationCosts + input.otherInitialCosts;
  const costBufferAmount = initialCostAmount * (input.costBufferPercent / 100);
  const totalInvestment = input.purchasePrice
    + acquisitionCosts.totalAmount
    + initialCostAmount
    + costBufferAmount;
  const equityUsed = Math.min(input.equityAmount, totalInvestment);
  const loanAmount = Math.max(totalInvestment - equityUsed, 0);
  const baseOperatingCosts = calculateOperatingCosts(input).totalAnnual;
  const scheduledAnnualRent = input.monthlyRent * 12;
  const paymentFactor = 1 - (input.rentDefaultPercent ?? 0) / 100;
  const collectionFactor = (1 - input.vacancyPercent / 100) * paymentFactor;
  const effectiveAnnualRent = scheduledAnnualRent * collectionFactor;
  const noiAnnual = effectiveAnnualRent - baseOperatingCosts;
  let bankAmount = loanAmount;
  const additionalLoans = (input.additionalLoans ?? []).map((loan, index) => {
    const amount = Math.min(loan.amount, bankAmount);
    bankAmount -= amount;
    return { ...loan, amount, name: loan.name || `Darlehen ${index + 2}`, specialRepaymentAnnual: 0 };
  });
  const loans = [
    {
      name: "Bankdarlehen",
      amount: bankAmount,
      interestPercent: input.interestPercent,
      repaymentPercent: input.repaymentPercent,
      fixedInterestYears: input.fixedInterestYears,
      interestOnlyYears: input.interestOnlyYears,
      followUpInterestPercent: input.followUpInterestPercent,
      specialRepaymentAnnual: input.specialRepaymentAnnual,
    },
    ...additionalLoans,
  ].map(loan => ({
    ...loan,
    remainingDebt: loan.amount,
    monthlyDebtServiceYearOne: 0,
    annualPayment: loan.amount * (loan.interestPercent + loan.repaymentPercent) / 100,
  }));

  let cumulativeCashFlow = 0;
  const projection: PremiumProjectionYear[] = [];

  for (let year = 1; year <= input.forecastYears; year += 1) {
    const grossRent = scheduledAnnualRent * ((1 + input.rentGrowthPercent / 100) ** (year - 1));
    const effectiveRent = grossRent * collectionFactor;
    const operatingCosts = baseOperatingCosts * ((1 + input.costGrowthPercent / 100) ** (year - 1));
    const noi = effectiveRent - operatingCosts;
    let openingDebt = 0;
    let remainingDebt = 0;
    let interest = 0;
    let repayment = 0;
    let specialRepayment = 0;
    for (const loan of loans) {
      openingDebt += loan.remainingDebt;
      const rate = year > loan.fixedInterestYears ? loan.followUpInterestPercent : loan.interestPercent;
      if (year === loan.fixedInterestYears + 1) {
        loan.annualPayment = loan.remainingDebt * (rate + loan.repaymentPercent) / 100;
      }
      const loanInterest = loan.remainingDebt * rate / 100;
      const interestOnly = year <= (loan.interestOnlyYears ?? 0);
      const scheduledRepayment = interestOnly
        ? 0
        : Math.min(Math.max(loan.annualPayment - loanInterest, 0), loan.remainingDebt);
      const extra = interestOnly
        ? 0
        : Math.min(loan.specialRepaymentAnnual, loan.remainingDebt - scheduledRepayment);
      loan.remainingDebt = Math.max(loan.remainingDebt - scheduledRepayment - extra, 0);
      if (year === 1) loan.monthlyDebtServiceYearOne = (loanInterest + scheduledRepayment + extra) / 12;
      interest += loanInterest;
      repayment += scheduledRepayment + extra;
      specialRepayment += extra;
      remainingDebt += loan.remainingDebt;
    }
    const interestRatePercent = safeRatio(interest, openingDebt) * 100;
    const debtService = interest + repayment;
    const cashFlow = noi - debtService;
    cumulativeCashFlow += cashFlow;

    const propertyValue = input.purchasePrice
      * ((1 + input.valueGrowthPercent / 100) ** year);

    projection.push({
      year,
      grossRent,
      effectiveRent,
      operatingCosts,
      noi,
      interestRatePercent,
      interest,
      repayment,
      specialRepayment,
      debtService,
      cashFlow,
      cumulativeCashFlow,
      remainingDebt,
      propertyValue,
      equityInProperty: propertyValue - remainingDebt,
    });
  }

  const firstYear = projection[0];
  const finalYear = projection[projection.length - 1];
  const annualDebtService = firstYear?.debtService ?? 0;
  const annualCashFlow = firstYear?.cashFlow ?? noiAnnual;
  const salePrice = finalYear?.propertyValue ?? input.purchasePrice;
  const saleCosts = salePrice * (input.exitCostPercent / 100);
  const remainingDebtAtExit = finalYear?.remainingDebt ?? loanAmount;
  const netSaleProceeds = salePrice - saleCosts - remainingDebtAtExit;
  const totalProfit = netSaleProceeds + cumulativeCashFlow - equityUsed;
  const exitCashFlows = [
    -equityUsed,
    ...projection.map((year, index) => (
      index === projection.length - 1
        ? year.cashFlow + netSaleProceeds
        : year.cashFlow
    )),
  ];
  const requiredIncome = baseOperatingCosts + annualDebtService;

  return {
    input,
    acquisitionCosts,
    acquisitionCostAmount: acquisitionCosts.totalAmount,
    initialCostAmount,
    costBufferAmount,
    totalInvestment,
    equityUsed,
    loanAmount,
    loans: loans.map(loan => ({
      name: loan.name,
      amount: loan.amount,
      interestPercent: loan.interestPercent,
      repaymentPercent: loan.repaymentPercent,
      monthlyDebtServiceYearOne: loan.monthlyDebtServiceYearOne,
      remainingDebtAtExit: loan.remainingDebt,
      interestOnlyYears: loan.interestOnlyYears ?? 0,
      initialMonthlyRate: loan.amount * (
        loan.interestPercent + ((loan.interestOnlyYears ?? 0) > 0 ? 0 : loan.repaymentPercent)
      ) / 1200,
    })),
    purchasePricePerSqm: safeRatio(input.purchasePrice, input.livingArea),
    totalInvestmentPerSqm: safeRatio(totalInvestment, input.livingArea),
    scheduledAnnualRent,
    effectiveAnnualRent,
    operatingCostsAnnual: baseOperatingCosts,
    noiAnnual,
    annualDebtService,
    monthlyCashFlow: annualCashFlow / 12,
    annualCashFlow,
    grossRentalYieldPercent: safeRatio(scheduledAnnualRent, input.purchasePrice) * 100,
    netRentalYieldPercent: safeRatio(noiAnnual, totalInvestment) * 100,
    cashOnCashReturnPercent: safeRatio(annualCashFlow, equityUsed) * 100,
    loanToValuePercent: safeRatio(loanAmount, input.purchasePrice) * 100,
    dscr: safeRatio(noiAnnual, annualDebtService),
    breakEvenRentPerSqm: safeRatio(
      collectionFactor > 0 ? requiredIncome / collectionFactor / 12 : 0,
      input.livingArea,
    ),
    maximumVacancyPercent: scheduledAnnualRent * paymentFactor > 0
      ? Math.max(0, Math.min(100, (1 - requiredIncome / (scheduledAnnualRent * paymentFactor)) * 100))
      : 0,
    salePrice,
    saleCosts,
    remainingDebtAtExit,
    netSaleProceeds,
    cumulativeCashFlow,
    totalProfit,
    equityMultiple: safeRatio(netSaleProceeds + cumulativeCashFlow, equityUsed),
    irrPercent: calculateIrr(exitCashFlows),
    projection,
  };
}

function summarizeScenario(
  id: PremiumScenarioSummary["id"],
  label: string,
  input: PremiumInvestmentInput,
): PremiumScenarioSummary {
  const result = calculatePremiumModel(input);
  const finalYear = result.projection[result.projection.length - 1];

  return {
    id,
    label,
    monthlyCashFlowYearOne: result.monthlyCashFlow,
    dscrYearOne: result.dscr,
    remainingDebtAtExit: result.remainingDebtAtExit,
    equityAtExit: finalYear?.equityInProperty ?? 0,
    totalProfit: result.totalProfit,
    irrPercent: result.irrPercent,
  };
}

export function calculatePremiumInvestment(
  rawInput: PremiumInvestmentInput,
): PremiumInvestmentResult {
  const result = calculatePremiumModel(rawInput);
  const input = result.input;
  const conservative = {
    ...input,
    vacancyPercent: Math.min(input.vacancyPercent + 3, 100),
    rentGrowthPercent: input.rentGrowthPercent - 1,
    costGrowthPercent: input.costGrowthPercent + 1,
    valueGrowthPercent: input.valueGrowthPercent - 1,
    ...shiftPremiumLoanRates(input, 0, 1),
  };
  const optimistic = {
    ...input,
    vacancyPercent: Math.max(input.vacancyPercent - 2, 0),
    rentGrowthPercent: input.rentGrowthPercent + 0.5,
    costGrowthPercent: input.costGrowthPercent - 0.5,
    valueGrowthPercent: input.valueGrowthPercent + 0.5,
    ...shiftPremiumLoanRates(input, 0, -0.5),
  };
  const stress = {
    ...input,
    monthlyRent: input.monthlyRent * 0.9,
    vacancyPercent: Math.min(input.vacancyPercent + 5, 100),
    ...shiftPremiumLoanRates(input, 1, 2),
    costGrowthPercent: input.costGrowthPercent + 1,
    valueGrowthPercent: input.valueGrowthPercent - 1.5,
  };

  return {
    ...result,
    scenarios: [
      summarizeScenario("conservative", "Konservativ", conservative),
      summarizeScenario("realistic", "Realistisch", input),
      summarizeScenario("optimistic", "Optimistisch", optimistic),
      summarizeScenario("stress", "Stress", stress),
    ],
  };
}
