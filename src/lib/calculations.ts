/**
 * Pure real-estate calculations used by the standard and reverse calculators.
 *
 * Financing model:
 * - the total investment consists of purchase price plus acquisition costs;
 * - supplied equity reduces the financed amount;
 * - missing or zero equity means the total investment is financed;
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

export interface OperatingCostParameters {
  livingArea: number;
  maintenancePerSqmMonthly: number;
  managementMonthly: number;
  reserveMonthly: number;
  nonRecoverableHoaMonthly?: number;
  otherOwnerCostsMonthly?: number;
}

export interface StandardCalculationInput
  extends AcquisitionCostParameters,
    OperatingCostParameters {
  purchasePrice: number;
  annualRent: number;
  equityAmount?: number;
  interestPercent: number;
  repaymentPercent: number;
  scenarioRentIncreasePercent?: number;
}

export interface ReverseCalculationInput
  extends AcquisitionCostParameters,
    OperatingCostParameters {
  targetAnnualRent: number;
  offeredPurchasePrice?: number;
  equityAmount?: number;
  interestPercent: number;
  repaymentPercent: number;
  scenarioRentIncreasePercent?: number;
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
  nonRecoverableHoaMonthly: number;
  otherOwnerCostsMonthly: number;
}

export interface NormalizedStandardCalculationInput
  extends NormalizedAcquisitionCostParameters,
    NormalizedOperatingCostParameters {
  purchasePrice: number;
  annualRent: number;
  equityAmount: number;
  interestPercent: number;
  repaymentPercent: number;
  scenarioRentIncreasePercent: number;
}

export interface NormalizedReverseCalculationInput
  extends NormalizedAcquisitionCostParameters,
    NormalizedOperatingCostParameters {
  targetAnnualRent: number;
  offeredPurchasePrice: number;
  equityAmount: number;
  interestPercent: number;
  repaymentPercent: number;
  scenarioRentIncreasePercent: number;
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
  /** Acquisition costs as a common equity benchmark; actual equity is user-defined. */
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
  input: NormalizedStandardCalculationInput;
  acquisitionCosts: AcquisitionCostsResult;
  totalInvestment: number;
  equityUsed: number;
  financingRatioPercent: number;
  financing: FinancingResult;
  operatingCosts: OperatingCostsResult;
  squareMeterValues: SquareMeterValues;
  base: StandardCaseResult;
  scenario: StandardCaseResult;
}

export interface ReverseCaseResult {
  annualRent: number;
  monthlyRent: number;
  noiAnnual: number;
  availableAnnuityAnnual: number;
  maxPurchasePrice: number;
  acquisitionCosts: AcquisitionCostsResult;
  totalInvestment: number;
  equityUsed: number;
  financedAmount: number;
  monthlyRentPerSqm: number;
  purchasePricePerSqm: number;
  totalInvestmentPerSqm: number;
}

export interface ReverseCalculationResult {
  input: NormalizedReverseCalculationInput;
  annuityPercent: number;
  operatingCosts: OperatingCostsResult;
  base: ReverseCaseResult;
  scenario: ReverseCaseResult;
  offerAnalysis: ReverseOfferAnalysisResult;
}

export interface ReverseOfferAnalysisResult {
  offeredPurchasePrice: number;
  acquisitionCosts: AcquisitionCostsResult;
  totalInvestment: number;
  equityUsed: number;
  financedAmount: number;
  requiredAnnualRent: number;
  requiredMonthlyRent: number;
  requiredMonthlyRentPerSqm: number;
  annualRentGap: number;
  isAffordableAtTargetRent: boolean;
}

export interface CashFlowTargetResult {
  targetMonthlyCashFlow: number;
  targetAnnualCashFlow: number;
  currentMonthlyRent: number;
  currentAnnualRent: number;
  requiredMonthlyRentAtOffer: number;
  requiredAnnualRentAtOffer: number;
  requiredMonthlyRentPerSqmAtOffer: number;
  monthlyRentGapAtOffer: number;
  annualRentGapAtOffer: number;
  requiredRentChangePercentAtOffer: number;
  maxPurchasePriceAtCurrentRent: number;
  totalInvestmentAtCurrentRent: number;
}

export interface CashFlowMarginTargetResult {
  targetCashFlowMarginPercent: number;
  currentMonthlyRent: number;
  currentAnnualRent: number;
  targetCashFlowMonthlyAtCurrentRent: number;
  targetCashFlowMonthlyAtOffer: number;
  requiredMonthlyRentAtOffer: number;
  requiredAnnualRentAtOffer: number;
  requiredMonthlyRentPerSqmAtOffer: number;
  monthlyRentGapAtOffer: number;
  annualRentGapAtOffer: number;
  requiredRentChangePercentAtOffer: number;
  maxPurchasePriceAtCurrentRent: number;
  totalInvestmentAtCurrentRent: number;
}

/**
 * Converts invalid, infinite, or negative numeric input to zero.
 * This is intentionally exported so adapters can apply the same boundary rule.
 */
export function normalizeFiniteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
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
    nonRecoverableHoaMonthly: normalizeFiniteNonNegative(input.nonRecoverableHoaMonthly ?? 0),
    otherOwnerCostsMonthly: normalizeFiniteNonNegative(input.otherOwnerCostsMonthly ?? 0),
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
    maintenanceAnnual + managementAnnual + reserveAnnual
      + parameters.nonRecoverableHoaMonthly * 12 + parameters.otherOwnerCostsMonthly * 12,
  );

  return {
    maintenanceAnnual,
    managementAnnual,
    reserveAnnual,
    totalAnnual,
    totalMonthly: nonNegativeResult(totalAnnual / 12),
  };
}

function calculateFinancing(
  principal: number,
  interestPercent: number,
  repaymentPercent: number,
): FinancingResult {
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
  equityUsed: number,
  operatingCosts: OperatingCostsResult,
  financing: FinancingResult,
): StandardCaseResult {
  const monthlyRent = nonNegativeResult(annualRent / 12);
  const noiAnnual = finiteResult(annualRent - operatingCosts.totalAnnual);
  const cashFlowAnnual = finiteResult(noiAnnual - financing.annuityAnnual);

  return {
    annualRent,
    monthlyRent,
    noiAnnual,
    noiMonthly: finiteResult(noiAnnual / 12),
    cashFlowAnnual,
    cashFlowMonthly: finiteResult(cashFlowAnnual / 12),
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
      safeRatio(cashFlowAnnual, equityUsed) * 100,
    ),
    monthlyRentPerSqm: nonNegativeResult(
      safeRatio(monthlyRent, livingArea),
    ),
    chart: calculateRentCoverageChart(
      annualRent,
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
    equityAmount: normalizeFiniteNonNegative(input.equityAmount ?? 0),
    interestPercent: normalizeFiniteNonNegative(input.interestPercent),
    repaymentPercent: normalizeFiniteNonNegative(input.repaymentPercent),
    scenarioRentIncreasePercent: normalizeFiniteNonNegative(
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
  const equityUsed = Math.min(normalizedInput.equityAmount, totalInvestment);
  const financedAmount = nonNegativeResult(totalInvestment - equityUsed);
  const financing = calculateFinancing(
    financedAmount,
    normalizedInput.interestPercent,
    normalizedInput.repaymentPercent,
  );
  const operatingCosts = calculateOperatingCosts(normalizedInput);
  const scenarioAnnualRent = nonNegativeResult(
    normalizedInput.annualRent *
      (1 + normalizedInput.scenarioRentIncreasePercent / 100),
  );
  const base = calculateStandardCase(
    normalizedInput.annualRent,
    normalizedInput.purchasePrice,
    totalInvestment,
    normalizedInput.livingArea,
    equityUsed,
    operatingCosts,
    financing,
  );
  const scenario = calculateStandardCase(
    scenarioAnnualRent,
    normalizedInput.purchasePrice,
    totalInvestment,
    normalizedInput.livingArea,
    equityUsed,
    operatingCosts,
    financing,
  );

  return {
    input: normalizedInput,
    acquisitionCosts,
    totalInvestment,
    equityUsed,
    financingRatioPercent: nonNegativeResult(
      safeRatio(financedAmount, normalizedInput.purchasePrice) * 100,
    ),
    financing,
    operatingCosts,
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
  const noiAnnual = finiteResult(annualRent - operatingCosts.totalAnnual);
  const availableAnnuityAnnual = nonNegativeResult(noiAnnual);
  const acquisitionCostPercent = nonNegativeResult(
    getLandTransferTaxRate(normalizedInput.federalState)
      + normalizedInput.notaryPercent
      + normalizedInput.brokerPercent,
  );
  const maxPurchasePrice =
    annuityPercent > 0
      ? nonNegativeResult(
          (
            availableAnnuityAnnual / (annuityPercent / 100)
            + normalizedInput.equityAmount
          ) / (1 + acquisitionCostPercent / 100),
        )
      : 0;
  const acquisitionCosts = calculateAcquisitionCosts(
    maxPurchasePrice,
    normalizedInput,
  );
  const totalInvestment = nonNegativeResult(
    maxPurchasePrice + acquisitionCosts.totalAmount,
  );
  const equityUsed = Math.min(normalizedInput.equityAmount, totalInvestment);
  const financedAmount = nonNegativeResult(totalInvestment - equityUsed);
  const monthlyRent = nonNegativeResult(annualRent / 12);

  return {
    annualRent,
    monthlyRent,
    noiAnnual,
    availableAnnuityAnnual,
    maxPurchasePrice,
    acquisitionCosts,
    totalInvestment,
    equityUsed,
    financedAmount,
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
    equityAmount: normalizeFiniteNonNegative(input.equityAmount ?? 0),
    interestPercent: normalizeFiniteNonNegative(input.interestPercent),
    repaymentPercent: normalizeFiniteNonNegative(input.repaymentPercent),
    scenarioRentIncreasePercent: normalizeFiniteNonNegative(
      input.scenarioRentIncreasePercent ?? 0,
    ),
  };
  const annuityPercent = nonNegativeResult(
    normalizedInput.interestPercent + normalizedInput.repaymentPercent,
  );
  const operatingCosts = calculateOperatingCosts(normalizedInput);
  const scenarioAnnualRent = nonNegativeResult(
    normalizedInput.targetAnnualRent *
      (1 + normalizedInput.scenarioRentIncreasePercent / 100),
  );
  const offerAcquisitionCosts = calculateAcquisitionCosts(
    normalizedInput.offeredPurchasePrice,
    normalizedInput,
  );
  const offerTotalInvestment = nonNegativeResult(
    normalizedInput.offeredPurchasePrice + offerAcquisitionCosts.totalAmount,
  );
  const offerEquityUsed = Math.min(
    normalizedInput.equityAmount,
    offerTotalInvestment,
  );
  const offerFinancedAmount = nonNegativeResult(
    offerTotalInvestment - offerEquityUsed,
  );
  const requiredAnnualRent = nonNegativeResult(
    offerFinancedAmount * (annuityPercent / 100) +
      operatingCosts.totalAnnual,
  );
  const requiredMonthlyRent = nonNegativeResult(requiredAnnualRent / 12);

  return {
    input: normalizedInput,
    annuityPercent,
    operatingCosts,
    base: calculateReverseCase(
      normalizedInput.targetAnnualRent,
      normalizedInput,
      operatingCosts,
      annuityPercent,
    ),
    scenario: calculateReverseCase(
      scenarioAnnualRent,
      normalizedInput,
      operatingCosts,
      annuityPercent,
    ),
    offerAnalysis: {
      offeredPurchasePrice: normalizedInput.offeredPurchasePrice,
      acquisitionCosts: offerAcquisitionCosts,
      totalInvestment: offerTotalInvestment,
      equityUsed: offerEquityUsed,
      financedAmount: offerFinancedAmount,
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

/**
 * Derives both sides of a desired cash-flow scenario:
 * - the rent required at the offered purchase price; and
 * - the maximum purchase price that preserves the desired cash flow at the
 *   currently supplied rent.
 */
export function calculateCashFlowTarget(
  input: ReverseCalculationInput,
  targetMonthlyCashFlowInput: number,
): CashFlowTargetResult {
  const targetMonthlyCashFlow = normalizeFiniteNonNegative(
    targetMonthlyCashFlowInput,
  );
  const targetAnnualCashFlow = targetMonthlyCashFlow * 12;
  const currentResult = calculateReverse(input);
  const currentAnnualRent = currentResult.input.targetAnnualRent;
  const currentMonthlyRent = currentAnnualRent / 12;
  const requiredAnnualRentAtOffer = nonNegativeResult(
    currentResult.offerAnalysis.requiredAnnualRent + targetAnnualCashFlow,
  );
  const requiredMonthlyRentAtOffer = requiredAnnualRentAtOffer / 12;
  const affordabilityRent = nonNegativeResult(
    currentAnnualRent - targetAnnualCashFlow,
  );
  const affordabilityResult = calculateReverse({
    ...input,
    targetAnnualRent: affordabilityRent,
    scenarioRentIncreasePercent: 0,
  });

  return {
    targetMonthlyCashFlow,
    targetAnnualCashFlow,
    currentMonthlyRent,
    currentAnnualRent,
    requiredMonthlyRentAtOffer,
    requiredAnnualRentAtOffer,
    requiredMonthlyRentPerSqmAtOffer: nonNegativeResult(
      safeRatio(requiredMonthlyRentAtOffer, currentResult.input.livingArea),
    ),
    monthlyRentGapAtOffer: finiteResult(
      requiredMonthlyRentAtOffer - currentMonthlyRent,
    ),
    annualRentGapAtOffer: finiteResult(
      requiredAnnualRentAtOffer - currentAnnualRent,
    ),
    requiredRentChangePercentAtOffer: finiteResult(
      safeRatio(
        requiredAnnualRentAtOffer - currentAnnualRent,
        currentAnnualRent,
      ) * 100,
    ),
    maxPurchasePriceAtCurrentRent:
      affordabilityResult.base.maxPurchasePrice,
    totalInvestmentAtCurrentRent:
      affordabilityResult.base.totalInvestment,
  };
}

/**
 * Calculates a scalable comfort corridor as a percentage of monthly cold rent.
 *
 * At the offered purchase price, the required rent is solved so that the
 * desired margin remains after operating costs and annuity:
 * required rent = break-even rent / (1 - margin).
 *
 * At the current rent, the same margin is reserved as cash flow before the
 * maximum affordable purchase price is derived.
 */
export function calculateCashFlowMarginTarget(
  input: ReverseCalculationInput,
  targetCashFlowMarginPercentInput: number,
): CashFlowMarginTargetResult {
  const targetCashFlowMarginPercent = Math.min(
    95,
    normalizeFiniteNonNegative(targetCashFlowMarginPercentInput),
  );
  const marginFraction = targetCashFlowMarginPercent / 100;
  const currentResult = calculateReverse(input);
  const currentAnnualRent = currentResult.input.targetAnnualRent;
  const currentMonthlyRent = currentAnnualRent / 12;
  const breakEvenMonthlyRent = currentResult.offerAnalysis.requiredMonthlyRent;
  const requiredMonthlyRentAtOffer = marginFraction < 1
    ? nonNegativeResult(breakEvenMonthlyRent / (1 - marginFraction))
    : 0;
  const requiredAnnualRentAtOffer = requiredMonthlyRentAtOffer * 12;
  const targetCashFlowMonthlyAtOffer = nonNegativeResult(
    requiredMonthlyRentAtOffer - breakEvenMonthlyRent,
  );
  const targetCashFlowMonthlyAtCurrentRent = nonNegativeResult(
    currentMonthlyRent * marginFraction,
  );
  const affordabilityRent = nonNegativeResult(
    currentAnnualRent * (1 - marginFraction),
  );
  const affordabilityResult = calculateReverse({
    ...input,
    targetAnnualRent: affordabilityRent,
    scenarioRentIncreasePercent: 0,
  });

  return {
    targetCashFlowMarginPercent,
    currentMonthlyRent,
    currentAnnualRent,
    targetCashFlowMonthlyAtCurrentRent,
    targetCashFlowMonthlyAtOffer,
    requiredMonthlyRentAtOffer,
    requiredAnnualRentAtOffer,
    requiredMonthlyRentPerSqmAtOffer: nonNegativeResult(
      safeRatio(requiredMonthlyRentAtOffer, currentResult.input.livingArea),
    ),
    monthlyRentGapAtOffer: finiteResult(
      requiredMonthlyRentAtOffer - currentMonthlyRent,
    ),
    annualRentGapAtOffer: finiteResult(
      requiredAnnualRentAtOffer - currentAnnualRent,
    ),
    requiredRentChangePercentAtOffer: finiteResult(
      safeRatio(
        requiredAnnualRentAtOffer - currentAnnualRent,
        currentAnnualRent,
      ) * 100,
    ),
    maxPurchasePriceAtCurrentRent:
      affordabilityResult.base.maxPurchasePrice,
    totalInvestmentAtCurrentRent:
      affordabilityResult.base.totalInvestment,
  };
}
