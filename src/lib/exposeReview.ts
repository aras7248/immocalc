import { parseNumber } from './numbers.ts';
import type { ExposeImportResult, ExposeFacts } from './exposeImport.ts';
export type ReviewedExpose = ExposeImportResult & { facts?: ExposeFacts };
const factFields: Record<string, [string, string, string]> = {
  address: ['address', 'Adresse', ''], kaufpreis: ['purchasePrice', 'Kaufpreis', ' €'], wohnflaeche: ['livingArea', 'Wohnfläche', ' m²'], baujahr: ['yearBuilt', 'Baujahr', ''], maklerProzent: ['broker', 'Käuferprovision', ' %'], mietePM: ['monthlyRent', 'Kaltmiete / Monat', ' €'], bundesland: ['federalState', 'Bundesland', ''],
};
export function editExposeReview(previous: ReviewedExpose, field: keyof ExposeImportResult, value: string): ReviewedExpose {
  const next = { ...previous, [field]: value || undefined };
  if (field === 'address') next.objektname = value || undefined;
  if (field === 'maklerProzent') {
    next.hasMakler = value ? parseNumber(value) > 0 : undefined;
    next.commissionWarning = undefined;
  }
  const fact = factFields[field];
  if (fact && previous.facts) {
    const [key, label, unit] = fact;
    next.facts = {
      ...previous.facts,
      facts: [...previous.facts.facts.filter(item => item.key !== key), ...(value ? [{ key, label: `${label} (Nutzerkorrektur)`, value: value + unit }] : [])],
      warnings: Array.from(new Set([...previous.facts.warnings, `${label} wurde in der Importvorschau manuell geändert und ist als Nutzerangabe zu prüfen.`])),
    };
  }
  return next;
}
export function validateExposeReview(value: ExposeImportResult): string | null {
  for (const [key, label, strictlyPositive] of [['kaufpreis', 'Kaufpreis', true], ['wohnflaeche', 'Wohnfläche', true], ['mietePM', 'Kaltmiete', false], ['maklerProzent', 'Käuferprovision', false]] as const) {
    const raw = value[key]?.trim();
    if (!raw) continue;
    if (!/^(?:(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?|\d+\.\d{1,2})$/.test(raw.replace(/\s/g, "")) || !Number.isFinite(parseNumber(raw)) || (strictlyPositive ? parseNumber(raw) <= 0 : parseNumber(raw) < 0)) return `${label}: Bitte eine gültige ${strictlyPositive ? 'positive ' : ''}Zahl eingeben oder das Feld leer lassen.`;
    if (key === 'maklerProzent' && parseNumber(raw) > 100) return 'Käuferprovision: Bitte einen Prozentsatz zwischen 0 und 100 eingeben.';
  }
  if (value.baujahr && (!/^\d{4}$/.test(value.baujahr) || Number(value.baujahr) < 1800 || Number(value.baujahr) > 2100)) return 'Baujahr: Bitte eine vierstellige Jahreszahl zwischen 1800 und 2100 eingeben.';
  return null;
}

/** Only explicitly confirmed import fields replace premium assumptions. */
export function syncReviewedPremium<T extends { purchasePrice: number; livingArea: number; monthlyRent: number; federalState: string; brokerPercent: number; hasBroker: boolean }>(premium: T, reviewed: ExposeImportResult): T {
  return {
    ...premium,
    ...(reviewed.kaufpreis?.trim() ? {purchasePrice: parseNumber(reviewed.kaufpreis)} : {}),
    ...(reviewed.wohnflaeche?.trim() ? {livingArea: parseNumber(reviewed.wohnflaeche)} : {}),
    ...(reviewed.mietePM?.trim() ? {monthlyRent: parseNumber(reviewed.mietePM)} : {}),
    ...(reviewed.bundesland ? {federalState: reviewed.bundesland} : {}),
    ...(reviewed.maklerProzent?.trim() ? {brokerPercent: parseNumber(reviewed.maklerProzent)} : {}),
    ...(reviewed.hasMakler !== undefined ? {hasBroker: reviewed.hasMakler} : {}),
  };
}
