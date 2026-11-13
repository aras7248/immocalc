import { jsPDF } from "jspdf";
import { COMPANY_LOGO_PNG } from "./companyLogo.ts";
import type { PremiumInvestmentResult } from "../domain/immocalc/premium.ts";
import type { ExposeFacts } from "./exposeImport.ts";
import type { FinancingResearch, FundingFit } from "./financingResearch.ts";

type ReportTone = "positive" | "neutral" | "negative";

export interface PremiumAssessmentScenario {
  label: string;
  description: string;
  rentPerSqm: number;
  monthlyRent: number;
  monthlyCashFlow: number;
  dscr: number;
}

export interface PremiumAssessmentReportData {
  generatedAt: Date;
  object: {
    name: string;
    federalState: string;
    livingArea: number;
    yearBuilt: number;
  };
  result: PremiumInvestmentResult;
  exposeFacts?: ExposeFacts | null;
  financingResearch?: FinancingResearch | null;
  scenarios: PremiumAssessmentScenario[];
}

type Rgb = [number, number, number];

const COLORS = {
  ink: [15, 23, 42] as Rgb,
  muted: [71, 85, 105] as Rgb,
  line: [203, 213, 225] as Rgb,
  surface: [248, 250, 252] as Rgb,
  accent: [37, 99, 235] as Rgb,
  accentSoft: [239, 246, 255] as Rgb,
  positive: [5, 150, 105] as Rgb,
  neutral: [217, 119, 6] as Rgb,
  negative: [220, 38, 38] as Rgb,
  white: [255, 255, 255] as Rgb,
} as const;

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const preciseEuro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const safe = (value: number) => Number.isFinite(value) ? value : 0;
const formatEuro = (value: number) => euro.format(safe(value)).replace(/[\u00a0\u202f]/g, " ");
const formatPreciseEuro = (value: number) => preciseEuro.format(safe(value)).replace(/[\u00a0\u202f]/g, " ");
const formatNumber = (value: number) => number.format(safe(value));

function reportTone(cashFlow: number, dscr: number): ReportTone {
  if (cashFlow >= 250 && dscr >= 1.2) return "positive";
  if (cashFlow >= 0 && dscr >= 1) return "neutral";
  return "negative";
}

function safeFilename(value: string) {
  const base = value
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return base || "immobilie";
}

export function createPremiumAssessmentPdf(data: PremiumAssessmentReportData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageCountToken = "{total_pages_count}";
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 13;
  const contentWidth = pageWidth - margin * 2;
  let page = 1;

  const fill = (color: Rgb) => doc.setFillColor(...color);
  const draw = (color: Rgb) => doc.setDrawColor(...color);
  const text = (color: Rgb) => doc.setTextColor(...color);
  const line = (y: number) => {
    draw(COLORS.line);
    doc.setLineWidth(0.25);
    doc.line(margin, y, pageWidth - margin, y);
  };
  const header = (title: string, subtitle: string) => {
    try {
      doc.addImage(COMPANY_LOGO_PNG, "PNG", margin, 8, 38, 14);
    } catch {
      // The report remains readable if an environment blocks the embedded logo.
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    text(COLORS.ink);
    doc.text(title, pageWidth - margin, 14, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.6);
    text(COLORS.muted);
    doc.text(subtitle, pageWidth - margin, 19, { align: "right" });
    line(26);
  };
  const footer = () => {
    draw(COLORS.line);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    text(COLORS.muted);
    doc.text("ImmoCalc - Premium-Investitionsanalyse", margin, pageHeight - 5.7);
    doc.text(`Seite ${page} von ${pageCountToken}`, pageWidth - margin, pageHeight - 5.7, { align: "right" });
  };
  const title = (value: string, y: number, eyebrow?: string) => {
    if (eyebrow) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      text(COLORS.accent);
      doc.text(eyebrow.toUpperCase(), margin, y);
      y += 4.5;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    text(COLORS.ink);
    doc.text(value, margin, y);
    return y;
  };
  const wrapped = (value: string, x: number, y: number, width: number, size = 8.5, color: Rgb = COLORS.muted, leading = 4.1) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(size);
    text(color);
    const lines = doc.splitTextToSize(value, width);
    doc.text(lines, x, y);
    return y + lines.length * leading;
  };
  const metricCard = (x: number, y: number, width: number, label: string, value: string, note: string, tone: ReportTone = "neutral") => {
    fill(COLORS.surface);
    draw(tone === "positive" ? COLORS.positive : tone === "negative" ? COLORS.negative : COLORS.line);
    doc.setLineWidth(0.45);
    doc.roundedRect(x, y, width, 27, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    text(COLORS.muted);
    doc.text(label, x + 5, y + 7);
    doc.setFontSize(12.5);
    text(tone === "positive" ? COLORS.positive : tone === "negative" ? COLORS.negative : COLORS.ink);
    doc.text(value, x + 5, y + 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    text(COLORS.muted);
    doc.text(note, x + 5, y + 22);
  };
  const listItem = (index: number, value: string, x: number, y: number, width: number, color: Rgb = COLORS.ink) => {
    fill(COLORS.accentSoft);
    doc.circle(x + 2.2, y - 1.2, 2.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.3);
    text(COLORS.accent);
    doc.text(String(index), x + 2.2, y + 0.8, { align: "center" });
    return wrapped(value, x + 7, y, width - 7, 8.1, color, 4);
  };

  const { result } = data;
  const facts = data.exposeFacts?.facts ?? [];
  const warnings = data.exposeFacts?.warnings ?? [];
  const date = data.generatedAt.toLocaleDateString("de-DE");
  const monthlyDebtService = result.annualDebtService / 12;
  const dataTone = reportTone(result.monthlyCashFlow, result.dscr);
  const locationFact = facts.find((fact) => fact.key === "location" || fact.key === "address");
  const addressFact = facts.find((fact) => fact.key === "address");
  const annualNoi = result.effectiveAnnualRent - result.operatingCostsAnnual;
  const annuityRate = result.loanAmount > 0 ? result.annualDebtService / result.loanAmount : 0;
  const acquisitionMultiplier = result.input.purchasePrice > 0
    ? result.totalInvestment / result.input.purchasePrice
    : 0;
  const investorPriceCeiling = result.input.monthlyRent > 0 && annualNoi > 0 && annuityRate > 0 && acquisitionMultiplier > 0
    ? Math.max(0, (result.equityUsed + annualNoi / annuityRate) / acquisitionMultiplier)
    : 0;
  const financingResearch = data.financingResearch ?? null;
  const fundingFitLabel = (fit: FundingFit) => fit === "possible"
    ? "Potenziell passend"
    : fit === "review"
      ? "Kriterien noch offen"
      : "Nach Profil nicht passend";

  header("Investitionsanalyse - Premium", `Erstellt am ${date}`);
  let y = 36;
  y = title(data.object.name || "Aktive Immobilie", y, "Entscheidungsunterlage") + 6;
  const objectSubline = `${formatNumber(data.object.livingArea)} m2 Wohnfläche · ${data.object.federalState || "Bundesland offen"} · Baujahr ${data.object.yearBuilt || "offen"}`;
  y = wrapped(objectSubline, margin, y, contentWidth, 8.4, COLORS.muted) + 5;

  const summary = result.input.monthlyRent > 0
    ? `Die hinterlegte Miete von ${formatPreciseEuro(result.input.monthlyRent)} pro Monat führt unter den aktuellen Annahmen zu einem Cashflow von ${formatPreciseEuro(result.monthlyCashFlow)} pro Monat.`
    : "Im Exposé ist keine belastbare Ist-Miete hinterlegt. Die Rendite- und Cashflowbewertung kann deshalb erst mit einer belegten Neuvermietungsannahme abschließend bewertet werden.";
  fill(COLORS.surface);
  draw(dataTone === "negative" ? COLORS.negative : dataTone === "positive" ? COLORS.positive : COLORS.neutral);
  doc.setLineWidth(0.55);
  doc.roundedRect(margin, y, contentWidth, 20, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.3);
  text(dataTone === "negative" ? COLORS.negative : dataTone === "positive" ? COLORS.positive : COLORS.neutral);
  doc.text(dataTone === "negative" ? "Rechnerische Einordnung: kritische Datengrundlage" : "Rechnerische Einordnung", margin + 6, y + 7);
  wrapped(summary, margin + 6, y + 13, contentWidth - 12, 7.9, COLORS.ink, 3.8);
  y += 28;

  y = title("Objekt- und Finanzierungsbasis", y, "Phase 1") + 7;
  const cardGap = 4;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  metricCard(margin, y, cardWidth, "Kaufpreis", formatEuro(result.input.purchasePrice), "laut Eingabe / Exposé");
  metricCard(margin + (cardWidth + cardGap), y, cardWidth, "Gesamtinvestition", formatEuro(result.totalInvestment), "inkl. Kaufnebenkosten");
  metricCard(margin + (cardWidth + cardGap) * 2, y, cardWidth, "Gesamtrate der Darlehen", formatEuro(monthlyDebtService), "Zins + Tilgung / Monat", dataTone);
  metricCard(margin + (cardWidth + cardGap) * 3, y, cardWidth, "Kaufpreis / m2", formatEuro(result.purchasePricePerSqm), "ohne Kaufnebenkosten");
  y += 35;

  const factColumnWidth = (contentWidth - 6) / 2;
  const warningX = margin + factColumnWidth + 6;
  fill(COLORS.surface);
  draw(COLORS.negative);
  doc.roundedRect(warningX, y, factColumnWidth, 67, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  text(COLORS.negative);
  doc.text("Prüfpunkte vor einer Entscheidung", warningX + 5, y + 8);
  let warningY = y + 15;
  const riskItems = warnings.length ? warnings : [
    "Ist-Miete oder belastbare Neuvermietungsannahme belegen.",
    "Energieausweis, Heizungsalter und Modernisierungsnachweise prüfen.",
    "Wohnflächenberechnung, Grundrisse und Baubeschreibung anfordern.",
  ];
  riskItems.slice(0, 4).forEach((warning, index) => {
    warningY = listItem(index + 1, warning, warningX + 4, warningY, factColumnWidth - 9, COLORS.ink) + 1.7;
  });
  // Lay out every fact by its wrapped height. The first page shares space
  // with the risk card; continuation pages use both fact columns.
  type FactLine = { value: string; bold: boolean; advance: number };
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  const factRows: FactLine[][] = facts.map((fact) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    const labels: string[] = doc.splitTextToSize(fact.label, factColumnWidth - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.1);
    const values: string[] = doc.splitTextToSize(fact.value, factColumnWidth - 10);
    const row = [
      ...labels.map(value => ({ value, bold: true, advance: 3.5 })),
      ...values.map(value => ({ value, bold: false, advance: 3.6 })),
    ];
    row[row.length - 1].advance += 2;
    return row;
  });
  if (!factRows.length) factRows.push([{
    value: "Noch keine strukturierten Exposé-Fakten hinterlegt.", bold: false, advance: 4,
  }]);
  let factX = margin;
  let factTop = y;
  let factHeight = 15;
  let factLines: FactLine[] = [];
  let factsContinued = false;
  const factBottom = pageHeight - 17;
  const drawFactCard = () => {
    fill(COLORS.white);
    draw(COLORS.line);
    doc.setLineWidth(0.35);
    doc.roundedRect(factX, factTop, factColumnWidth, Math.max(24, factHeight + 3), 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    text(COLORS.ink);
    doc.text(factsContinued ? "Exposé-Fakten (Fortsetzung)" : "Aus dem Exposé erkannt", factX + 5, factTop + 8);
    let lineY = factTop + 15;
    for (const entry of factLines) {
      doc.setFont("helvetica", entry.bold ? "bold" : "normal");
      doc.setFontSize(entry.bold ? 6.5 : 7.1);
      text(entry.bold ? COLORS.muted : COLORS.ink);
      doc.text(entry.value, factX + 5, lineY);
      lineY += entry.advance;
    }
  };
  const nextFactColumn = () => {
    drawFactCard();
    if (factsContinued && factX === margin) {
      factX = warningX;
    } else {
      footer();
      doc.addPage();
      page += 1;
      header("Exposé-Fakten", "Fortsetzung der Objekt- und Finanzierungsbasis");
      factX = margin;
    }
    factsContinued = true;
    factTop = 38;
    factHeight = 15;
    factLines = [];
  };
  for (const row of factRows) {
    const rowHeight = row.reduce((sum, entry) => sum + entry.advance, 0);
    // Keep normal facts together; exceptionally long values may span columns.
    if (factLines.length && rowHeight <= factBottom - 38 - 18 && factTop + factHeight + rowHeight + 3 > factBottom) {
      nextFactColumn();
    }
    for (const entry of row) {
      if (factTop + factHeight + entry.advance + 3 > factBottom) nextFactColumn();
      factLines.push(entry);
      factHeight += entry.advance;
    }
  }
  drawFactCard();
  footer();

  doc.addPage();
  page += 1;
  header("Lage- und Marktanalyse", `${data.object.name || "Aktive Immobilie"} · Quellen und Prüfumfang`);
  y = 36;
  y = title("Lage nur auf belastbarer Grundlage einordnen", y, "Phase 2") + 6;
  const locationIntro = locationFact
    ? `Aus dem Exposé erkannt: ${locationFact.label} ${locationFact.value}. Eine Standortbeurteilung darf nicht allein aus dieser Angabe abgeleitet werden.`
    : "Im hinterlegten Exposé wurde keine eindeutige Lage- oder Adressangabe erkannt. Eine Markt- und Lageanalyse ist deshalb noch offen.";
  y = wrapped(locationIntro, margin, y, contentWidth, 8.5, COLORS.ink, 4.25) + 6;
  const locationCardWidth = (contentWidth - 6) / 2;
  fill(COLORS.surface);
  draw(COLORS.line);
  doc.roundedRect(margin, y, locationCardWidth, 80, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  text(COLORS.ink);
  doc.text("Exposé-Basis", margin + 5, y + 9);
  const locationBasis = [
    addressFact ? `Adresse: ${addressFact.value}` : "Adresse: nicht erkannt",
    locationFact && locationFact !== addressFact ? `${locationFact.label}: ${locationFact.value}` : null,
    facts.find((fact) => fact.key === "plotArea") ? `Grundstück: ${facts.find((fact) => fact.key === "plotArea")?.value}` : null,
    facts.find((fact) => fact.key === "objectType") ? `Objektart: ${facts.find((fact) => fact.key === "objectType")?.value}` : null,
  ].filter((item): item is string => Boolean(item));
  let locationY = y + 17;
  locationBasis.forEach((item, index) => {
    locationY = listItem(index + 1, item, margin + 4, locationY, locationCardWidth - 8) + 2;
  });
  const marketX = margin + locationCardWidth + 6;
  fill(COLORS.accentSoft);
  draw(COLORS.accent);
  doc.roundedRect(marketX, y, locationCardWidth, 80, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  text(COLORS.ink);
  doc.text("Für Markt und Vermietung nachreichen", marketX + 5, y + 9);
  let marketY = y + 17;
  [
    "Mietspiegel oder qualifizierte Vergleichsmieten für die konkrete Lage und Ausstattung.",
    "Aktuelle Angebots- und Transaktionsvergleiche mit Quelle und Datum.",
    "Mikrolage: ÖPNV, Lärm, Infrastruktur, Leerstand und Zielgruppen.",
    "Bei Renditeobjekten: Mieterliste, Vertragslaufzeiten und Zahlungsstände.",
  ].forEach((item, index) => {
    marketY = listItem(index + 1, item, marketX + 4, marketY, locationCardWidth - 8) + 2;
  });
  y += 91;
  y = title("Vorläufige Markteinordnung", y, "Abgrenzung") + 6;
  const marketDisclaimer = result.input.monthlyRent > 0
    ? `Die Rechenannahme von ${formatPreciseEuro(result.input.monthlyRent)} pro Monat wird für die Wirtschaftlichkeitsrechnung verwendet. Sie ist keine bestätigte Vergleichsmiete und keine Marktprognose.`
    : "Es liegt keine Mietannahme vor. Ohne belegbare Vergleichsmiete, Zustands- und Lagevergleich wird bewusst kein Marktwert oder Mietniveau behauptet.";
  wrapped(marketDisclaimer, margin, y, contentWidth, 9, COLORS.ink, 4.5);
  footer();

  doc.addPage();
  page += 1;
  header("Zustand, Risiken und Sanierungsbedarf", `${data.object.name || "Aktive Immobilie"} · Risiko- und Unterlagenprüfung`);
  y = 36;
  y = title("Kritische Punkte vor einer Kaufentscheidung", y, "Phase 3") + 6;
  y = wrapped("Die Auswertung ersetzt keine technische Begutachtung. Sie strukturiert ausschließlich aus Exposé und Eingaben erkennbare Punkte, die vor der Preisfestlegung fachlich oder durch Originalunterlagen geprüft werden müssen.", margin, y, contentWidth, 8.4, COLORS.muted, 4.2) + 7;
  fill(COLORS.surface);
  draw(COLORS.negative);
  doc.roundedRect(margin, y, contentWidth, 89, 3, 3, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  text(COLORS.negative);
  doc.text("Risikoprotokoll", margin + 5, y + 9);
  const technicalRiskItems = (warnings.length ? warnings : [
    "Wohnflächenberechnung, Grundrisse, Energieausweis und Baubeschreibung vorlegen lassen.",
    "Heizungsalter, Modernisierungen, Dach, Leitungen, Elektrik und Feuchtigkeit fachlich prüfen.",
    "Mietnachweise beziehungsweise eine belegte Neuvermietungsannahme anfordern.",
  ]).slice(0, 5);
  let riskY = y + 17;
  technicalRiskItems.forEach((item, index) => {
    riskY = listItem(index + 1, item, margin + 4, riskY, contentWidth - 8) + 3;
  });
  y += 99;
  y = title("Sanierung und Reserve", y, "Rechenannahme") + 6;
  const reserveText = `Hinterlegt sind ${formatPreciseEuro(result.input.renovationCosts)} Sanierungs- bzw. Modernisierungskosten, ${formatPreciseEuro(result.input.otherInitialCosts)} sonstige Anfangskosten und ein Kostenpuffer von ${formatNumber(result.input.costBufferPercent)} %. Diese Werte sind Annahmen; sie ersetzen keine Angebote von Fachbetrieben oder eine Baubegutachtung.`;
  wrapped(reserveText, margin, y, contentWidth, 8.7, COLORS.ink, 4.25);
  footer();

  doc.addPage();
  page += 1;
  header("Wirtschaftlichkeit und Sensitivität", `${data.object.name || "Aktive Immobilie"} · Modellrechnung`);
  y = 36;
  y = title("Drei Miet- und Cashflow-Szenarien", y, "Phase 4 und 6") + 6;
  y = wrapped("Die Szenarien sind keine Marktprognose. Sie zeigen, welche Miete für die hinterlegte Finanzierung erforderlich wäre.", margin, y, contentWidth, 8.4, COLORS.muted) + 7;
  const scenarioWidth = (contentWidth - 8) / 3;
  data.scenarios.slice(0, 3).forEach((scenario, index) => {
    const x = margin + index * (scenarioWidth + 4);
    const tone = reportTone(scenario.monthlyCashFlow, scenario.dscr);
    fill(COLORS.surface);
    draw(tone === "positive" ? COLORS.positive : tone === "negative" ? COLORS.negative : COLORS.accent);
    doc.setLineWidth(0.65);
    doc.roundedRect(x, y, scenarioWidth, 72, 3.5, 3.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    text(COLORS.ink);
    doc.text(scenario.label, x + 5, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    text(COLORS.muted);
    const description = doc.splitTextToSize(scenario.description, scenarioWidth - 10);
    doc.text(description, x + 5, y + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    text(tone === "positive" ? COLORS.positive : tone === "negative" ? COLORS.negative : COLORS.accent);
    doc.text(formatPreciseEuro(scenario.monthlyCashFlow), x + 5, y + 35);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    text(COLORS.muted);
    doc.text("Cashflow / Monat", x + 5, y + 40);
    const rows = [
      ["Miete / Monat", formatPreciseEuro(scenario.monthlyRent)],
      ["Miete / m2", `${formatNumber(scenario.rentPerSqm)} EUR`],
      ["DSCR", formatNumber(scenario.dscr)],
    ];
    rows.forEach(([label, value], rowIndex) => {
      const rowY = y + 51 + rowIndex * 7.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      text(COLORS.muted);
      doc.text(label, x + 5, rowY);
      doc.setFont("helvetica", "bold");
      text(COLORS.ink);
      doc.text(value, x + scenarioWidth - 5, rowY, { align: "right" });
    });
  });
  y += 81;

  y = title("Tragfähigkeit der aktuellen Finanzierung", y, "Finanzierungsbasis") + 6;
  const financeRows = [
    ["Darlehensbetrag", formatPreciseEuro(result.loanAmount)],
    ["Sollzins / Tilgung Bankdarlehen", `${formatNumber(result.input.interestPercent)} % / ${formatNumber(result.input.repaymentPercent)} %`],
    ["Rate aus Zins und Tilgung", `${formatPreciseEuro(monthlyDebtService)} / Monat`],
    ["Laufende Kosten", `${formatPreciseEuro(result.operatingCostsAnnual / 12)} / Monat`],
    ["Break-even-Miete", `${formatNumber(result.breakEvenRentPerSqm)} EUR / m2 / Monat`],
    ["DSCR im Basisszenario", formatNumber(result.dscr)],
  ];
  fill(COLORS.surface);
  draw(COLORS.line);
  doc.roundedRect(margin, y, contentWidth, 50, 3, 3, "FD");
  financeRows.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + 6 + column * (contentWidth / 2);
    const rowY = y + 11 + row * 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    text(COLORS.muted);
    doc.text(label, x, rowY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    text(COLORS.ink);
    doc.text(value, x, rowY + 5);
  });
  y += 60;

  y = title("Einordnung", y, "Sensitivität") + 6;
  const currentScenario = data.scenarios[0];
  const cashFlowText = currentScenario && currentScenario.monthlyCashFlow < 0
    ? `Unter der aktuell hinterlegten Miete deckt die Immobilie die laufenden Kosten und die Rate nicht. Für eine belastbare Kaufentscheidung müssen sowohl die erzielbare Miete als auch die verbleibenden Kosten nachgewiesen werden.`
    : `Unter der aktuell hinterlegten Miete ist die Finanzierung rechnerisch mindestens gedeckt. Die Datengrundlage muss vor einer Kaufentscheidung dennoch dokumentiert werden.`;
  wrapped(cashFlowText, margin, y, contentWidth, 9, COLORS.ink, 4.5);
  footer();

  doc.addPage();
  page += 1;
  header("Kaufpreisbewertung und Preisrahmen", "Vergleichswert, Ertragswert und Investorenlogik");
  y = 36;
  y = title("Welche Bewertung aktuell möglich ist", y, "Phase 5") + 8;
  const valueLead = investorPriceCeiling > 0
    ? `Der ertragsorientierte Rechenwert liegt unter den hinterlegten Annahmen bei rund ${formatPreciseEuro(investorPriceCeiling)} Kaufpreis. Er entspricht dem Cashflow-Break-even und ist keine Verkehrswert- oder Vergleichswertbewertung.`
    : "Ohne belegte Miete, ausreichende Kostenbasis oder belastbare Finanzierung lässt sich keine ertragsorientierte Obergrenze seriös ableiten. Vergleichs- und Ertragswert bleiben vorläufig offen.";
  y = wrapped(valueLead, margin, y, contentWidth, 8.8, COLORS.ink, 4.35) + 6;
  const priceCardWidth = (contentWidth - 8) / 3;
  metricCard(margin, y, priceCardWidth, "Angebotspreis", formatEuro(result.input.purchasePrice), "laut Eingabe / Exposé", "neutral");
  metricCard(margin + priceCardWidth + 4, y, priceCardWidth, "Gesamtinvestition", formatEuro(result.totalInvestment), "inkl. Kaufnebenkosten", "neutral");
  metricCard(margin + (priceCardWidth + 4) * 2, y, priceCardWidth, "Ertragsorientierte Obergrenze", investorPriceCeiling > 0 ? formatEuro(investorPriceCeiling) : "offen", "Cashflow-Break-even", investorPriceCeiling > 0 && investorPriceCeiling >= result.input.purchasePrice ? "positive" : "negative");
  y += 36;
  y = title("Faire Kaufpreisspanne", y, "Phase 7") + 7;
  const rangeText = investorPriceCeiling > 0
    ? `Die ertragsorientierte Obergrenze ist ein von Miete, Kosten, Zins, Tilgung, Leerstand und Eigenkapital abhängiger Rechenwert. Eine faire Marktpreisspanne darf erst nach Vergleichswert- und Zustandsprüfung formuliert werden. Liegt der Angebotspreis über ${formatPreciseEuro(investorPriceCeiling)}, erklärt die aktuelle Ertragsannahme den Kaufpreis nicht vollständig.`
    : "Die faire Kaufpreisspanne ist bewusst als offen markiert. Vor einem Angebot müssen Vergleichsangebote, eine belegte Miete, technische Risiken und die tatsächlichen Kaufnebenkosten zusammengestellt werden.";
  fill(COLORS.accentSoft);
  draw(COLORS.accent);
  doc.roundedRect(margin, y, contentWidth, 35, 3, 3, "FD");
  wrapped(rangeText, margin + 6, y + 9, contentWidth - 12, 8.3, COLORS.ink, 4.1);
  y += 46;
  y = title("Evidenz vor Preisangebot", y, "Pflichtunterlagen") + 7;
  const checks = [
    "Mieterliste, Mietverträge, Zahlungsstände und eine klare Einordnung, ob die Miete Ist-Miete oder Neuvermietungsannahme ist.",
    "Wohnflächenberechnung, vollständige Grundrisse und Klärung aller abweichenden Objekt- bzw. Adressangaben im Exposé.",
    "Energieausweis, Heizungsunterlagen, Modernisierungsnachweise sowie Belege zu Dach, Leitungen, Elektrik und Feuchtigkeit.",
    "Grundbuchauszug, Baulasten, Altlasten, Erschließung, Versicherungen und - falls relevant - Genehmigungen für Einliegerwohnung oder Vermietung.",
    "Eine aktuelle Finanzierungsindikation der Bank inklusive Kaufnebenkosten und ausreichendem Reservepuffer.",
  ];
  checks.forEach((check, index) => {
    y = listItem(index + 1, check, margin, y, contentWidth) + 4;
  });
  footer();

  doc.addPage();
  page += 1;
  header("Verhandlungsstrategie und Verkäufer-Zusammenfassung", "Sachlich, nachvollziehbar und ohne Schönrechnen");
  y = 36;
  y = title("Verhandlungsstrategie", y, "Phase 8") + 7;
  const negotiationText = `Der Kaufpreis von ${formatPreciseEuro(result.input.purchasePrice)} sollte nicht isoliert betrachtet werden. Die Gesamtinvestition liegt bei ${formatPreciseEuro(result.totalInvestment)}. Argumentiere ausschließlich mit belegbaren Punkten: Exposé-Widersprüchen, fehlenden Unterlagen, dokumentierten technischen Risiken, Miete, Finanzierung und tatsächlich angebotenen Leistungen. Persönliche Umbauwünsche gehören nicht in die Preisbegründung.`;
  fill(COLORS.accentSoft);
  draw(COLORS.accent);
  doc.roundedRect(margin, y, contentWidth, 43, 3, 3, "FD");
  wrapped(negotiationText, margin + 6, y + 9, contentWidth - 12, 8.6, COLORS.ink, 4.25);
  y += 54;
  y = title("Fragen an Verkäufer oder Makler", y, "Gesprächsvorbereitung") + 7;
  const questions = [
    "Welche Adresse, Wohnfläche und Flächenaufteilung sind verbindlich und durch welche Unterlagen belegt?",
    "Welche Miete wurde zuletzt erzielt bzw. welche Miete ist für Haupt- und Einliegerwohnung realistisch belegbar?",
    "Welche Investitionen wurden an Heizung, Dach, Fenstern, Elektrik und Leitungen seit Baujahr durchgeführt?",
    "Welche Unterlagen können vor der Reservierung oder dem Notartermin zur Prüfung bereitgestellt werden?",
  ];
  questions.forEach((question, index) => {
    y = listItem(index + 1, question, margin, y, contentWidth) + 3.5;
  });
  y += 3;
  y = title("Professionelle Verkäufer-Zusammenfassung", y, "Phase 9") + 7;
  const sellerSummary = result.input.monthlyRent > 0
    ? `Vielen Dank für die Unterlagen. Ich habe das Objekt anhand der dokumentierten Eckdaten, der hinterlegten Mietannahme und meiner Finanzierung bewertet. Der aktuelle Cashflow liegt unter diesen Annahmen bei ${formatPreciseEuro(result.monthlyCashFlow)} pro Monat. Für eine faire und nachvollziehbare Kaufentscheidung benötige ich noch die genannten Unterlagen zu Miete, Flächen und Zustand. Danach kann ich ein belastbares Angebot formulieren.`
    : "Vielen Dank für die Unterlagen. Ich habe das Objekt anhand der vorliegenden Eckdaten und meiner Finanzierung geprüft. Da noch keine belastbare Miete sowie einzelne Unterlagen zu Flächen und Zustand vorliegen, möchte ich diese Punkte vor einer Preisfestlegung klären. Danach kann ich ein sachliches und nachvollziehbares Angebot formulieren.";
  fill(COLORS.surface);
  draw(COLORS.line);
  doc.roundedRect(margin, y, contentWidth, 42, 3, 3, "FD");
  wrapped(sellerSummary, margin + 6, y + 9, contentWidth - 12, 8.6, COLORS.ink, 4.25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.7);
  text(COLORS.muted);
  const disclaimer = doc.splitTextToSize(
    "Hinweis: Diese Unterlage ist eine Investitions- und Cashflowanalyse auf Basis der hinterlegten Eingaben und erkannten Exposé-Fakten. Sie ist kein Verkehrswertgutachten, keine Finanzierungszusage sowie keine Rechts- oder Steuerberatung. Marktwert, Zustand, Mietrecht und technische Risiken müssen durch geeignete Unterlagen und Fachleute geprüft werden.",
    contentWidth,
  );
  doc.text(disclaimer, margin, pageHeight - 22);
  footer();

  doc.addPage();
  page += 1;
  header("Zins- und Fördercheck", "Öffentliche Referenz, Förder-Vorprüfung und Bankvergleich");
  y = 36;
  y = title("Zins und Fördermittel vor der Finanzierungszusage prüfen", y, "Finanzierungs-Addendum") + 6;
  const publicRateText = financingResearch?.benchmark.valuePercent != null
    ? `${formatNumber(financingResearch.benchmark.valuePercent)} %`
    : "nicht abrufbar";
  const publicRateNote = financingResearch?.benchmark.period
    ? `Bundesbank-Referenz · ${financingResearch.benchmark.period}`
    : "Bundesbank-Referenz, kein Bankangebot";
  const rateCardWidth = (contentWidth - 8) / 3;
  metricCard(margin, y, rateCardWidth, "Sollzins Bankdarlehen", `${formatNumber(result.input.interestPercent)} %`, "deine Modellannahme");
  metricCard(margin + rateCardWidth + 4, y, rateCardWidth, "Öffentlicher Referenzzins", publicRateText, publicRateNote);
  metricCard(margin + (rateCardWidth + 4) * 2, y, rateCardWidth, "Bankrate im Modell", formatEuro(monthlyDebtService), "Zins + Tilgung / Monat", dataTone);
  y += 35;

  const marketRateDisclaimer = financingResearch?.benchmark.note
    ?? "Der Zinscheck wurde noch nicht geladen. Aktuelle Konditionen müssen vor der Finanzierungszusage direkt bei den Finanzierungsinstituten abgefragt werden.";
  fill(COLORS.accentSoft);
  draw(COLORS.accent);
  doc.roundedRect(margin, y, contentWidth, 19, 3, 3, "FD");
  wrapped(marketRateDisclaimer, margin + 5, y + 7, contentWidth - 10, 7.5, COLORS.ink, 3.65);
  y += 28;

  y = title("Förder-Vorprüfung", y, "KfW und Landesförderung") + 6;
  const programs = financingResearch?.programs ?? [];
  if (programs.length) {
    const programWidth = (contentWidth - 6) / 2;
    programs.slice(0, 4).forEach((program, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + column * (programWidth + 6);
      const cardY = y + row * 44;
      const programTone = program.fit === "possible" ? COLORS.positive : program.fit === "review" ? COLORS.neutral : COLORS.line;
      fill(COLORS.surface);
      draw(programTone);
      doc.setLineWidth(0.45);
      doc.roundedRect(x, cardY, programWidth, 38, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      text(programTone === COLORS.line ? COLORS.muted : programTone);
      doc.text(fundingFitLabel(program.fit).toUpperCase(), x + 4, cardY + 6);
      doc.setFontSize(8.1);
      text(COLORS.ink);
      const programName = doc.splitTextToSize(program.name, programWidth - 8);
      doc.text(programName.slice(0, 2), x + 4, cardY + 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.4);
      text(COLORS.muted);
      const criterion = program.openCriteria[0] ?? "Offizielle Konditionen und Antragstermin prüfen.";
      const criterionLines = doc.splitTextToSize(criterion, programWidth - 8);
      doc.text(criterionLines.slice(0, 2), x + 4, cardY + 27);
    });
    y += 94;
  } else {
    y = wrapped("Für diesen Export wurde der Fördercheck noch nicht geladen. Bitte die Förder- und Zinskonditionen vor dem Kaufvertrag im Premium-Bereich aktualisieren.", margin, y, contentWidth, 8.2, COLORS.ink, 4.1) + 6;
  }

  y = title("Wo Vergleichsangebote anfragen", y, "Bankvergleich") + 6;
  const bankRecommendations = financingResearch?.bankRecommendations ?? [];
  const bankIntro = bankRecommendations.length
    ? "Für einen belastbaren Vergleich müssen alle Banken mit derselben Darlehenssumme, demselben Eigenkapital, derselben Tilgung und derselben Zinsbindung anfragen. Dann sind Effektivzins, Sondertilgungen, Bereitstellungszinsen und Fördermitteleinbindung vergleichbar."
    : "Mindestens drei schriftliche Angebote einholen: Sparkasse am Objektort, Volksbank/Raiffeisenbank am Objektort und Hausbank am Wohnort. Für jedes Angebot dieselben Eckdaten vorgeben.";
  y = wrapped(bankIntro, margin, y, contentWidth, 8, COLORS.ink, 4) + 3;
  bankRecommendations.slice(0, 3).forEach((recommendation, index) => {
    y = listItem(index + 1, `${recommendation.title}: ${recommendation.description}`, margin, y, contentWidth) + 2.5;
  });
  if (financingResearch?.openCriteria.length) {
    y += 1;
    y = title("Vor dem Antrag belegen", y, "Offene Punkte") + 6;
    financingResearch.openCriteria.slice(0, 4).forEach((criterion, index) => {
      y = listItem(index + 1, criterion, margin, y, contentWidth) + 2.5;
    });
  }
  footer();
  doc.addPage();
  page += 1;
  header("Darlehensübersicht", "Premium-Investitionsanalyse");
  y = title("Darlehensbausteine", 38) + 7;
  y = wrapped(
    `Monatsraten im ersten Jahr inklusive angesetzter Sondertilgungen. Restschuld am Ende von Jahr ${result.input.forecastYears}.`,
    margin, y, contentWidth,
  ) + 6;
  const columns = [margin, margin + 77, margin + 94, margin + 113, margin + 148, margin + contentWidth];
  const headings = ["Darlehen", "Betrag", "Sollzins", "Tilgung¹", "Monatsrate", "Restschuld"];
  const drawLoanHeadings = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    text(COLORS.ink);
    headings.forEach((label, index) => {
      doc.text(label, columns[index], y, { align: index === 0 ? "left" : "right" });
    });
    line(y + 2);
    y += 8;
  };
  drawLoanHeadings();
  for (const loan of result.loans.filter(entry => entry.amount > 0)) {
    if (y > pageHeight - 57) {
      footer();
      doc.addPage();
      page += 1;
      header("Darlehensübersicht", "Fortsetzung");
      y = 38;
      drawLoanHeadings();
    }
    const loanName = loan.name.replace(/\s+/g, " ");
    const loanLabel = loan.interestOnlyYears > 0
      ? `${loanName} (Tilgung ab Jahr ${loan.interestOnlyYears + 1})`
      : loanName;
    const nextRow = wrapped(loanLabel, margin, y, 45, 7.5, COLORS.ink, 3.5);
    const values = [
      formatPreciseEuro(loan.amount),
      `${formatNumber(loan.interestPercent)} %`,
      `${formatNumber(loan.repaymentPercent)} %`,
      formatPreciseEuro(loan.monthlyDebtServiceYearOne),
      formatPreciseEuro(loan.remainingDebtAtExit),
    ];
    values.forEach((value, index) => doc.text(value, columns[index + 1], y, { align: "right" }));
    line(Math.max(y + 5, nextRow));
    y = Math.max(y + 12, nextRow + 5);
  }
  y = wrapped("¹ Anfängliche Tilgung", margin, y, contentWidth) + 5;
  title(`Gesamtrate im Cashflow: ${formatPreciseEuro(monthlyDebtService)} / Monat`, y);
  footer();
  doc.putTotalPages(pageCountToken);
  return doc;
}

export function downloadPremiumAssessmentPdf(data: PremiumAssessmentReportData): void {
  const date = data.generatedAt.toISOString().slice(0, 10);
  createPremiumAssessmentPdf(data).save(`immocalc-premium-analyse-${safeFilename(data.object.name)}-${date}.pdf`);
}
