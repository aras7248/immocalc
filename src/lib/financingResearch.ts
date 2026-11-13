export type FinancingUse = "unknown" | "owner-occupied" | "investment";
export type EnergyPlan = "unknown" | "none" | "efficiency-house";
export type HouseholdProfile = "unknown" | "family-with-children" | "not-applicable";
export type FundingFit = "possible" | "review" | "not-matching";

export interface FinancingResearchInput {
  federalState: string;
  objectLocation?: string;
  residenceLocation?: string;
  financingUse: FinancingUse;
  energyPlan: EnergyPlan;
  householdProfile: HouseholdProfile;
}

export interface PublicRateBenchmark {
  valuePercent: number | null;
  period: string | null;
  publishedAt: string | null;
  sourceUrl: string;
  sourceLabel: string;
  note: string;
}

export interface FundingProgram {
  provider: "KfW" | "L-Bank";
  name: string;
  fit: FundingFit;
  summary: string;
  openCriteria: string[];
  sourceUrl: string;
}

export interface BankRecommendation {
  title: string;
  locationBasis: "object" | "residence" | "independent";
  description: string;
  sourceUrl: string;
}

export interface FinancingResearch {
  checkedAt: string;
  benchmark: PublicRateBenchmark;
  programs: FundingProgram[];
  bankRecommendations: BankRecommendation[];
  openCriteria: string[];
}

const KFW_124_URL = "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestandsimmobilien/Finanzierungsangebote/Wohneigentumsprogramm-%28124%29/";
const KFW_308_URL = "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Wohneigentum-f%C3%BCr-Familien-Bestandserwerb-%28308%29/";
const KFW_261_URL = "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Bundesf%C3%B6rderung-f%C3%BCr-effiziente-Geb%C3%A4ude-Wohngeb%C3%A4ude-Kredit-%28261-262%29/";
const LBANK_Z15_URL = "https://www.l-bank.de/produkte/wohnimmobilien/eigentumsfinanzierung-bw-z-15-darlehen.html";
const BUNDESBANK_RATE_URL = "https://www.bundesbank.de/de/statistiken/geld-und-kapitalmaerkte/zinssaetze-und-renditen/wohnungsbaukredite-an-private-haushalte-hypothekarkredite-auf-wohngrundstuecke-615036";

function fitForOwnerOccupation(financingUse: FinancingUse): FundingFit {
  if (financingUse === "owner-occupied") return "possible";
  if (financingUse === "investment") return "not-matching";
  return "review";
}

function fitForEnergyPlan(energyPlan: EnergyPlan): FundingFit {
  if (energyPlan === "efficiency-house") return "possible";
  if (energyPlan === "none") return "not-matching";
  return "review";
}

function isBadenWuerttemberg(federalState: string): boolean {
  return /baden[\s-]*württemberg|baden[\s-]*wuerttemberg|\bbw\b/i.test(federalState);
}

function fitLabel(fit: FundingFit): string {
  if (fit === "possible") return "potenziell passend";
  if (fit === "not-matching") return "nach aktuellem Profil nicht passend";
  return "Kriterien noch prüfen";
}

function locationLabel(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

export function buildFinancingResearch(
  input: FinancingResearchInput,
  benchmark: PublicRateBenchmark,
): FinancingResearch {
  const ownerFit = fitForOwnerOccupation(input.financingUse);
  const energyFit = fitForEnergyPlan(input.energyPlan);
  const lBankFit: FundingFit = isBadenWuerttemberg(input.federalState)
    ? ownerFit
    : "not-matching";
  const familyFit: FundingFit = input.householdProfile === "family-with-children"
    ? ownerFit
    : input.householdProfile === "not-applicable" || input.financingUse === "investment"
      ? "not-matching"
      : "review";
  const programs: FundingProgram[] = [
    {
      provider: "KfW",
      name: `KfW 124 – Wohneigentumsprogramm (${fitLabel(ownerFit)})`,
      fit: ownerFit,
      summary: "Förderkredit für Kauf oder Bau einer selbstgenutzten Wohnimmobilie. Der Antrag gehört vor Unterzeichnung des Kaufvertrags in die Finanzierung.",
      openCriteria: ownerFit === "possible"
        ? ["Selbstnutzung und Zeitplan vor Vertragsschluss mit dem Finanzierungspartner bestätigen."]
        : ["Ist die Immobilie zur Eigennutzung vorgesehen?", "Wurde der Antrag noch vor Kaufvertragsabschluss gestellt?"],
      sourceUrl: KFW_124_URL,
    },
    {
      provider: "KfW",
      name: `KfW 308 – Wohneigentum für Familien / Bestandserwerb (${fitLabel(familyFit)})`,
      fit: familyFit,
      summary: "Förderkredit für Familien mit Kindern beim Erwerb einer bestehenden Wohnimmobilie; Voraussetzungen zu Haushalt, Einkommen und energetischem Zustand sind vorab zu belegen.",
      openCriteria: ["Kinderzahl und zu versteuerndes Haushaltseinkommen", "Energieausweis bzw. energetischer Ausgangszustand", "Antrag vor Kaufvertrag"],
      sourceUrl: KFW_308_URL,
    },
    {
      provider: "KfW",
      name: `KfW 261 – Wohngebäude-Kredit (${fitLabel(energyFit)})`,
      fit: energyFit,
      summary: "Kredit mit möglichem Tilgungszuschuss bei Sanierung zum Effizienzhaus oder beim qualifizierten Erwerb eines frisch sanierten Effizienzhauses.",
      openCriteria: ["Energieeffizienz-Expertin oder -Experte einbinden", "Effizienzhaus-Ziel und förderfähige Kosten belegen", "Antrag und Bestätigung vor Maßnahmenbeginn"],
      sourceUrl: KFW_261_URL,
    },
    {
      provider: "L-Bank",
      name: `L-Bank Eigentumsfinanzierung BW – Z15 (${fitLabel(lBankFit)})`,
      fit: lBankFit,
      summary: isBadenWuerttemberg(input.federalState)
        ? "Landesförderung für selbstgenutztes Wohneigentum in Baden-Württemberg, insbesondere für Familien. Die Wohnraumförderstelle prüft die konkreten Voraussetzungen."
        : "Das Z15-Darlehen ist auf Baden-Württemberg beschränkt; für dieses Objekt ist stattdessen die Förderbank des Objekt-Bundeslands zu prüfen.",
      openCriteria: isBadenWuerttemberg(input.federalState)
        ? ["Selbstnutzung", "Haushaltsgröße und Einkommen", "Wohnfläche sowie Förderantrag bei der zuständigen Wohnraumförderstelle"]
        : ["Förderbank und kommunale Programme am Objektstandort ermitteln"],
      sourceUrl: LBANK_Z15_URL,
    },
  ];

  const objectPlace = locationLabel(input.objectLocation, "Objektort");
  const residencePlace = input.residenceLocation?.trim();
  const bankRecommendations: BankRecommendation[] = [
    {
      title: "Sparkasse am Objektstandort",
      locationBasis: "object",
      description: `${objectPlace}: Erste Anfrage wegen lokaler Objektkenntnis, Grundbuchabwicklung und möglicher regionaler Förderwege. Verlange eine schriftliche Kondition mit Beleihungsauslauf, Zinsbindung, Sondertilgung und allen Nebenkosten.`,
      sourceUrl: "https://www.sparkasse.de/pk/produkte/immobilien/immobilienfinanzierung/baufinanzierung.html",
    },
    {
      title: "Volksbank/Raiffeisenbank am Objektstandort",
      locationBasis: "object",
      description: `${objectPlace}: Zweites Angebot am Objektort anfragen. Die Vergleichbarkeit steigt, wenn Darlehenssumme, Eigenkapital, Tilgung, Zinsbindung und Sondertilgung identisch vorgegeben werden.`,
      sourceUrl: "https://www.vr.de/service/filialsuche.html",
    },
    {
      title: residencePlace ? `Hausbank am Wohnort (${residencePlace})` : "Hausbank am eigenen Wohnort ergänzen",
      locationBasis: "residence",
      description: residencePlace
        ? "Drittes Angebot bei der Hausbank einholen. Dort können Einkommenshistorie und Eigenkapitalnachweise direkt eingeordnet werden – trotzdem nur auf Basis derselben Vergleichsvorgaben entscheiden."
        : "Optional den eigenen Wohnort oder die PLZ eintragen und dort ein drittes, schriftliches Vergleichsangebot anfragen.",
      sourceUrl: "https://www.sparkasse.de/standorte",
    },
    {
      title: "Unabhängiger Angebotsvergleich",
      locationBasis: "independent",
      description: "Ergänzend kann ein unabhängiger Finanzierungsvermittler ein Vergleichsangebot erstellen. Förderprogramme, Zinsbindung, Sondertilgung und Gesamtkosten immer mit den lokalen Bankangeboten abgleichen.",
      sourceUrl: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestandsimmobilie/Kauf-einer-bestehenden-Immobilie/",
    },
  ];

  const openCriteria = [
    ...(input.financingUse === "unknown" ? ["Nutzung: Eigennutzung oder Kapitalanlage"] : []),
    ...(input.householdProfile === "unknown" ? ["Haushalt: Kinderzahl und zu versteuerndes Einkommen (nur für familienbezogene Förderung)"] : []),
    ...(input.energyPlan === "unknown" ? ["Energetischer Zustand, Energieausweis und geplantes Effizienzhaus-Ziel"] : []),
    "Förderantrag zeitlich vor Kaufvertrag bzw. Maßnahmenbeginn mit dem Finanzierungspartner abstimmen",
  ];

  return {
    checkedAt: new Date().toISOString(),
    benchmark,
    programs,
    bankRecommendations,
    openCriteria,
  };
}

export function defaultPublicRateBenchmark(): PublicRateBenchmark {
  return {
    valuePercent: null,
    period: null,
    publishedAt: null,
    sourceUrl: BUNDESBANK_RATE_URL,
    sourceLabel: "Deutsche Bundesbank – Wohnungsbaukredite",
    note: "Der offizielle Marktdurchschnitt wird beim Öffnen des Förder- und Zinschecks aktualisiert. Er ist kein verbindliches Bankangebot.",
  };
}

export const OFFICIAL_FINANCING_SOURCES = {
  bundesbankRate: BUNDESBANK_RATE_URL,
  kfw124: KFW_124_URL,
  kfw308: KFW_308_URL,
  kfw261: KFW_261_URL,
  lBankZ15: LBANK_Z15_URL,
} as const;

export function parseBundesbankRateCsv(csv: string): Pick<PublicRateBenchmark, "valuePercent" | "period" | "publishedAt"> | null {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const observation = [...lines].reverse().find((line) => /^\d{4}-\d{2};/.test(line));
  if (!observation) return null;

  const [, decimalValue] = observation.split(";");
  const value = Number(decimalValue?.replace(",", "."));
  if (!Number.isFinite(value)) return null;

  const period = observation.slice(0, 7);
  const publishedAt = lines.find((line) => line.startsWith("Stand vom;"))
    ?.split(";")[1]
    ?.replace(/;$/, "")
    ?.trim() ?? null;

  return { valuePercent: value, period, publishedAt };
}
