import { DEFAULT_VACANCY_PERCENT } from '../../lib/calculations.ts';
import { normalizeScenarioPercent } from '../../lib/scenario.ts';
import { isRecord, mergeState, readSavedScenarioCostIncrease } from '../../lib/savedState.ts';
// Interface for saved objects
export interface SavedObject {
  id: string;
  db_id?: string;
  updatedAt: string | null;
  date: string;
  calc: CalcState;
  rev: ReverseState;
  mieten: string[];
  rentIncrease: number;
  scenarioCostIncreasePercent: number;
}

// Interface for standard calculation
export interface CalcState {
  objektname: string;
  anzahlEinheiten: string;
  kaufpreis: string;
  bundesland: string;
  notarProzent: string;
  movableItemsAmount: string;
  hasMakler: boolean;
  maklerProzent: string;
  zins: string;
  tilgung: string;
  equityPercentOfPrice: string;
  fixedInterestYears: string;
  mietePM: string;
  mietePA: string;
  wohnflaeche: string;
  baujahr: string;
  instandhaltungQm: string;
  verwaltungPm: string;
  ruecklagePm: string;
  vacancyPercent: string;
}

// Interface for reverse calculation
export interface ReverseState {
  wohnflaeche: string;
  targetMode: string;
  targetCashFlowAnnual: string;
  targetNetYieldPercent: string;
  angebotspreis: string;
  bundesland: string;
  notarProzent: string;
  movableItemsAmount: string;
  hasMakler: boolean;
  maklerProzent: string;
  zins: string;
  tilgung: string;
  equityPercentOfPrice: string;
  fixedInterestYears: string;
  zielMietePA: string;
  zielMietpreisQm: string; // NEU
  instandhaltungQm: string;
  verwaltungPm: string;
  ruecklagePm: string;
  vacancyPercent: string;
}

export const initialCalcState: CalcState = {
  objektname: "Musterstraße 1",
  anzahlEinheiten: "3",
  kaufpreis: "350.000,00",
  bundesland: "NRW",
  notarProzent: "2,00",
  movableItemsAmount: "0,00",
  hasMakler: true,
  maklerProzent: "3,57",
  zins: "4,00",
  tilgung: "1,50",
  equityPercentOfPrice: "0,00",
  fixedInterestYears: "",
  mietePM: "1.825,00",
  mietePA: "21.900,00",
  wohnflaeche: "268,00",
  baujahr: "1980",
  instandhaltungQm: "1,00",
  verwaltungPm: "30,00",
  vacancyPercent: DEFAULT_VACANCY_PERCENT.toFixed(2).replace(".", ","),
  ruecklagePm: "50,00"
};

export const initialRevState: ReverseState = {
  targetMode: "cashflow",
  targetCashFlowAnnual: "0,00",
  targetNetYieldPercent: "",
  wohnflaeche: "268,00",
  angebotspreis: "350.000,00",
  bundesland: "NRW",
  notarProzent: "2,00",
  movableItemsAmount: "0,00",
  hasMakler: true,
  maklerProzent: "3,57",
  zins: "4,00",
  tilgung: "1,50",
  equityPercentOfPrice: "0,00",
  fixedInterestYears: "",
  zielMietePA: "32.160,00",
  zielMietpreisQm: "10,00",
  instandhaltungQm: "1,00",
  verwaltungPm: "30,00",
  vacancyPercent: DEFAULT_VACANCY_PERCENT.toFixed(2).replace(".", ","),
  ruecklagePm: "50,00"
};

export const emptyCalcState: CalcState = {
  objektname: "",
  anzahlEinheiten: "",
  kaufpreis: "",
  bundesland: "NRW",
  notarProzent: "",
  movableItemsAmount: "0,00",
  hasMakler: false,
  maklerProzent: "",
  zins: "",
  tilgung: "",
  equityPercentOfPrice: "0,00",
  fixedInterestYears: "",
  mietePM: "",
  mietePA: "",
  wohnflaeche: "",
  baujahr: "",
  instandhaltungQm: "",
  verwaltungPm: "",
  vacancyPercent: DEFAULT_VACANCY_PERCENT.toFixed(2).replace(".", ","),
  ruecklagePm: ""
};

export const emptyRevState: ReverseState = {
  targetMode: "cashflow",
  targetCashFlowAnnual: "0,00",
  targetNetYieldPercent: "",
  wohnflaeche: "",
  angebotspreis: "",
  bundesland: "NRW",
  notarProzent: "",
  movableItemsAmount: "0,00",
  hasMakler: false,
  maklerProzent: "",
  zins: "",
  tilgung: "",
  equityPercentOfPrice: "0,00",
  fixedInterestYears: "",
  zielMietePA: "",
  zielMietpreisQm: "",
  instandhaltungQm: "",
  verwaltungPm: "",
  vacancyPercent: DEFAULT_VACANCY_PERCENT.toFixed(2).replace(".", ","),
  ruecklagePm: ""
};

export function parseSavedObjectRow(row: unknown): SavedObject | null {
  if (!isRecord(row) || typeof row.id !== "string" || !isRecord(row.calc_data)) return null;

  const payload = row.calc_data;
  const createdAt = typeof row.created_at === "string" ? new Date(row.created_at) : new Date();
  const parsedRentIncrease = normalizeScenarioPercent(payload.rentIncrease);

  const parsedCalc = mergeState(initialCalcState, payload.calc);
  const parsedRev = mergeState(initialRevState, payload.rev);
  if (!isRecord(payload.rev) || typeof payload.rev.wohnflaeche !== "string") {
    parsedRev.wohnflaeche = parsedCalc.wohnflaeche;
  }
  if (!isRecord(payload.rev) || typeof payload.rev.angebotspreis !== "string") {
    parsedRev.angebotspreis = parsedCalc.kaufpreis;
  }

  return {
    id: row.id,
    db_id: row.id,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    date: Number.isNaN(createdAt.getTime())
      ? new Date().toISOString().split("T")[0]
      : createdAt.toISOString().split("T")[0],
    calc: parsedCalc,
    rev: parsedRev,
    mieten: Array.isArray(payload.mieten)
      ? payload.mieten.filter((entry): entry is string => typeof entry === "string").slice(0, 10)
      : [""],
    rentIncrease: parsedRentIncrease,
    scenarioCostIncreasePercent: readSavedScenarioCostIncrease(payload.scenarioCostIncreasePercent),
  };
}

