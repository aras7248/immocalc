import { GERMAN_POSTAL_STATES } from './germanPostalStates.ts';

export const FEDERAL_STATE_NAMES: Record<string, string> = {
  BB: 'Brandenburg', BE: 'Berlin', BW: 'Baden-Württemberg', BY: 'Bayern', HB: 'Bremen', HE: 'Hessen', HH: 'Hamburg', MV: 'Mecklenburg-Vorpommern', NI: 'Niedersachsen', NRW: 'Nordrhein-Westfalen', RP: 'Rheinland-Pfalz', SH: 'Schleswig-Holstein', SL: 'Saarland', SN: 'Sachsen', ST: 'Sachsen-Anhalt', TH: 'Thüringen',
};

export function extractPropertyState(address: string | undefined, text: string) {
  const postalCodes = Array.from(address?.matchAll(/\b(\d{5})\b/g) ?? []).map(match => match[1]);
  const postalState = postalCodes.length === 1 ? GERMAN_POSTAL_STATES[postalCodes[0]] : undefined;
  const explicit = /(?:^|\n)\s*Bundesland\s*:?\s*([^\n]+)/i.exec(text)?.[1].trim();
  const explicitState = explicit ? Object.entries(FEDERAL_STATE_NAMES).find(([code, name]) => explicit.toLowerCase() === code.toLowerCase() || explicit.toLowerCase() === name.toLowerCase())?.[0] : undefined;
  if (postalState && explicitState && postalState !== explicitState) return undefined;
  return postalState || explicitState;
}

/** Extracts the buyer's stated gross commission; never divides a total rate. */
export function extractBuyerCommission(text: string): { maklerProzent?: string; hasMakler?: boolean; commissionWarning?: string } {
  const lines = text.replace(/\u00a0/g, ' ').split(/\n/).map(line => line.trim()).filter(Boolean);
  const rates: number[] = [];
  let free = false;
  let uncertain = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/Innencourtage/i.test(line) && !/\bKäufer/i.test(line)) continue;
    if (/Verkäufer/i.test(line) && !/\bKäufer/i.test(line)) continue;
    if (/\bprovisionsfrei\b|keine\s+(?:Käuferprovision|Maklerprovision|Courtage)|(?:Käuferprovision|Maklerprovision|Courtage)\s*:?\s*(?:entfällt|keine)/i.test(line)) { free = true; continue; }
    if (!/provision|courtage|maklergebühr/i.test(line) && !/Kaufpreis.*zzgl.*%/i.test(line)) continue;
    let context = line;
    if (!/%/.test(context) && lines[i + 1] && !/Verkäuferprovision|Gesamtprovision/i.test(lines[i + 1])) context += ' ' + lines[i + 1];
    if (/Verkäuferprovision/i.test(context) && !/\bKäufer/i.test(context)) continue;
    const rateMatches = Array.from(context.matchAll(/(\d{1,2}(?:[,.]\d{1,3})?)\s*%/g));
    // VAT is not the commission; prefer an explicitly labelled buyer rate.
    const buyer = /(?:vom\s+Käufer|\bKäuferprovision|\bKäufercourtage|\bKäuferanteil)\s*:?\s*(\d{1,2}(?:[,.]\d{1,3})?)\s*%/i.exec(context);
    const raw = buyer?.[1] ?? rateMatches[0]?.[1];
    if (!raw) continue;
    const rate = Number(raw.replace(',', '.'));
    if (rate > 15 || /zzgl\.?\s*(?:(?:\d+(?:[,.]\d+)?\s*%?)\s*)?(?:MwSt|USt|Mehrwertsteuer|Umsatzsteuer)/i.test(context) || /(?:Gesamtprovision|insgesamt).*%/i.test(context) && !buyer) { uncertain = true; continue; }
    if (rateMatches.length > 1 && !buyer && !/je(?:weils)?\s*\d/i.test(context) && !/(?:inkl|einschl)/i.test(context)) { uncertain = true; continue; }
    rates.push(rate);
  }
  const unique = Array.from(new Set(rates));
  if (uncertain || unique.length > 1 || (free && unique.some(rate => rate > 0))) return { commissionWarning: 'Käuferprovision ist widersprüchlich oder nicht eindeutig inklusive Mehrwertsteuer angegeben. Bitte den Bruttosatz prüfen; der bisherige Rechenwert bleibt erhalten.' };
  if (unique.length === 1) return { maklerProzent: unique[0].toLocaleString('de-DE', { maximumFractionDigits: 3 }), hasMakler: unique[0] > 0 };
  if (free) return { maklerProzent: '0', hasMakler: false };
  return {};
}
