import type { ValuationInput } from "./valuation.ts";

export type ExposeFact = {
  key: string;
  label: string;
  value: string;
  evidence: string;
  page: number;
};
export type ExposePage = {
  page: number;
  status: "read" | "unreadable";
  summary: string;
  facts: ExposeFact[];
};
export type ExposeImport = {
  filename: string;
  pageCount: number;
  pages: ExposePage[];
  createdAt: string;
};
export type ImportReview = {
  updates: Partial<ValuationInput>;
  findings: ExposeFact[];
  conflicts: Array<{ key: string; label: string; values: string[] }>;
  questions: string[];
  complete: boolean;
};

export const EXPOSE_KEYS = [
  "address", "type", "area", "year", "askingPrice",
  "monthlyColdRent", "annualColdRent", "occupancy", "units",
  "plotArea", "heating", "energyClass", "energyDemand",
  "brokerFee", "maintenance", "renovation", "condition",
  "tenancy", "rights", "other",
] as const;

const numberValue = (raw: string): number | null => {
  const found = raw.replace(/\s/g,"").match(/-?[\d.,]+/);
  if (!found) return null;
  const text = found[0];
  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  let normalized = text;
  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot ? text.replace(/\./g,"").replace(",",".") : text.replace(/,/g,"");
  } else if (comma >= 0) {
    normalized = text.replace(/\./g,"").replace(",",".");
  } else if (dot >= 0 && /^-?\d{1,3}(\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g,"");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
};
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("de-DE");

export function reviewExpose(doc: ExposeImport): ImportReview {
  const questions: string[] = [];
  const conflicts: ImportReview["conflicts"] = [];
  const updates: Partial<ValuationInput> = {};
  const pages = new Set(doc.pages.map(p=>p.page));
  const complete = doc.pageCount > 0 &&
    doc.pages.length === doc.pageCount &&
    Array.from({length:doc.pageCount},(_,i)=>i+1).every(p=>pages.has(p)) &&
    doc.pages.every(p=>p.status === "read");
  if (!complete) questions.push("Nicht alle Seiten konnten vollständig gelesen werden. Bitte lade eine besser lesbare Datei hoch.");
  const facts = doc.pages.flatMap(p=>p.facts.filter(f=>f.page===p.page && f.value.trim() && f.evidence.trim()));
  const grouped = new Map<string,ExposeFact[]>();
  for (const fact of facts) grouped.set(fact.key,[...(grouped.get(fact.key)||[]),fact]);

  const find = (key:string): string | null => {
    const items=grouped.get(key)||[];
    const unique=[...new Set(items.map(f=>normalize(f.value)))];
    if (unique.length>1) {
      conflicts.push({key,label:items[0].label,values:[...new Set(items.map(f=>f.value))]});
      return null;
    }
    return items[0]?.value||null;
  };
  const address=find("address");
  if (address) updates.address=address;
  const type=find("type");
  if (type && /mehrfamilienhaus|eigentumswohnung|einfamilienhaus/i.test(type)) {
    updates.type=(type.match(/mehrfamilienhaus|eigentumswohnung|einfamilienhaus/i)||[])[0].replace(/^./,c=>c.toUpperCase());
  }
  for (const [key,target] of [["area","area"],["year","year"],["askingPrice","askingPrice"]] as const) {
    const raw=find(key), n=raw?numberValue(raw):null;
    if (n !== null && n > 0) updates[target]=n;
  }
  const monthly=find("monthlyColdRent"), yearly=find("annualColdRent");
  const m=monthly?numberValue(monthly):null, y=yearly?numberValue(yearly):null;
  if (m!==null && y!==null && Math.abs(m*12-y)>Math.max(12,y*.01)) {
    conflicts.push({key:"annualRent",label:"Kaltmiete",values:[monthly||"",yearly||""]});
  } else if (y!==null && y>=0) updates.annualRent=y;
  else if (m!==null && m>=0) updates.annualRent=m*12;

  const occupancy=find("occupancy");
  if (!address) questions.push("Wie lautet die vollständige Adresse?");
  if (!updates.area) questions.push("Wie groß ist die gesamte Wohnfläche?");
  if (!updates.askingPrice) questions.push("Wie hoch ist der Angebotspreis?");
  if (!updates.year) questions.push("In welchem Jahr wurde das Gebäude gebaut?");
  if (!occupancy) questions.push("Ist die Immobilie vermietet, leer oder selbst genutzt?");
  else if (/vermietet/i.test(occupancy) && updates.annualRent === undefined)
    questions.push("Wie hoch ist die aktuelle Kaltmiete? Bitte keine mögliche zukünftige Miete angeben.");
  if (conflicts.length) questions.push("Einige Angaben im Exposé widersprechen sich. Bitte bestätige die richtigen Werte.");
  return {updates,findings:facts,conflicts,questions,complete};
}

/** Harte Sperre vor einer finanzbasierten Premium-Auswertung. */
export function criticalQuestions(input: ValuationInput, review: ImportReview | null, occupancy: string): string[] {
  const missing:string[]=[];
  if (review && !review.complete) missing.push("Das Exposé wurde nicht auf allen Seiten gelesen.");
  if (review?.conflicts.length) missing.push("Widersprüchliche Angaben aus dem Exposé müssen geklärt werden.");
  if (!input.address.trim()) missing.push("Bitte die genaue Adresse angeben.");
  if (!(input.area>0)) missing.push("Bitte die Wohnfläche bestätigen.");
  if (!(input.askingPrice>0)) missing.push("Bitte den Kaufpreis bestätigen.");
  if (!(input.year>0)) missing.push("Bitte das Baujahr bestätigen.");
  if (!occupancy) missing.push("Bitte die Nutzung der Immobilie angeben.");
  if (occupancy==="vermietet" && !(input.annualRent>0)) missing.push("Bitte die tatsächlich gezahlte Kaltmiete angeben.");
  if (!Number.isFinite(input.interest) || !Number.isFinite(input.repayment) || input.interest + input.repayment<=0)
    missing.push("Bitte gültige Werte für Zins und Tilgung angeben.");
  return missing;
}
