import { normalizeScenarioPercent } from "./scenario.ts";

/**
 * Pure real-estate calculations used by the standard and reverse calculators.
 *
 * Financing model:
 * - the purchase price is financed after deducting the chosen equity share;
 * - acquisition costs are paid from equity;
 * - all monetary values are expressed in euros.
 */

export const LAND_TRANSFER_TAX_RATES_2026 = {
  BW: 5,
  BY: 3.5,
  BE: 6,
  BB: 6.5,
  HB: 5.5,
  HH: 5.5,
  HE: 6,
  MV: 6,
  NI: 5,
  NRW: 6.5,
  RP: 5,
  SL: 6.5,
  SN: 5.5,
  ST: 5,
  SH: 6.5,
  TH: 5,
} as const;

/** German alias for consumers that mirror the UI terminology. */
export const GRUNDERWERBSTEUER_SAETZE_2026 = LAND_TRANSFER_TAX_RATES_2026;

export type FederalStateCode = keyof typeof LAND_TRANSFER_TAX_RATES_2026;

export interface AcquisitionCostParameters {
  federalState: FederalStateCode | string;
  notaryPercent: number;
  brokerPercent: number;
  /** Defaults to true, so an explicitly supplied broker percentage is used. */
  hasBroker?: boolean;
}

export const DEFAULT_VACANCY_PERCENT = 2;

/** Legacy API callers retain 0%; the UI and saved-object migration use 2%. */
export function normalizeVacancyPercent(value = 0): number {
  return Math.min(100, normalizeFiniteNonNegative(value));
}

export interface OperatingCostParameters {
  livingArea: number;
  maintenancePerSqmMonthly: number;
  managementMonthly: number;
  reserveMonthly: number;
}

export interface StandardCalculationInput
  extends AcquisitionCostParameters,
    OperatingCostParameters {
  purchasePrice: number;
  annualRent: number;
  interestPercent: number;
  repaymentPercent: number;
  scenarioRentIncreasePercent?: number;
  scenarioCostIncreasePercent?: number;
  vacancyPercent?: number;
  equityPercentOfPrice?: number;
  fixedInterestYears?: number;
}

export interface ReverseCalculationInput
  extends AcquisitionCostParameters,
    OperatingCostParameters {
  targetAnnualRent: number;
  offeredPurchasePrice?: number;
  interestPercent: number;
  repaymentPercent: number;
  scenarioRentIncreasePercent?: number;
  scenarioCostIncreasePercent?: number;
  vacancyPercent?: number;
  equityPercentOfPrice?: number;
  fixedInterestYears?: number;
}

export interface NormalizedAcquisitionCostParameters {
  federalState: string;
  notaryPercent: number;
  brokerPercent: number;
  hasBroker: boolean;
}

export interface NormalizedOperatingCostParameters {
  livingArea: number;
  maintenancePerSqmMonthly: number;
  managementMonthly: number;
  reserveMonthly: number;
}

export interface NormalizedStandardCalculationInput
  extends NormalizedAcquisitionCostParameters,
    NormalizedOperatingCostParameters {
  purchasePrice: number;
  annualRent: number;
  interestPercent: number;
  repaymentPercent: number;
  scenarioRentIncreasePercent: number;
  scenarioCostIncreasePercent: number;
  vacancyPercent: number;
  equityPercentOfPrice: number;
  fixedInterestYears: number | null;
}

export interface NormalizedReverseCalculationInput
  extends NormalizedAcquisitionCostParameters,
    NormalizedOperatingCostParameters {
  targetAnnualRent: number;
  offeredPurchasePrice: number;
  interestPercent: number;
  repaymentPercent: number;
  scenarioRentIncreasePercent: number;
  scenarioCostIncreasePercent: number;
  vacancyPercent: number;
  equityPercentOfPrice: number;
  fixedInterestYears: number | null;
}

export interface AcquisitionCostsResult {
  landTransferTaxPercent: number;
  notaryPercent: number;
  brokerPercent: number;
  totalPercent: number;
  landTransferTaxAmount: number;
  notaryAmount: number;
  brokerAmount: number;
  totalAmount: number;
  /** Acquisition-cost equity only; totalEquityRequired also includes equity in price. */
  equityRequired: number;
}

export interface OperatingCostsResult {
  maintenanceAnnual: number;
  managementAnnual: number;
  reserveAnnual: number;
  totalAnnual: number;
  totalMonthly: number;
}

export interface FinancingResult {
  principal: number;
  equityInPrice: number;
  fixedInterestYears: number | null;
  interestPercent: number;
  repaymentPercent: number;
  annuityPercent: number;
  interestAnnual: number;
  interestMonthly: number;
  repaymentAnnual: number;
  repaymentMonthly: number;
  annuityAnnual: number;
  annuityMonthly: number;
}

export interface ChartPortion {
  /** Amount of the annual rent allocated to this portion. */
  annualAmount: number;
  percentOfRent: number;
}

export interface RentCoverageChart {
  operatingCosts: ChartPortion;
  interest: ChartPortion;
  repayment: ChartPortion;
  positiveCashFlow: ChartPortion;
  requiredOutflowAnnual: number;
  coveredOutflowAnnual: number;
  coveragePercent: number;
  coverageGapAnnual: number;
  coverageGapMonthly: number;
}

export interface StandardCaseResult {
  effectiveAnnualRent: number;
  vacancyAnnual: number;
  annualRent: number;
  monthlyRent: number;
  noiAnnual: number;
  noiMonthly: number;
  cashFlowAnnual: number;
  cashFlowMonthly: number;
  grossRentalYieldPercent: number;
  netRentalYieldPercent: number;
  purchasePriceFactor: number;
  returnOnEquityPercent: number;
  monthlyRentPerSqm: number;
  chart: RentCoverageChart;
}

export interface SquareMeterValues {
  purchasePricePerSqm: number;
  totalInvestmentPerSqm: number;
  baseMonthlyRentPerSqm: number;
  scenarioMonthlyRentPerSqm: number;
}

export interface StandardCalculationResult {
  totalEquityRequired: number;
  input: NormalizedStandardCalculationInput;
  acquisitionCosts: AcquisitionCostsResult;
  totalInvestment: number;
  financing: FinancingResult;
  operatingCosts: OperatingCostsResult;
  scenarioOperatingCosts: OperatingCostsResult;
  squareMeterValues: SquareMeterValues;
  base: StandardCaseResult;
  scenario: StandardCaseResult;
}

export interface ReverseCaseResult {
  totalEquityRequired: number;
  financing: FinancingResult;
  /** If unbounded or unaffordable, maxPurchasePrice is a numeric placeholder (0). */
  priceLimitStatus: "bounded" | "unbounded" | "unaffordable";
  effectiveAnnualRent: number;
  vacancyAnnual: number;
  annualRent: number;
  monthlyRent: number;
  noiAnnual: number;
  availableAnnuityAnnual: number;
  maxPurchasePrice: number;
  acquisitionCosts: AcquisitionCostsResult;
  totalInvestment: number;
  monthlyRentPerSqm: number;
  purchasePricePerSqm: number;
  totalInvestmentPerSqm: number;
}

export interface ReverseCalculationResult {
  input: NormalizedReverseCalculationInput;
  annuityPercent: number;
  operatingCosts: OperatingCostsResult;
  scenarioOperatingCosts: OperatingCostsResult;
  base: ReverseCaseResult;
  scenario: ReverseCaseResult;
  offerAnalysis: ReverseOfferAnalysisResult;
}

export interface ReverseOfferAnalysisResult {
  totalEquityRequired: number;
  financing: FinancingResult;
  offeredPurchasePrice: number;
  acquisitionCosts: AcquisitionCostsResult;
  totalInvestment: number;
  requiredAnnualRent: number;
  requiredMonthlyRent: number;
  requiredMonthlyRentPerSqm: number;
  annualRentGap: number;
  isAffordableAtTargetRent: boolean;
}

/**
 * Converts invalid, infinite, or negative numeric input to zero.
 * This is intentionally exported so adapters can apply the same boundary rule.
 */
export function normalizeFiniteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function normalizeEquityPercent(value = 0): number {
  return Math.min(100, normalizeFiniteNonNegative(value));
}

/** Optional whole years; the upcoming projection supports up to 30 years. */
export function normalizeFixedInterestYears(value?: number): number | null {
  if (value === undefined || !Number.isFinite(value) || value < 1) return null;
  return Math.min(30, Math.floor(value));
}

function finiteResult(value: number): number {
  if (Number.isFinite(value)) return value;
  if (value === Number.POSITIVE_INFINITY) return Number.MAX_VALUE;
  if (value === Number.NEGATIVE_INFINITY) return -Number.MAX_VALUE;
  return 0;
}

function nonNegativeResult(value: number): number {
  return Math.max(0, finiteResult(value));
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return finiteResult(numerator / denominator);
}

function normalizeFederalState(value: string): string {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

export function getLandTransferTaxRate(federalState: string): number {
  const normalizedState = normalizeFederalState(federalState);
  return normalizedState in LAND_TRANSFER_TAX_RATES_2026
    ? LAND_TRANSFER_TAX_RATES_2026[normalizedState as FederalStateCode]
    : 0;
}

function normalizeAcquisitionParameters(
  input: AcquisitionCostParameters,
): NormalizedAcquisitionCostParameters {
  const hasBroker = input.hasBroker !== false;

  return {
    federalState: normalizeFederalState(input.federalState),
    notaryPercent: normalizeFiniteNonNegative(input.notaryPercent),
    brokerPercent: hasBroker
      ? normalizeFiniteNonNegative(input.brokerPercent)
      : 0,
    hasBroker,
  };
}

function normalizeOperatingParameters(
  input: OperatingCostParameters,
): NormalizedOperatingCostParameters {
  return {
    livingArea: normalizeFiniteNonNegative(input.livingArea),
    maintenancePerSqmMonthly: normalizeFiniteNonNegative(
      input.maintenancePerSqmMonthly,
    ),
    managementMonthly: normalizeFiniteNonNegative(input.managementMonthly),
    reserveMonthly: normalizeFiniteNonNegative(input.reserveMonthly),
  };
}

export function calculateAcquisitionCosts(
  purchasePriceInput: number,
  input: AcquisitionCostParameters,
): AcquisitionCostsResult {
  const purchasePrice = normalizeFiniteNonNegative(purchasePriceInput);
  const parameters = normalizeAcquisitionParameters(input);
  const landTransferTaxPercent = getLandTransferTaxRate(
    parameters.federalState,
  );
  const totalPercent = nonNegativeResult(
    landTransferTaxPercent +
      parameters.notaryPercent +
      parameters.brokerPercent,
  );
  const landTransferTaxAmount = nonNegativeResult(
    purchasePrice * (landTransferTaxPercent / 100),
  );
  const notaryAmount = nonNegativeResult(
    purchasePrice * (parameters.notaryPercent / 100),
  );
  const brokerAmount = nonNegativeResult(
    purchasePrice * (parameters.brokerPercent / 100),
  );
  const totalAmount = nonNegativeResult(
    landTransferTaxAmount + notaryAmount + brokerAmount,
  );

  return {
    landTransferTaxPercent,
    notaryPercent: parameters.notaryPercent,
    brokerPercent: parameters.brokerPercent,
    totalPercent,
    landTransferTaxAmount,
    notaryAmount,
    brokerAmount,
    totalAmount,
    equityRequired: totalAmount,
  };
}

export function calculateOperatingCosts(
  input: OperatingCostParameters,
): OperatingCostsResult {
  const parameters = normalizeOperatingParameters(input);
  const maintenanceAnnual = nonNegativeResult(
    parameters.maintenancePerSqmMonthly * parameters.livingArea * 12,
  );
  const managementAnnual = nonNegativeResult(parameters.managementMonthly * 12);
  const reserveAnnual = nonNegativeResult(parameters.reserveMonthly * 12);
  const totalAnnual = nonNegativeResult(
    maintenanceAnnual + managementAnnual + reserveAnnual,
  );

  return {
    maintenanceAnnual,
    managementAnnual,
    reserveAnnual,
    totalAnnual,
    totalMonthly: nonNegativeResult(totalAnnual / 12),
  };
}

/** Scale each cost component consistently; the base costs remain untouched. */
function calculateScenarioOperatingCosts(costs: OperatingCostsResult, increasePercent: number): OperatingCostsResult {
  const factor = 1 + increasePercent / 100;
  return {
    maintenanceAnnual: nonNegativeResult(costs.maintenanceAnnual * factor),
    managementAnnual: nonNegativeResult(costs.managementAnnual * factor),
    reserveAnnual: nonNegativeResult(costs.reserveAnnual * factor),
    totalAnnual: nonNegativeResult(costs.totalAnnual * factor),
    totalMonthly: nonNegativeResult(costs.totalMonthly * factor),
  };
}

function calculateFinancing(
  purchasePrice: number,
  interestPercent: number,
  repaymentPercent: number,
  equityPercentOfPrice = 0,
  fixedInterestYears: number | null = null,
): FinancingResult {
  const equityInPrice = nonNegativeResult(purchasePrice * equityPercentOfPrice / 100);
  const principal = nonNegativeResult(purchasePrice - equityInPrice);
  const annuityPercent = nonNegativeResult(interestPercent + repaymentPercent);
  const interestAnnual = nonNegativeResult(
    principal * (interestPercent / 100),
  );
  const repaymentAnnual = nonNegativeResult(
    principal * (repaymentPercent / 100),
  );
  const annuityAnnual = nonNegativeResult(interestAnnual + repaymentAnnual);

  return {
    principal,
    equityInPrice,
    fixedInterestYears,
    interestPercent,
    repaymentPercent,
    annuityPercent,
    interestAnnual,
    interestMonthly: nonNegativeResult(interestAnnual / 12),
    repaymentAnnual,
    repaymentMonthly: nonNegativeResult(repaymentAnnual / 12),
    annuityAnnual,
    annuityMonthly: nonNegativeResult(annuityAnnual / 12),
  };
}

function chartPortion(amount: number, annualRent: number): ChartPortion {
  return {
    annualAmount: nonNegativeResult(amount),
    percentOfRent: nonNegativeResult(safeRatio(amount, annualRent) * 100),
  };
}

function calculateRentCoverageChart(
  annualRent: number,
  operatingCostsAnnual: number,
  financing: FinancingResult,
): RentCoverageChart {
  let remainingRent = annualRent;

  const operatingCostsCovered = Math.min(operatingCostsAnnual, remainingRent);
  remainingRent = nonNegativeResult(remainingRent - operatingCostsCovered);

  const interestCovered = Math.min(financing.interestAnnual, remainingRent);
  remainingRent = nonNegativeResult(remainingRent - interestCovered);

  const repaymentCovered = Math.min(financing.repaymentAnnual, remainingRent);
  remainingRent = nonNegativeResult(remainingRent - repaymentCovered);

  const positiveCashFlow = remainingRent;
  const requiredOutflowAnnual = nonNegativeResult(
    operatingCostsAnnual + financing.annuityAnnual,
  );
  const coveredOutflowAnnual = Math.min(annualRent, requiredOutflowAnnual);
  const coverageGapAnnual = nonNegativeResult(
    requiredOutflowAnnual - annualRent,
  );

  return {
    operatingCosts: chartPortion(operatingCostsCovered, annualRent),
    interest: chartPortion(interestCovered, annualRent),
    repayment: chartPortion(repaymentCovered, annualRent),
    positiveCashFlow: chartPortion(positiveCashFlow, annualRent),
    requiredOutflowAnnual,
    coveredOutflowAnnual,
    coveragePercent:
      requiredOutflowAnnual > 0
        ? nonNegativeResult(
            Math.min(100, safeRatio(annualRent, requiredOutflowAnnual) * 100),
          )
        : 100,
    coverageGapAnnual,
    coverageGapMonthly: nonNegativeResult(coverageGapAnnual / 12),
  };
}

function calculateStandardCase(
  annualRent: number,
  purchasePrice: number,
  totalInvestment: number,
  livingArea: number,
  totalEquityRequired: number,
  operatingCosts: OperatingCostsResult,
  financing: FinancingResult,
  vacancyPercent: number,
): StandardCaseResult {
  const monthlyRent = nonNegativeResult(annualRent / 12);
  const effectiveAnnualRent = annualRent * (1 - vacancyPercent / 100);
  const noiAnnual = finiteResult(effectiveAnnualRent - operatingCosts.totalAnnual);
  const cashFlowAnnual = finiteResult(noiAnnual - financing.annuityAnnual);

  return {
    annualRent,
    effectiveAnnualRent,
    vacancyAnnual: annualRent - effectiveAnnualRent,
    monthlyRent,
    noiAnnual,
    noiMonthly: finiteResult(noiAnnual / 12),
    cashFlowAnnual,
    cashFlowMonthly: finiteResult(cashFlowAnnual / 12),
    // Gross yield and purchase-price factor intentionally use contractual rent.
    grossRentalYieldPercent: finiteResult(
      safeRatio(annualRent, purchasePrice) * 100,
    ),
    netRentalYieldPercent: finiteResult(
      safeRatio(noiAnnual, totalInvestment) * 100,
    ),
    purchasePriceFactor: nonNegativeResult(
      safeRatio(purchasePrice, annualRent),
    ),
    returnOnEquityPercent: finiteResult(
      safeRatio(cashFlowAnnual, totalEquityRequired) * 100,
    ),
    monthlyRentPerSqm: nonNegativeResult(
      safeRatio(monthlyRent, livingArea),
    ),
    chart: calculateRentCoverageChart(
      effectiveAnnualRent,
      operatingCosts.totalAnnual,
      financing,
    ),
  };
}

export function calculateStandard(
  input: StandardCalculationInput,
): StandardCalculationResult {
  const acquisitionParameters = normalizeAcquisitionParameters(input);
  const operatingParameters = normalizeOperatingParameters(input);
  const normalizedInput: NormalizedStandardCalculationInput = {
    ...acquisitionParameters,
    ...operatingParameters,
    purchasePrice: normalizeFiniteNonNegative(input.purchasePrice),
    annualRent: normalizeFiniteNonNegative(input.annualRent),
    interestPercent: normalizeFiniteNonNegative(input.interestPercent),
    repaymentPercent: normalizeFiniteNonNegative(input.repaymentPercent),
    vacancyPercent: normalizeVacancyPercent(input.vacancyPercent),
    equityPercentOfPrice: normalizeEquityPercent(input.equityPercentOfPrice),
    fixedInterestYears: normalizeFixedInterestYears(input.fixedInterestYears),
    scenarioCostIncreasePercent: normalizeScenarioPercent(input.scenarioCostIncreasePercent ?? 0),
    scenarioRentIncreasePercent: normalizeScenarioPercent(
      input.scenarioRentIncreasePercent ?? 0,
    ),
  };
  const acquisitionCosts = calculateAcquisitionCosts(
    normalizedInput.purchasePrice,
    normalizedInput,
  );
  const totalInvestment = nonNegativeResult(
    normalizedInput.purchasePrice + acquisitionCosts.totalAmount,
  );
  const financing = calculateFinancing(
    normalizedInput.purchasePrice,
    normalizedInput.interestPercent,
    normalizedInput.repaymentPercent,
    normalizedInput.equityPercentOfPrice,
    normalizedInput.fixedInterestYears,
  );
  const operatingCosts = calculateOperatingCosts(normalizedInput);
  const scenarioOperatingCosts = calculateScenarioOperatingCosts(operatingCosts, normalizedInput.scenarioCostIncreasePercent);
  const scenarioAnnualRent = nonNegativeResult(
    normalizedInput.annualRent *
      (1 + normalizedInput.scenarioRentIncreasePercent / 100),
  );
  const base = calculateStandardCase(
    normalizedInput.annualRent,
    normalizedInput.purchasePrice,
    totalInvestment,
    normalizedInput.livingArea,
    acquisitionCosts.equityRequired + financing.equityInPrice,
    operatingCosts,
    financing,
    normalizedInput.vacancyPercent,
  );
  const scenario = calculateStandardCase(
    scenarioAnnualRent,
    normalizedInput.purchasePrice,
    totalInvestment,
    normalizedInput.livingArea,
    acquisitionCosts.equityRequired + financing.equityInPrice,
    scenarioOperatingCosts,
    financing,
    normalizedInput.vacancyPercent,
  );

  return {
    input: normalizedInput,
    acquisitionCosts,
    totalInvestment,
    financing,
    totalEquityRequired: acquisitionCosts.totalAmount + financing.equityInPrice,
    operatingCosts,
    scenarioOperatingCosts,
    squareMeterValues: {
      purchasePricePerSqm: nonNegativeResult(
        safeRatio(normalizedInput.purchasePrice, normalizedInput.livingArea),
      ),
      totalInvestmentPerSqm: nonNegativeResult(
        safeRatio(totalInvestment, normalizedInput.livingArea),
      ),
      baseMonthlyRentPerSqm: base.monthlyRentPerSqm,
      scenarioMonthlyRentPerSqm: scenario.monthlyRentPerSqm,
    },
    base,
    scenario,
  };
}

function calculateReverseCase(
  annualRent: number,
  normalizedInput: NormalizedReverseCalculationInput,
  operatingCosts: OperatingCostsResult,
  annuityPercent: number,
): ReverseCaseResult {
  const effectiveAnnualRent = annualRent * (1 - normalizedInput.vacancyPercent / 100);
  const noiAnnual = finiteResult(effectiveAnnualRent - operatingCosts.totalAnnual);
  const availableAnnuityAnnual = nonNegativeResult(noiAnnual);
  const debtFraction = 1 - normalizedInput.equityPercentOfPrice / 100;
  const annualDebtRateOfPrice = annuityPercent / 100 * debtFraction;
  const priceLimitStatus: ReverseCaseResult["priceLimitStatus"] = noiAnnual < 0
    ? "unaffordable" : annualDebtRateOfPrice === 0 ? "unbounded" : "bounded";
  // Without debt service the cashflow model cannot derive a finite price ceiling.
  const maxPurchasePrice = annualDebtRateOfPrice > 0
    ? nonNegativeResult(availableAnnuityAnnual / annualDebtRateOfPrice) : 0;
  const acquisitionCosts = calculateAcquisitionCosts(
    maxPurchasePrice,
    normalizedInput,
  );
  const totalInvestment = nonNegativeResult(
    maxPurchasePrice + acquisitionCosts.totalAmount,
  );
  const monthlyRent = nonNegativeResult(annualRent / 12);
  const financing = calculateFinancing(maxPurchasePrice, normalizedInput.interestPercent,
    normalizedInput.repaymentPercent, normalizedInput.equityPercentOfPrice, normalizedInput.fixedInterestYears);

  return {
    priceLimitStatus,
    financing,
    totalEquityRequired: acquisitionCosts.totalAmount + financing.equityInPrice,
    annualRent,
    effectiveAnnualRent,
    vacancyAnnual: annualRent - effectiveAnnualRent,
    monthlyRent,
    noiAnnual,
    availableAnnuityAnnual,
    maxPurchasePrice,
    acquisitionCosts,
    totalInvestment,
    monthlyRentPerSqm: nonNegativeResult(
      safeRatio(monthlyRent, normalizedInput.livingArea),
    ),
    purchasePricePerSqm: nonNegativeResult(
      safeRatio(maxPurchasePrice, normalizedInput.livingArea),
    ),
    totalInvestmentPerSqm: nonNegativeResult(
      safeRatio(totalInvestment, normalizedInput.livingArea),
    ),
  };
}

export function calculateReverse(
  input: ReverseCalculationInput,
): ReverseCalculationResult {
  const acquisitionParameters = normalizeAcquisitionParameters(input);
  const operatingParameters = normalizeOperatingParameters(input);
  const normalizedInput: NormalizedReverseCalculationInput = {
    ...acquisitionParameters,
    ...operatingParameters,
    targetAnnualRent: normalizeFiniteNonNegative(input.targetAnnualRent),
    offeredPurchasePrice: normalizeFiniteNonNegative(
      input.offeredPurchasePrice ?? 0,
    ),
    interestPercent: normalizeFiniteNonNegative(input.interestPercent),
    repaymentPercent: normalizeFiniteNonNegative(input.repaymentPercent),
    vacancyPercent: normalizeVacancyPercent(input.vacancyPercent),
    equityPercentOfPrice: normalizeEquityPercent(input.equityPercentOfPrice),
    fixedInterestYears: normalizeFixedInterestYears(input.fixedInterestYears),
    scenarioCostIncreasePercent: normalizeScenarioPercent(input.scenarioCostIncreasePercent ?? 0),
    scenarioRentIncreasePercent: normalizeScenarioPercent(
      input.scenarioRentIncreasePercent ?? 0,
    ),
  };
  const annuityPercent = nonNegativeResult(
    normalizedInput.interestPercent + normalizedInput.repaymentPercent,
  );
  const operatingCosts = calculateOperatingCosts(normalizedInput);
  const scenarioOperatingCosts = calculateScenarioOperatingCosts(operatingCosts, normalizedInput.scenarioCostIncreasePercent);
  const scenarioAnnualRent = nonNegativeResult(
    normalizedInput.targetAnnualRent *
      (1 + normalizedInput.scenarioRentIncreasePercent / 100),
  );
  const offerAcquisitionCosts = calculateAcquisitionCosts(
    normalizedInput.offeredPurchasePrice,
    normalizedInput,
  );
  const offerFinancing = calculateFinancing(normalizedInput.offeredPurchasePrice,
    normalizedInput.interestPercent, normalizedInput.repaymentPercent,
    normalizedInput.equityPercentOfPrice, normalizedInput.fixedInterestYears);
  const effectiveRentFraction = 1 - normalizedInput.vacancyPercent / 100;
  const requiredEffectiveRent = nonNegativeResult(
    offerFinancing.annuityAnnual + operatingCosts.totalAnnual,
  );
  // At 100% vacancy no finite contractual rent can cover a positive outflow.
  const requiredAnnualRent = effectiveRentFraction > 0
    ? nonNegativeResult(requiredEffectiveRent / effectiveRentFraction)
    : requiredEffectiveRent > 0 ? Number.MAX_VALUE : 0;
  const requiredMonthlyRent = nonNegativeResult(requiredAnnualRent / 12);

  return {
    input: normalizedInput,
    annuityPercent,
    operatingCosts,
    scenarioOperatingCosts,
    base: calculateReverseCase(
      normalizedInput.targetAnnualRent,
      normalizedInput,
      operatingCosts,
      annuityPercent,
    ),
    scenario: calculateReverseCase(
      scenarioAnnualRent,
      normalizedInput,
      scenarioOperatingCosts,
      annuityPercent,
    ),
    offerAnalysis: {
      financing: offerFinancing,
      totalEquityRequired: offerAcquisitionCosts.totalAmount + offerFinancing.equityInPrice,
      offeredPurchasePrice: normalizedInput.offeredPurchasePrice,
      acquisitionCosts: offerAcquisitionCosts,
      totalInvestment: nonNegativeResult(
        normalizedInput.offeredPurchasePrice + offerAcquisitionCosts.totalAmount,
      ),
      requiredAnnualRent,
      requiredMonthlyRent,
      requiredMonthlyRentPerSqm: nonNegativeResult(
        safeRatio(requiredMonthlyRent, normalizedInput.livingArea),
      ),
      annualRentGap: finiteResult(
        requiredAnnualRent - normalizedInput.targetAnnualRent,
      ),
      isAffordableAtTargetRent:
        normalizedInput.offeredPurchasePrice > 0 &&
        normalizedInput.targetAnnualRent >= requiredAnnualRent,
    },
  };
}

