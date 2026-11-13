import { jsPDF } from "jspdf";
import { COMPANY_LOGO_PNG } from "./companyLogo.ts";

export type InvestmentTone = "positive" | "neutral" | "negative";

export interface InvestmentReportData {
  generatedAt: Date;
  object: {
    name: string;
    livingArea: number;
    unitCount: number;
    yearBuilt: number;
    federalState: string;
  };
  status: {
    tone: InvestmentTone;
    label: string;
    summary: string;
  };
  acquisition: {
    purchasePrice: number;
    totalInvestment: number;
    acquisitionCostPercent: number;
    landTransferTaxPercent: number;
    landTransferTaxAmount: number;
    notaryPercent: number;
    notaryAmount: number;
    brokerPercent: number;
    brokerAmount: number;
    equityAmount: number;
    loanAmount: number;
    financingRatioPercent: number;
  };
  rent: {
    monthly: number;
    annual: number;
    perSqm: number;
    operatingCostsMonthly: number;
    operatingCostsAnnual: number;
    noiMonthly: number;
    noiAnnual: number;
  };
  financing: {
    interestPercent: number;
    repaymentPercent: number;
    annuityPercent: number;
    interestMonthly: number;
    repaymentMonthly: number;
    debtServiceMonthly: number;
  };
  performance: {
    cashFlowMonthly: number;
    cashFlowAnnual: number;
    grossYieldPercent: number;
    netYieldPercent: number;
    purchasePriceFactor: number;
    returnOnEquityPercent: number | null;
  };
  potential: {
    rentIncreasePercent: number;
    baseRentAfterIncreaseMonthly: number;
    vacancyReactivationMonthly: number;
    parkingMonthly: number;
    solarMonthly: number;
    otherMonthly: number;
    monthly: number;
    annual: number;
    perSqm: number;
    cashFlowMonthly: number;
    totalInvestmentPerSqm: number;
  };
  targetRent: {
    rentPerSqm: number;
    monthly: number;
    annual: number;
    maxPurchasePrice: number;
    totalInvestment: number;
    purchasePricePerSqm: number;
    totalInvestmentPerSqm: number;
    acquisitionCosts: number;
    loanAmount: number;
    cashFlowAtOfferMonthly: number;
    offerGap: number;
  };
  reverse: {
    valueAtCurrentRent: number;
    totalInvestmentAtCurrentRent: number;
    offerValueGap: number;
    offerValueGapPercent: number;
    breakEvenBuffer: {
      bufferPercent: number;
      requiredMonthlyRent: number;
      requiredAnnualRent: number;
      requiredRentPerSqm: number;
      monthlyRentGapToCurrent: number;
      rentChangePercentToCurrent: number;
      cashFlowMonthly: number;
    };
    breakEven: {
      requiredMonthlyRent: number;
      requiredAnnualRent: number;
      requiredRentPerSqm: number;
      monthlyRentGap: number;
      rentChangePercent: number;
    };
    comfort: {
      targetCashFlowPercent: number;
      targetCashFlowMonthlyAtOffer: number;
      targetCashFlowMonthlyAtCurrentRent: number;
      requiredMonthlyRent: number;
      requiredAnnualRent: number;
      requiredRentPerSqm: number;
      monthlyRentGap: number;
      rentChangePercent: number;
      maxPurchasePriceAtCurrentRent: number;
      totalInvestmentAtCurrentRent: number;
    };
  };
  plausibility: {
    tone: InvestmentTone;
    label: string;
    explanation: string;
  };
}

type Rgb = [number, number, number];

const COLORS = {
  accent: [37, 99, 235] as Rgb,
  accentSoft: [239, 246, 255] as Rgb,
  ink: [15, 23, 42] as Rgb,
  muted: [71, 85, 105] as Rgb,
  line: [203, 213, 225] as Rgb,
  surface: [248, 250, 252] as Rgb,
  white: [255, 255, 255] as Rgb,
  positive: [5, 150, 105] as Rgb,
  neutral: [217, 119, 6] as Rgb,
  negative: [220, 38, 38] as Rgb,
} as const;

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integer = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 0,
});

function formatEuro(value: number): string {
  return euro
    .format(Number.isFinite(value) ? value : 0)
    .replace(/[\u00a0\u202f]/g, " ");
}

function formatNumber(value: number): string {
  return number.format(Number.isFinite(value) ? value : 0);
}

function formatSignedEuro(value: number): string {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${normalized > 0 ? "+" : ""}${formatEuro(normalized)}`;
}

function formatEuroText(value: number): string {
  return `${formatNumber(value)} EUR`;
}

function toneColor(tone: InvestmentTone): Rgb {
  return COLORS[tone];
}

function safeFilename(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "immobilie";
}

function drawReport(data: InvestmentReportData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let pageNumber = 1;
  let y = margin;

  const setText = (color: Rgb) => doc.setTextColor(...color);
  const setFill = (color: Rgb) => doc.setFillColor(...color);
  const setDraw = (color: Rgb) => doc.setDrawColor(...color);

  const header = (sectionLabel: string) => {
    const headerMargin = 4;
    const logoTop = 4;
    const headerTextBaseline = 11.8;
    doc.addImage(COMPANY_LOGO_PNG, "PNG", headerMargin, logoTop, 14, 11.62);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.6);
    setText(COLORS.ink);
    doc.text("ImmoCalc", headerMargin + 16, headerTextBaseline);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16.5);
    setText(COLORS.ink);
    doc.text("Investitionsanalyse - Einfach", margin, 31);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(COLORS.muted);
    doc.text(sectionLabel, pageWidth - 7, 10, { align: "right" });
    y += 18;
  };

  const sectionTitle = (title: string, description?: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    setText(COLORS.ink);
    doc.text(title, margin, y);
    y += 4.5;
    if (description) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      setText(COLORS.muted);
      const lines = doc.splitTextToSize(description, contentWidth);
      doc.text(lines, margin, y);
      y += lines.length * 3.6;
    }
    setDraw(COLORS.line);
    doc.setLineWidth(0.25);
    doc.line(margin, y + 1.2, pageWidth - margin, y + 1.2);
    y += 7;
  };

  const paragraph = (
    text: string,
    options: { color?: Rgb; size?: number; maxWidth?: number } = {},
  ) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(options.size ?? 8);
    setText(options.color ?? COLORS.muted);
    const lines = doc.splitTextToSize(text, options.maxWidth ?? contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * ((options.size ?? 8) * 0.48) + 2;
  };

  const statusPanel = (
    tone: InvestmentTone,
    _label: string,
    text: string,
  ) => {
    const color = toneColor(tone);
    setFill(COLORS.surface);
    setDraw(color);
    doc.setLineWidth(0.45);
    doc.roundedRect(margin, y, contentWidth, 20, 4, 4, "FD");

    const iconX = margin + 4;
    const iconY = y + 3;
    const iconSize = 14;
    setFill(COLORS.white);
    setDraw(color);
    doc.setLineWidth(0.4);
    doc.roundedRect(iconX, iconY, iconSize, iconSize, 3.5, 3.5, "FD");

    const transformThumbPoint = (pointX: number, pointY: number) => {
      let transformedX = pointX;
      let transformedY = pointY;
      if (tone === "negative") {
        transformedX = 16 - pointX;
        transformedY = 16 - pointY;
      } else if (tone === "neutral") {
        transformedX = 16 - pointY;
        transformedY = pointX;
      }
      const scale = 9 / 16;
      return [
        iconX + 2.5 + transformedX * scale,
        iconY + 2.5 + transformedY * scale,
      ] as const;
    };
    const thumbPoints = [
      [1, 8],
      [5, 8],
      [8, 3],
      [8, 1],
      [10, 1],
      [11, 2],
      [11, 7],
      [15, 7],
      [16, 8],
      [15, 13],
      [14, 15],
      [5, 15],
      [5, 8],
    ] as const;
    setDraw(color);
    doc.setLineWidth(0.65);
    for (let index = 1; index < thumbPoints.length; index += 1) {
      const [fromX, fromY] = transformThumbPoint(
        thumbPoints[index - 1][0],
        thumbPoints[index - 1][1],
      );
      const [toX, toY] = transformThumbPoint(
        thumbPoints[index][0],
        thumbPoints[index][1],
      );
      doc.line(fromX, fromY, toX, toY);
    }
    const [wristTopX, wristTopY] = transformThumbPoint(1, 8);
    const [wristBottomX, wristBottomY] = transformThumbPoint(1, 15);
    const [wristInnerBottomX, wristInnerBottomY] = transformThumbPoint(5, 15);
    doc.line(wristTopX, wristTopY, wristBottomX, wristBottomY);
    doc.line(
      wristBottomX,
      wristBottomY,
      wristInnerBottomX,
      wristInnerBottomY,
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    setText(color);
    doc.text("Rechnerische Einordnung", margin + 23, y + 6.5);

    const factsX = pageWidth - margin - 62;
    setDraw(COLORS.line);
    doc.setLineWidth(0.25);
    doc.line(factsX, y + 3, factsX, y + 17);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.2);
    setText(COLORS.ink);
    const lines = doc
      .splitTextToSize(text, factsX - (margin + 23) - 4)
      .slice(0, 2);
    doc.text(lines, margin + 23, y + 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    setText(COLORS.muted);
    doc.text("Angebotspreis", factsX + 4, y + 7);
    doc.text("Cashflow / Monat", factsX + 4, y + 14.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(COLORS.ink);
    doc.text(
      formatEuro(data.acquisition.purchasePrice),
      pageWidth - margin - 5,
      y + 7,
      { align: "right" },
    );
    setText(
      data.performance.cashFlowMonthly >= 0
        ? COLORS.positive
        : COLORS.negative,
    );
    doc.text(
      `${formatSignedEuro(data.performance.cashFlowMonthly)} / Mo.`,
      pageWidth - margin - 5,
      y + 14.5,
      { align: "right" },
    );
    y += 25;
  };

  const compactFactSection = (
    title: string,
    facts: Array<{
      label: string;
      value: string;
      tone?: InvestmentTone;
    }>,
  ) => {
    const columns = 4;
    const gap = 2;
    const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
    const cardHeight = 13;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    setText(COLORS.accent);
    doc.text(title.toUpperCase(), margin, y);
    y += 3;

    facts.forEach((fact, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const x = margin + column * (cardWidth + gap);
      const cardY = y + row * (cardHeight + gap);
      setFill(COLORS.surface);
      setDraw(fact.tone ? toneColor(fact.tone) : COLORS.line);
      doc.setLineWidth(fact.tone ? 0.4 : 0.2);
      doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      setText(COLORS.muted);
      const label = doc.splitTextToSize(fact.label, cardWidth - 5).slice(0, 1);
      doc.text(label, x + 2.5, cardY + 4);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.8);
      setText(fact.tone ? toneColor(fact.tone) : COLORS.ink);
      const value = doc.splitTextToSize(fact.value, cardWidth - 5).slice(0, 1);
      doc.text(value, x + 2.5, cardY + 9.5);
    });
    y += Math.ceil(facts.length / columns) * (cardHeight + gap) + 3;
  };

  const corridorGrid = (
    cards: Array<{
      label: string;
      value: string;
      color: Rgb;
      details: Array<{ label: string; value: string }>;
    }>,
  ) => {
    const gap = 4;
    const cardWidth = (contentWidth - gap * 2) / 3;
    const footerDividerY = pageHeight - 10;
    const targetCardBottom = footerDividerY - 10;
    const cardHeight = Math.max(67, targetCardBottom - y);
    cards.forEach((card, index) => {
      const x = margin + index * (cardWidth + gap);
      setFill(COLORS.surface);
      setDraw(card.color);
      doc.setLineWidth(0.65);
      doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.7);
      setText(COLORS.muted);
      const labelLines = doc
        .splitTextToSize(card.label, cardWidth - 8)
        .slice(0, 2);
      doc.text(labelLines, x + 4, y + 5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      setText(card.color);
      doc.text(card.value, x + 4, y + 15);

      const details = card.details.slice(0, 9);
      const detailSpacing = details.length > 1
        ? (cardHeight - 34) / (details.length - 1)
        : 0;
      details.forEach((detail, detailIndex) => {
        const detailY = y + 25 + detailIndex * detailSpacing;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(details.length > 7 ? 5.25 : 5.8);
        setText(COLORS.muted);
        doc.text(detail.label, x + 4, detailY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(details.length > 7 ? 5.25 : 5.8);
        setText(COLORS.ink);
        doc.text(detail.value, x + cardWidth - 4, detailY, {
          align: "right",
        });
      });
    });
    y += cardHeight + 6;
  };

  const cashFlowLineChart = () => {
    const rawPoints = [
      {
        label: "Ist-Miete",
        rent: data.rent.monthly,
        cashFlow: data.performance.cashFlowMonthly,
        color: COLORS.negative,
      },
      {
        label: "Mietpotenzial",
        rent: data.potential.monthly,
        cashFlow: data.potential.cashFlowMonthly,
        color: data.potential.cashFlowMonthly > 0
          ? COLORS.positive
          : data.potential.cashFlowMonthly < 0
            ? COLORS.negative
            : COLORS.neutral,
      },
      {
        label: `${formatNumber(data.targetRent.rentPerSqm)} EUR/m2`,
        rent: data.targetRent.monthly,
        cashFlow: data.targetRent.cashFlowAtOfferMonthly,
        color: COLORS.accent,
      },
    ];
    // A report can use the same rent for the Ist-Zustand and the fixed
    // 10-EUR/m2 scenario. In that case, rendering both would place their
    // labels on top of each other without adding another data point.
    const points = rawPoints.filter((point, index, allPoints) => (
      allPoints.findIndex((candidate) => (
        Math.abs(candidate.rent - point.rent) < 0.01
        && Math.abs(candidate.cashFlow - point.cashFlow) < 0.01
      )) === index
    ));
    const chartHeight = 70;
    const plotX = margin + 20;
    const plotY = y + 19;
    const plotWidth = contentWidth - 27;
    const plotHeight = 30;
    const rents = points.map((point) => point.rent);
    const cashFlows = points.map((point) => point.cashFlow);
    const rentRange = Math.max(Math.max(...rents) - Math.min(...rents), 1);
    const cashFlowRange = Math.max(Math.max(...cashFlows) - Math.min(...cashFlows), 500);
    const minRent = Math.max(0, Math.min(...rents) - rentRange * 0.2);
    const maxRent = Math.max(...rents) + rentRange * 0.2;
    const minCashFlow = Math.min(-500, Math.min(...cashFlows) - cashFlowRange * 0.15);
    const maxCashFlow = Math.max(500, Math.max(...cashFlows) + cashFlowRange * 0.15);
    const xFor = (value: number) =>
      plotX + ((value - minRent) / (maxRent - minRent)) * plotWidth;
    const yFor = (value: number) =>
      plotY + plotHeight - ((value - minCashFlow) / (maxCashFlow - minCashFlow)) * plotHeight;

    setFill(COLORS.surface);
    setDraw(COLORS.line);
    doc.setLineWidth(0.35);
    doc.roundedRect(margin, y, contentWidth, chartHeight, 4, 4, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    setText(COLORS.muted);
    doc.text("Cashflow / Monat", plotX, y + 12);

    [minCashFlow, 0, maxCashFlow].forEach((value) => {
      const gridY = yFor(value);
      setDraw(value === 0 ? COLORS.neutral : COLORS.line);
      doc.setLineWidth(value === 0 ? 0.45 : 0.2);
      doc.setLineDashPattern(value === 0 ? [] : [1, 1], 0);
      doc.line(plotX, gridY, plotX + plotWidth, gridY);
      doc.setLineDashPattern([], 0);
      doc.setFont("helvetica", value === 0 ? "bold" : "normal");
      doc.setFontSize(5.8);
      setText(value === 0 ? COLORS.neutral : COLORS.muted);
      doc.text(formatEuro(Math.round(value / 100) * 100), plotX - 3, gridY + 1.8, {
        align: "right",
      });
    });

    setDraw(COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(plotX, plotY, plotX, plotY + plotHeight);
    doc.line(plotX, plotY + plotHeight, plotX + plotWidth, plotY + plotHeight);

    for (let index = 0; index < points.length - 1; index += 1) {
      setDraw(points[index + 1].color);
      doc.setLineWidth(0.9);
      doc.line(
        xFor(points[index].rent),
        yFor(points[index].cashFlow),
        xFor(points[index + 1].rent),
        yFor(points[index + 1].cashFlow),
      );
    }

    points.forEach((point) => {
      const pointX = xFor(point.rent);
      const pointY = yFor(point.cashFlow);
      setDraw(point.color);
      doc.setLineWidth(0.25);
      doc.setLineDashPattern([1, 1], 0);
      doc.line(pointX, pointY, pointX, plotY + plotHeight);
      doc.setLineDashPattern([], 0);
      setFill(point.color);
      setDraw(COLORS.white);
      doc.setLineWidth(0.65);
      doc.circle(pointX, pointY, 2.1, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.3);
      setText(point.color);
      doc.text(point.label, pointX, plotY + plotHeight + 6, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      setText(COLORS.ink);
      doc.text(formatEuro(point.rent), pointX, plotY + plotHeight + 10, {
        align: "center",
      });
      doc.text(
        `${formatSignedEuro(point.cashFlow)} Cashflow`,
        pointX,
        plotY + plotHeight + 14,
        { align: "center" },
      );
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    setText(COLORS.muted);
    doc.text("Kaltmiete / Monat", plotX + plotWidth / 2, y + chartHeight - 5, {
      align: "center",
    });
    y += chartHeight + 6;
  };

  const newPage = (label: string) => {
    doc.addPage();
    pageNumber += 1;
    y = margin;
    header(label);
    y += 3;
  };

  header("Entscheidungsunterlage für Bank und Makler");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  setText(COLORS.muted);
  const objectName = data.object.name.trim();
  const hasObjectName =
    objectName.length > 0 &&
    objectName !== "Unbenannte Immobilie" &&
    objectName !== "Nicht benannt";
  const createdAt = `Erstellt am ${data.generatedAt.toLocaleDateString("de-DE")}`;
  const metadataY = y + 4;
  const metadataRight = pageWidth - margin;

  if (hasObjectName) {
    const objectMetadata = `| Objekt: ${objectName}`;
    const dateWidth = doc.getTextWidth(createdAt);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    setText(COLORS.ink);
    const objectWidth = doc.getTextWidth(objectMetadata);
    const metadataWidth = dateWidth + 2 + objectWidth;

    if (metadataWidth <= contentWidth) {
      const dateX = metadataRight - metadataWidth;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(COLORS.muted);
      doc.text(createdAt, dateX, metadataY);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setText(COLORS.ink);
      doc.text(objectMetadata, dateX + dateWidth + 2, metadataY);
      y += 9;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(COLORS.muted);
      doc.text(createdAt, metadataRight, metadataY, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setText(COLORS.ink);
      doc.text(`Objekt: ${objectName}`, metadataRight, y + 8, { align: "right" });
      y += 13;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setText(COLORS.muted);
  } else {
    doc.text(createdAt, metadataRight, metadataY, { align: "right" });
    y += 9;
  }

  statusPanel(data.status.tone, data.status.label, data.status.summary);
  compactFactSection("Objekt", [
    {
      label: "Wohnfläche",
      value: `${formatNumber(data.object.livingArea)} m2`,
    },
    {
      label: "Wohneinheiten",
      value: integer.format(data.object.unitCount),
    },
    {
      label: "Baujahr",
      value: data.object.yearBuilt > 0
        ? String(Math.round(data.object.yearBuilt))
        : "nicht angegeben",
    },
    {
      label: "Bundesland",
      value: data.object.federalState || "nicht angegeben",
    },
  ]);

  compactFactSection("Kauf und Finanzierung", [
    {
      label: "Angebotspreis",
      value: formatEuro(data.acquisition.purchasePrice),
    },
    {
      label: `Grunderwerbsteuer (${formatNumber(data.acquisition.landTransferTaxPercent)} %)`,
      value: formatEuro(data.acquisition.landTransferTaxAmount),
    },
    {
      label: `Notar (${formatNumber(data.acquisition.notaryPercent)} %)`,
      value: formatEuro(data.acquisition.notaryAmount),
    },
    {
      label: `Makler (${formatNumber(data.acquisition.brokerPercent)} %)`,
      value: formatEuro(data.acquisition.brokerAmount),
    },
    {
      label: `Kaufnebenkosten (${formatNumber(data.acquisition.acquisitionCostPercent)} %)`,
      value: formatEuro(
        data.acquisition.totalInvestment - data.acquisition.purchasePrice,
      ),
    },
    {
      label: "Gesamtinvestition",
      value: formatEuro(data.acquisition.totalInvestment),
    },
    {
      label: "Eigenkapital",
      value: formatEuro(data.acquisition.equityAmount),
    },
    {
      label: "Darlehen",
      value: formatEuro(data.acquisition.loanAmount),
    },
    {
      label: "Finanzierungsquote",
      value: `${formatNumber(data.acquisition.financingRatioPercent)} %`,
    },
    {
      label: "Zins",
      value: `${formatNumber(data.financing.interestPercent)} %`,
    },
    {
      label: "Tilgung",
      value: `${formatNumber(data.financing.repaymentPercent)} %`,
    },
    {
      label: "Annuität",
      value: `${formatNumber(data.financing.annuityPercent)} %`,
    },
  ]);

  compactFactSection("Miete und Ergebnis", [
    {
      label: "Kaltmiete / Monat",
      value: formatEuro(data.rent.monthly),
    },
    {
      label: "Kaltmiete / Jahr",
      value: formatEuro(data.rent.annual),
    },
    {
      label: "Kaltmiete / m2",
      value: `${formatNumber(data.rent.perSqm)} EUR`,
    },
    {
      label: "Nicht umlagefähige Kosten / Monat",
      value: formatEuro(data.rent.operatingCostsMonthly),
    },
    {
      label: "Netto-Mietertrag / Monat",
      value: formatEuro(data.rent.noiMonthly),
    },
    {
      label: "Kreditrate (Zins + Tilgung)",
      value: formatEuro(data.financing.debtServiceMonthly),
    },
    {
      label: "Cashflow / Monat",
      value: formatSignedEuro(data.performance.cashFlowMonthly),
      tone: data.performance.cashFlowMonthly >= 0 ? "positive" : "negative",
    },
    {
      label: "Cashflow / Jahr",
      value: formatSignedEuro(data.performance.cashFlowAnnual),
      tone: data.performance.cashFlowAnnual >= 0 ? "positive" : "negative",
    },
    {
      label: "Brutto-Mietrendite",
      value: `${formatNumber(data.performance.grossYieldPercent)} %`,
    },
    {
      label: "Netto-Mietrendite",
      value: `${formatNumber(data.performance.netYieldPercent)} %`,
    },
    {
      label: "Kaufpreisfaktor",
      value: `${formatNumber(data.performance.purchasePriceFactor)}x`,
    },
    {
      label: "Cash-on-Cash",
      value: data.performance.returnOnEquityPercent === null
        ? "nicht berechenbar"
        : `${formatNumber(data.performance.returnOnEquityPercent)} %`,
    },
  ]);

  y += 4;
  sectionTitle(
    "Kaufpreis-Szenarien",
    "Ist-Zustand, ausschöpfbares Mietpotenzial und die Rückwärtsrechnung mit 10,00 EUR/m2 im direkten Vergleich.",
  );
  corridorGrid([
    {
      label: "1. Aktueller Angebotspreis",
      value: formatEuro(data.acquisition.purchasePrice),
      color: data.reverse.offerValueGap <= 0
        ? COLORS.positive
        : COLORS.negative,
      details: [
        {
          label: "Gesamtinvestition",
          value: formatEuro(data.acquisition.totalInvestment),
        },
        {
          label: "Gesamtinvestition / m2",
          value: `${formatNumber(data.acquisition.totalInvestment / data.object.livingArea)} EUR`,
        },
        {
          label: "Ist-Miete",
          value: `${formatEuro(data.rent.monthly)} / Mo.`,
        },
        {
          label: "Ist-Miete / m2",
          value: `${formatNumber(data.rent.perSqm)} EUR`,
        },
        {
          label: "Cashflow beim Angebot",
          value: `${formatSignedEuro(data.performance.cashFlowMonthly)} / Mo.`,
        },
        {
          label: "Break-even-Miete",
          value: `${formatEuro(data.reverse.breakEven.requiredMonthlyRent)} / Mo.`,
        },
        {
          label: "Break-even / m2",
          value: `${formatNumber(data.reverse.breakEven.requiredRentPerSqm)} EUR`,
        },
      ],
    },
    {
      label: "2. Mietpotenzial ausgeschöpft",
      value: `${formatEuro(data.potential.monthly)} / Mo.`,
      color: data.potential.cashFlowMonthly > 0
        ? COLORS.positive
        : data.potential.cashFlowMonthly < 0
          ? COLORS.negative
          : COLORS.neutral,
      details: [
        {
          label: `Bestandsmiete +${formatNumber(data.potential.rentIncreasePercent)} %`,
          value: `${formatEuro(data.potential.baseRentAfterIncreaseMonthly)} / Mo.`,
        },
        {
          label: "Leerstand reaktiviert",
          value: `${formatEuro(data.potential.vacancyReactivationMonthly)} / Mo.`,
        },
        {
          label: "Stellplätze",
          value: `${formatEuro(data.potential.parkingMonthly)} / Mo.`,
        },
        {
          label: "PV / Solar",
          value: `${formatEuro(data.potential.solarMonthly)} / Mo.`,
        },
        {
          label: "Sonstige Einnahmen",
          value: `${formatEuro(data.potential.otherMonthly)} / Mo.`,
        },
        {
          label: "Potenzial-Miete / m2",
          value: `${formatNumber(data.potential.perSqm)} EUR`,
        },
        {
          label: "Potenzial / Jahr",
          value: formatEuro(data.potential.annual),
        },
        {
          label: "Cashflow Potenzial",
          value: `${formatSignedEuro(data.potential.cashFlowMonthly)} / Mo.`,
        },
        {
          label: "Gesamtinvestition / m2",
          value: `${formatNumber(data.potential.totalInvestmentPerSqm)} EUR`,
        },
      ],
    },
    {
      label: `3. Rückwärtsrechnung: ${formatNumber(data.targetRent.rentPerSqm)} EUR/m2`,
      value: formatEuro(data.targetRent.maxPurchasePrice),
      color: COLORS.accent,
      details: [
        {
          label: "Zielmiete / Monat",
          value: `${formatEuro(data.targetRent.monthly)} / Mo.`,
        },
        {
          label: "Zielmiete / Jahr",
          value: formatEuro(data.targetRent.annual),
        },
        {
          label: "Kaufpreis / m2",
          value: `${formatNumber(data.targetRent.purchasePricePerSqm)} EUR`,
        },
        {
          label: "Gesamtinvestition",
          value: formatEuro(data.targetRent.totalInvestment),
        },
        {
          label: "Gesamtinvestition / m2",
          value: `${formatNumber(data.targetRent.totalInvestmentPerSqm)} EUR`,
        },
        {
          label: "Kaufnebenkosten",
          value: formatEuro(data.targetRent.acquisitionCosts),
        },
        {
          label: "Darlehen",
          value: formatEuro(data.targetRent.loanAmount),
        },
        {
          label: "Cashflow beim Angebot",
          value: `${formatSignedEuro(data.targetRent.cashFlowAtOfferMonthly)} / Mo.`,
        },
        {
          label: "Abstand zum Angebot",
          value: formatSignedEuro(data.targetRent.offerGap),
        },
      ],
    },
  ]);

  newPage("Seite 2 - Szenarien und Prüfung");
  sectionTitle(
    "Cashflow-Szenarien beim Angebotspreis",
    "Die Linie zeigt die aktuelle Miete, das hinterlegte Mietpotenzial und eine Zielmiete von 10,00 EUR/m2 im Vergleich.",
  );
  cashFlowLineChart();

  const plausibilityColor = toneColor(data.plausibility.tone);
  const currentCashFlowText = data.performance.cashFlowMonthly >= 0
    ? `Bei der aktuellen Kaltmiete von ${formatEuroText(data.rent.monthly)} verbleibt am Angebotspreis ein positiver Cashflow von ${formatSignedEuro(data.performance.cashFlowMonthly)} / Monat.`
    : `Bei der aktuellen Kaltmiete von ${formatEuroText(data.rent.monthly)} entsteht am Angebotspreis ein negativer Cashflow von ${formatSignedEuro(data.performance.cashFlowMonthly)} / Monat.`;
  const potentialRentText = `Das hinterlegte Mietpotenzial ergibt ${formatEuroText(data.potential.monthly)} pro Monat (${formatNumber(data.potential.perSqm)} EUR/m2) und einen Cashflow von ${formatSignedEuro(data.potential.cashFlowMonthly)} / Monat. Renovierungskosten sind in diesem Szenario nicht berücksichtigt.`;
  const targetRentText = `Mit einer Zielmiete von ${formatNumber(data.targetRent.rentPerSqm)} EUR/m2 beträgt die mögliche Kaltmiete ${formatEuroText(data.targetRent.monthly)} pro Monat. Der dazugehörige maximale Kaufpreis liegt bei ${formatEuroText(data.targetRent.maxPurchasePrice)}.`;
  const priceContext = data.targetRent.offerGap > 0
    ? `Der aktuelle Angebotspreis liegt ${formatEuroText(data.targetRent.offerGap)} über diesem 10-EUR/m2-Rechenwert. Die Zielmiete und alle zusätzlichen Erträge müssen daher durch Markt-, Vertrags- und Mietrechtsdaten belegbar sein.`
    : `Der aktuelle Angebotspreis liegt ${formatEuroText(Math.abs(data.targetRent.offerGap))} unter dem 10-EUR/m2-Rechenwert und bietet damit einen zusätzlichen Preis- und Cashflowpuffer.`;
  const plausibilitySections = [
    { title: "Aktuelle Lage", text: currentCashFlowText },
    { title: "Mietpotenzial", text: potentialRentText },
    { title: "Zielmiete 10,00 EUR/m2", text: targetRentText },
    { title: "Handlungsoption", text: priceContext },
  ];
  const plausibilityConclusion = data.potential.cashFlowMonthly < 0
    ? "Fazit: Selbst das hinterlegte Mietpotenzial trägt den Angebotspreis nicht vollständig."
    : data.targetRent.offerGap > 0
      ? "Fazit: Potenzial belegen und den Kaufpreis am 10-EUR/m2-Rechenwert ausrichten."
      : "Fazit: Die Szenarien sind rechnerisch tragfähig; Annahmen weiterhin belegen.";
  const plausibilityHeight = 78;
  setFill(COLORS.surface);
  setDraw(plausibilityColor);
  doc.setLineWidth(0.55);
  doc.roundedRect(margin, y, contentWidth, plausibilityHeight, 4, 4, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  setText(plausibilityColor);
  doc.text(`Rechnerische Einordnung: ${data.plausibility.label}`, margin + 6, y + 8);
  let plausibilityY = y + 15;
  plausibilitySections.forEach((section) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.8);
    setText(COLORS.muted);
    doc.text(section.title, margin + 6, plausibilityY);
    plausibilityY += 3.8;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.3);
    setText(COLORS.ink);
    const lines = doc.splitTextToSize(section.text, contentWidth - 12);
    doc.text(lines, margin + 6, plausibilityY);
    plausibilityY += lines.length * 4 + 1.4;
  });
  setDraw(COLORS.line);
  doc.setLineWidth(0.2);
  doc.line(margin + 6, y + 66, pageWidth - margin - 6, y + 66);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.2);
  setText(plausibilityColor);
  doc.text(plausibilityConclusion, margin + 6, y + 73);
  y += plausibilityHeight + 6;

  y += 6;
  sectionTitle("Empfohlene Prüfung vor einer Entscheidung");
  paragraph(
    "1. Mieterliste, Mietverträge, Zahlungsstände und umlagefähige Kosten belegen lassen.\n2. Erforderliche Miete mit lokalem Mietspiegel, Neuvermietungsangeboten und Mietrecht prüfen.\n3. Instandhaltungsstau, Leerstand, Steuern und Zinsänderungsrisiko separat bewerten.\n4. Kaufpreisverhandlung am realistischen Ist-Mietwert und am Break-even-Rechenwert ausrichten.",
    { size: 8.5, color: COLORS.ink },
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  setText(COLORS.muted);
  const disclaimer = doc.splitTextToSize(
    "Hinweis: Diese Unterlage ist eine überschlägige Investitions- und Cashflowanalyse. Sie ist kein Verkehrswertgutachten, keine Finanzierungszusage, keine Steuer- oder Rechtsberatung und keine Aussage zur mietrechtlichen Zulässigkeit einer Erhöhung. Marktwert und Realisierbarkeit müssen durch geeignete Nachweise geprüft werden.",
    contentWidth,
  );
  doc.text(disclaimer, margin, pageHeight - 19);

  const totalPages = pageNumber;
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    setDraw(COLORS.line);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setText(COLORS.muted);
    doc.text("ImmoCalc - Investitionsanalyse", margin, pageHeight - 5.5);
    doc.text(`Seite ${page} von ${totalPages}`, pageWidth - margin, pageHeight - 5.5, {
      align: "right",
    });
  }

  return doc;
}

export function createInvestmentReportPdf(
  data: InvestmentReportData,
): jsPDF {
  return drawReport(data);
}

export function downloadInvestmentReportPdf(
  data: InvestmentReportData,
): void {
  const date = data.generatedAt.toISOString().slice(0, 10);
  const filename = `immocalc-analyse-${safeFilename(data.object.name)}-${date}.pdf`;
  drawReport(data).save(filename);
}
