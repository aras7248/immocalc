import { calculateReverse, calculateStandard, type FederalStateCode } from "../../lib/calculations.ts";

export interface ValuationInput {
  address: string;
  type: string;
  area: number;
  year: number;
  askingPrice: number;
  annualRent: number;
  comparisonPricesPerSqm: number[];
  comparisonSources: string[];
  federalState: FederalStateCode;
  interest: number;
  repayment: number;
  maintenancePerSqmMonthly: number;
  managementMonthly: number;
  reserveMonthly: number;
  notaryPercent: number;
  brokerPercent: number;
  renovationBudget: number;
  remarks: string;
}

export interface ValuationResult {
  comparisonRange: { low: number; middle: number; high: number } | null;
  investmentLimit: number | null;
  offerDifference: number | null;
  finance: ReturnType<typeof calculateStandard> | null;
  warnings: string[];
  status: "Unvollständig" | "Vorläufig";
}

const valid = (n: number) => Number.isFinite(n) && n >= 0;
const positive = (n: number) => Number.isFinite(n) && n > 0;
const round = (n: number) => Math.round(n);

export function evaluateProperty(data: ValuationInput): ValuationResult {
  const warnings: string[] = [];
  if (!data.address.trim()) warnings.push("Die Objektadresse fehlt.");
  if (!positive(data.area)) warnings.push("Bitte eine gültige Wohnfläche eintragen.");
  if (!positive(data.askingPrice)) warnings.push("Bitte einen gültigen Angebotspreis eintragen.");
  if (!positive(data.annualRent)) warnings.push("Ohne Jahreskaltmiete ist eine Miet- und Renditebewertung nicht möglich.");
  if (data.year && (data.year < 1800 || data.year > new Date().getFullYear() + 2)) warnings.push("Das Baujahr scheint nicht zu stimmen.");
  if (!valid(data.renovationBudget)) warnings.push("Bitte die Sanierungskosten überprüfen.");
  if (!positive(data.interest + data.repayment)) warnings.push("Zins und Tilgung müssen zusammen größer als 0 sein.");

  const comparisons = data.comparisonPricesPerSqm.filter(positive);
  const sourced = data.comparisonPricesPerSqm.filter((price, i) => positive(price) && !!data.comparisonSources[i]?.trim());
  if (comparisons.length < 3) warnings.push("Für einen Marktvergleich fehlen noch mindestens drei passende Vergleichsangebote.");
  if (sourced.length !== comparisons.length) warnings.push("Für alle Vergleichsangebote bitte eine Quelle eintragen.");
  warnings.push("Vergleichsangebote sind keine nachgewiesenen Verkaufspreise. Zustand, Lage und Ausstattung müssen vergleichbar sein.");
  warnings.push("Die Berechnung ist eine Orientierung, kein anerkanntes Verkehrswertgutachten.");

  let comparisonRange: ValuationResult["comparisonRange"] = null;
  if (positive(data.area) && comparisons.length >= 3 && sourced.length === comparisons.length) {
    const values = comparisons.map(n => n * data.area).sort((a, b) => a - b);
    // Keine pauschalen, unbelegten Zu- oder Abschläge: beobachtete Spanne und Median.
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    comparisonRange = { low: round(values[0]), middle: round(median), high: round(values[values.length - 1]) };
  }

  const financeReady = positive(data.askingPrice) && positive(data.area) && valid(data.annualRent) &&
    positive(data.interest + data.repayment) && valid(data.maintenancePerSqmMonthly) &&
    valid(data.managementMonthly) && valid(data.reserveMonthly);
  const common = {
    federalState: data.federalState,
    notaryPercent: data.notaryPercent,
    brokerPercent: data.brokerPercent,
    hasBroker: data.brokerPercent > 0,
    livingArea: data.area,
    maintenancePerSqmMonthly: data.maintenancePerSqmMonthly,
    managementMonthly: data.managementMonthly,
    reserveMonthly: data.reserveMonthly,
    interestPercent: data.interest,
    repaymentPercent: data.repayment,
  };
  const finance = financeReady ? calculateStandard({
    ...common, purchasePrice: data.askingPrice, annualRent: data.annualRent,
  }) : null;
  const investmentLimit = financeReady ? Math.max(0, round(calculateReverse({
    ...common, targetAnnualRent: data.annualRent,
  }).base.maxPurchasePrice - Math.max(0, data.renovationBudget))) : null;

  if (finance && finance.operatingCosts.totalAnnual > data.annualRent)
    warnings.push("Die laufenden Kosten liegen über den Mieteinnahmen.");
  if (comparisonRange && data.askingPrice > comparisonRange.high)
    warnings.push("Der Angebotspreis liegt über der Spanne der eingegebenen Vergleichsangebote.");
  return {
    comparisonRange, investmentLimit,
    offerDifference: comparisonRange ? round(data.askingPrice - comparisonRange.middle) : null,
    finance, warnings, status: !positive(data.askingPrice) || !positive(data.area) || !data.address.trim() ? "Unvollständig" : "Vorläufig",
  };
}
