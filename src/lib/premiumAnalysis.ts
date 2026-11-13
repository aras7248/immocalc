import type { PremiumChatContext } from "./premiumChat.ts";
import { PREMIUM_ANALYSIS_STEPS } from "./premiumAnalysisPrompts.ts";
import { shiftPremiumLoanRates, calculatePremiumInvestment } from "../domain/immocalc/premium.ts";

export type AnalysisResult = { text: string; missing: string[] };
const euro = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
    : "nicht berechenbar";
const num = (n: number) =>
  Number.isFinite(n)
    ? n.toLocaleString("de-DE", { maximumFractionDigits: 2 })
    : "nicht berechenbar";
export function analysisFingerprint(c: PremiumChatContext) {
  return JSON.stringify([
    c.object,
    c.calculation,
    c.exposeFacts,
    c.investmentInput,
  ]);
}
export function createAnalysisStep(
  step: number,
  c: PremiumChatContext,
  notes: string,
): AnalysisResult {
  const calc = c.calculation,
    o = c.object;
  const facts = c.exposeFacts?.facts ?? [];
  const hasRent = calc.monthlyRent > 0;
  const missing: string[] = [];
  const table = (rows: string[][]) =>
    [
      "| Kennzahl | Wert / Grundlage |",
      "| --- | --- |",
      ...rows.map((r) => `| ${r.join(" | ")} |`),
    ].join("\n");
  let text = "";
  if (step === 1) {
    if (!facts.some((f) => ["address", "location"].includes(f.key)))
      missing.push("Vollständige Objektadresse und Objektart bestätigen.");
    if (!hasRent)
      missing.push(
        "Ist-Kaltmiete oder belegten Leerstand angeben; Neuvermietungsmiete gesondert als [Annahme].",
      );
    if (!o.yearBuilt) missing.push("Baujahr und Modernisierungen ergänzen.");
    if (!facts.some((f) => ["heating", "energySource"].includes(f.key)))
      missing.push("Heizung, Energieausweis und Zustand belegen.");
    text =
      "Die folgenden Werte stammen aus dem Rechner und sind ungeprüfte Nutzerangaben beziehungsweise [Annahme], solange kein Nachweis vorliegt.\n\n" + table([
        ["Objekt", o.name || "fehlt"],
        ["Bundesland", o.federalState],
        ["Wohnfläche", o.livingArea > 0 ? `${num(o.livingArea)} m²` : "fehlt"],
        ["Kaufpreis", o.purchasePrice > 0 ? euro(o.purchasePrice) : "fehlt"],
        [
          "Kaufpreis / m²",
          o.livingArea > 0 ? euro(o.purchasePrice / o.livingArea) : "fehlt",
        ],
        ["Baujahr", o.yearBuilt ? String(o.yearBuilt) : "fehlt"],
        [
          "Monatskaltmiete",
          hasRent ? euro(calc.monthlyRent) : "fehlt / Leerstand bestätigen",
        ],
        ["Kaufnebenkosten", euro(calc.acquisitionCosts)],
      ]) +
      "\n\n**Erkannte Exposé-Angaben**\n" +
      (facts
        .map((f) => `- ${f.label}: ${f.value} [Exposé-Angabe, zu prüfen]`)
        .join("\n") || "Keine strukturierten Exposé-Nachweise vorhanden.") +
      "\n\nNoch keine abschließende Bewertung. Auffälligkeiten: " +
      (calc.loanAmount > o.purchasePrice
        ? "Die Finanzierung übersteigt den Kaufpreis. "
        : "") +
      (c.exposeFacts?.warnings.join(" ") ||
        "Die vorliegenden Daten erlauben noch keine vollständige Zustandsprüfung.");
  } else if (step === 2) {
    missing.push(
      "Aktuelle Vergleichsangebote / Mietspiegel / Bodenrichtwert mit Quelle, Datum und Vergleichbarkeit prüfen.",
    );
    text =
      "**Makrolage:** Bevölkerung, Arbeitsmarkt, Infrastruktur und Wohnraumnachfrage anhand datierter Quellen prüfen.\n\n**Mikrolage:** ÖPNV, Versorgung, Lärm, Umfeld und Vermietbarkeit prüfen.\n\n**Marktvergleich:** Angebotspreise von tatsächlichen Kaufpreisen trennen; Zustand, Fläche, Baujahr und Lage vergleichen.\n\nOhne geprüfte Vergleichsdaten bleiben Kaufpreis-/Mietkorridor und Lagebewertung 1–10 offen. Notizen sind Nutzerangaben und werden nicht automatisch zu verifizierten Marktdaten.";
  } else if (step === 3) {
    if (!hasRent)
      missing.push(
        "Miete fehlt: Rendite, Cashflow, DSCR und Break-even sind noch nicht belastbar.",
      );
    if (!c.investmentInput)
      missing.push("Vollständige Premium-Rechenannahmen fehlen.");
    const i = c.investmentInput,
      result = i ? calculatePremiumInvestment(i) : null;
    const rentDefaultPercent = calc.rentDefaultPercent ?? 0;
    const noi =
      calc.annualRent * (1 - calc.vacancyPercent / 100) * (1 - rentDefaultPercent / 100) -
      calc.operatingCostsAnnual;
    text = table([
      ["Gesamtkapitalbedarf", euro(calc.totalInvestment)],
      ["Kaufnebenkosten", euro(calc.acquisitionCosts)],
      ["Eigenkapital", i ? euro(i.equityAmount) : "fehlt"],
      ["Darlehen", euro(calc.loanAmount)],
      [
        "Jahreskaltmiete",
        hasRent
          ? `${euro(calc.monthlyRent)} × 12 = ${euro(calc.annualRent)}`
          : "fehlt",
      ],
      ["Leerstandspuffer", `${num(calc.vacancyPercent)} % [Annahme]`],
      ["Mietausfall auf Miete nach Leerstand", `${num(rentDefaultPercent)} % [Annahme]`],
      ["Eigentümerkosten / Jahr", euro(calc.operatingCostsAnnual)],
      [
        "Nettoertrag vor Finanzierung",
        hasRent
          ? `${euro(calc.annualRent)} × (1 − ${num(calc.vacancyPercent)} %) × (1 − ${num(rentDefaultPercent)} %) − ${euro(calc.operatingCostsAnnual)} = ${euro(noi)}`
          : "fehlt",
      ],
      [
        "Kaufpreis / m²",
        o.livingArea > 0 ? euro(o.purchasePrice / o.livingArea) : "fehlt",
      ],
      [
        "Bruttomietrendite",
        hasRent && o.purchasePrice > 0
          ? `${num((calc.annualRent / o.purchasePrice) * 100)} %`
          : "nicht bewertbar",
      ],
      [
        "Nettorendite auf Gesamtinvestition",
        hasRent && calc.totalInvestment > 0
          ? `${num((noi / calc.totalInvestment) * 100)} %`
          : "nicht bewertbar",
      ],
      [
        "Kaufpreisfaktor",
        hasRent ? num(o.purchasePrice / calc.annualRent) : "nicht bewertbar",
      ],
      [
        "Bankrate / Monat",
        `${euro(calc.annualDebtService)} / 12 = ${euro(calc.annualDebtService / 12)}`,
      ],
      [
        "Cashflow vor Eigentümerkosten, Leerstand und Mietausfall",
        hasRent
          ? euro(calc.monthlyRent - calc.annualDebtService / 12)
          : "nicht bewertbar",
      ],
      [
        "Cashflow nach Kosten / vor Steuern",
        hasRent
          ? `${euro(noi)} / 12 − ${euro(calc.annualDebtService / 12)} = ${euro(calc.monthlyCashFlow)}`
          : "nicht bewertbar",
      ],
      [
        "Break-even-Miete / m² / Monat",
        hasRent
          ? euro(calc.breakEvenRentPerSqm)
          : "erst nach Klärung der Miete einordnen",
      ],
      [
        "DSCR",
        hasRent && calc.annualDebtService > 0
          ? `${num(noi)} / ${num(calc.annualDebtService)} = ${num(calc.dscr)}`
          : "nicht bewertbar",
      ],
      [
        "Cash-on-Cash-Rendite",
        hasRent && i && i.equityAmount > 0
          ? `${num(((calc.monthlyCashFlow * 12) / i.equityAmount) * 100)} %`
          : "ohne positives Eigenkapital nicht berechenbar",
      ],
      [
        "Sanierung",
        i
          ? `${euro(i.renovationCosts)} [Annahme, Kostenvoranschläge prüfen]`
          : "fehlt",
      ],
    ]);
    if (i && result) {
      text +=
        "\n\n**Restschuld**\n" +
        table(
          [10, 15, 20].map((year) => [
            `${year} Jahre`,
            euro(
              calculatePremiumInvestment({ ...i, forecastYears: year })
                .remainingDebtAtExit,
            ),
          ]),
        );
      const variants = [
        [
          "Zins +0,5 Prozentpunkte",
          shiftPremiumLoanRates(i, 0.5),
        ],
        ["Zins +1,0 Prozentpunkte", shiftPremiumLoanRates(i, 1)],
        ["Miete −10 %", { monthlyRent: i.monthlyRent * 0.9 }],
        [
          "Eigentümerkosten +5 %",
          {
            maintenancePerSqmMonthly: i.maintenancePerSqmMonthly * 1.05,
            managementMonthly: i.managementMonthly * 1.05,
            reserveMonthly: i.reserveMonthly * 1.05,
            nonRecoverableHoaMonthly: (i.nonRecoverableHoaMonthly ?? 0) * 1.05,
            otherOwnerCostsMonthly: (i.otherOwnerCostsMonthly ?? 0) * 1.05,
          },
        ],
        [
          "Sanierung zusätzlich 10.000 € [Annahme]",
          { renovationCosts: i.renovationCosts + 10000 },
        ],
      ] as const;
      text +=
        "\n\n**Einzelfaktor-Sensitivitäten – alle anderen Annahmen bleiben gleich**\n" +
        table(
          variants.map(([label, changes]) => [
            label,
            hasRent
              ? `${euro(calculatePremiumInvestment({ ...i, ...changes }).monthlyCashFlow)} Cashflow / Monat`
              : "Miete fehlt",
          ]),
        );
    }
    text +=
      "\n\nKostenpositionen gegen Hausgeld und Abrechnung abgleichen: Verwaltung, Rücklage und Instandhaltung nicht doppelt ansetzen. Sollzins und Tilgung sind Rechenannahmen, keine Bankzusage. Steuerwirkung ist nicht enthalten.";
  } else if (step === 4) {
    missing.push(
      "Technische Befunde, Unterlagen und belastbare Kostenschätzungen fehlen für bezifferte Risikoabschläge.",
      "Geprüfte Marktvergleiche und nachhaltiger Ertragsansatz fehlen für eine faire Kaufpreisspanne.",
    );
    text =
      "| Risiko | Wahrscheinlichkeit | Finanzielle Auswirkung | Verhandlung |\n| --- | --- | --- | --- |\n" +
      [
        "Dach, Fassade, Fenster",
        "Heizung und Energieeffizienz",
        "Elektrik, Leitungen, Feuchtigkeit",
        "WEG / Sonderumlagen",
        "Mietverträge, Leerstand, Mietpotenzial",
        "Grundbuch, Genehmigungen und rechtliche Unterlagen",
      ]
        .map(
          (r) => `| ${r} | ungeprüft | nicht beziffert | Nachweis anfordern |`,
        )
        .join("\n");
    const i = c.investmentInput;
    if (i && hasRent && i.interestPercent + i.repaymentPercent > 0) {
      let low = 0,
        high = Math.max(o.purchasePrice * 4, 1000000);
      for (let j = 0; j < 70; j++) {
        const mid = (low + high) / 2;
        if (
          calculatePremiumInvestment({ ...i, purchasePrice: mid })
            .monthlyCashFlow >= 0
        )
          low = mid;
        else high = mid;
      }
      text += `\n\n**Investorenperspektive:** Cashflow-neutrale Kaufpreisobergrenze unter den aktuellen Kosten- und Finanzierungsannahmen: ${euro(low)}. Modellrechnung, kein Marktwert. Eine Mindestrendite muss als eigenes Ziel ergänzt werden.`;
    }
    text +=
      "\n\n| Bewertungsansatz | Ergebnis |\n| --- | --- |\n| Vergleichswert | offen: geeignete Vergleichsdaten fehlen |\n| Ertragswertorientierung | offen: nachhaltiger Ertrag und marktüblicher Faktor zu belegen |\n| Sehr attraktiver / fairer / maximaler Kaufpreis / überhöhter Bereich | noch nicht belastbar ableitbar |\n\nSanierungskosten und Risikoabschläge nicht doppelt abziehen. Ohne Befund keine erfundenen Abschläge und keine scheinpräzise Preisspanne.";
  } else if (step === 5) {
    missing.push(
      "Angebotsbetrag und belegte Markt-/Risikoargumente vor Verwendung bestätigen.",
    );
    text =
      "**Verkäufer-Präsentation**\n1. Einleitung: Vielen Dank für die Unterlagen und die Möglichkeit, das Objekt zu prüfen.\n2. Positive Aspekte: Nur tatsächlich belegte Objektvorteile einsetzen.\n3. Bewertungsgrundlage: Kaufpreis, Flächen, Mieten und Unterlagen transparent benennen.\n4. Marktvergleich: Nur geeignete, datierte Vergleiche verwenden.\n5. Wirtschaftlichkeit: Die bestätigte Rechnung und eigene Finanzierungsannahmen getrennt darstellen.\n6. Zustand und Investitionen: Nur dokumentierte Befunde und Kosten anführen.\n7. Angebot: Betrag erst nach Bestätigung aus Schritt 4 einsetzen.\n8. Fazit: Angebot steht unter dem Vorbehalt der offenen Unterlagenprüfung.\n\n**Starke Argumente:** belegte Vergleichspreise, tatsächliche Mieterlöse, konkrete Kostenvoranschläge.\n**Vermeiden:** erfundene Schäden, pauschale Altersabschläge, eigene teure Finanzierung als objektiven Marktwert ausgeben.\n**Einwand „Andere zahlen mehr“:** Ich verstehe Ihre Erwartung. Mein Angebot ergibt sich aus den vorliegenden Nachweisen und den transparenten Annahmen.\n**Gesprächseinstieg:** Ich möchte Ihnen die Herleitung meines Angebots sachlich erläutern.\n**Angebotsformulierung:** Auf Basis der gemeinsam geprüften Unterlagen biete ich [bestätigten Betrag einsetzen] Euro, vorbehaltlich [offene Prüfungen].\n**Bei Ablehnung:** Vielen Dank für die Rückmeldung. Welche konkreten Annahmen bewerten Sie anders?";
  } else
    text =
      "Der Gesamtbericht führt alle bestätigten Schritte, Quellenangaben, Annahmen und offenen Punkte zusammen. Nicht geprüfte Angaben bleiben ausdrücklich offen.";
  return {
    text: `## ${step}. ${PREMIUM_ANALYSIS_STEPS[step - 1]?.title ?? "Bericht"}\n\n${text}${notes.trim() ? `\n\n**Ergänzte Nutzerangaben / Quellen (ungeprüft)**\n${notes.trim()}` : ""}${missing.length ? `\n\n**Annahmen & offene Punkte**\n${missing.map((x) => "- " + x).join("\n")}` : ""}`,
    missing,
  };
}
export function createAnalysisReport(c: PremiumChatContext, results: string[]) {
  return `# Immobilienbewertung – ${c.object.name || "Aktive Immobilie"}\n\n## Management-Summary\nDatenbasierte Vorprüfung vor Steuern.\n${c.calculation.monthlyRent > 0 ? "Miete ist als Rechenannahme hinterlegt." : "Miete fehlt; wirtschaftliche Kaufentscheidung bleibt offen."}\nMarktwert und Preisabschläge benötigen unabhängige Nachweise.\nAlle Ergebnisse gelten ausschließlich für die dokumentierten Annahmen.\n\n${PREMIUM_ANALYSIS_STEPS.map((step, i) => results[i] || `## ${i + 1}. ${step.title}\nNoch nicht bearbeitet.`).join("\n\n")}\n\n## Annahmen & offene Punkte – Gesamtübersicht\n${results
    .map((r) => r.split("**Annahmen & offene Punkte**")[1] ?? "")
    .filter(Boolean)
    .join(
      "\n",
    )}\nAlle vorstehenden offenen Punkte bleiben bis zum Nachweis ungeprüft. Nutzerangaben sind keine extern verifizierten Quellen. Dieser Bericht ist kein Verkehrswertgutachten. Stand: ${new Date().toLocaleDateString("de-DE")}.`;
}

export function renderAnalysisReportHtml(report: string) {
  const escape = (s: string) =>
    s.replace(
      /[&<>"']/g,
      (x) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[x]!,
    );
  const inline = (s: string) =>
    escape(s).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  const lines = report.split("\n");
  const body: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        if (!/^\|[\s:|-]+\|$/.test(lines[i]))
          rows.push(
            lines[i]
              .split("|")
              .slice(1, -1)
              .map((x) => x.trim()),
          );
        i++;
      }
      i--;
      body.push(
        "<table><thead><tr>" +
          rows[0].map((x) => "<th>" + inline(x) + "</th>").join("") +
          "</tr></thead><tbody>" +
          rows
            .slice(1)
            .map(
              (r) =>
                "<tr>" +
                r.map((x) => "<td>" + inline(x) + "</td>").join("") +
                "</tr>",
            )
            .join("") +
          "</tbody></table>",
      );
    } else if (line.startsWith("## "))
      body.push("<h2>" + inline(line.slice(3)) + "</h2>");
    else if (line.startsWith("# "))
      body.push("<h1>" + inline(line.slice(2)) + "</h1>");
    else if (line.trim()) body.push("<p>" + inline(line) + "</p>");
  }
  return (
    '<!doctype html><html lang="de"><meta charset="utf-8"><title>ImmoCalc – Immobilienbewertung</title><style>body{font:11pt system-ui;max-width:850px;margin:35px auto;color:#182235;line-height:1.5}h1{font-size:22pt}h2{font-size:15pt;margin-top:24pt;break-after:avoid}table{width:100%;border-collapse:collapse;font-size:10pt;margin:16px 0}td,th{padding:7px;border:1px solid #cbd5e1;text-align:left;vertical-align:top}th{background:#eef2f7}tr{break-inside:avoid}p{overflow-wrap:anywhere}@media print{button{display:none}body{margin:0}@page{margin:18mm}}</style><button onclick="window.print()">Drucken / als PDF speichern</button>' +
    body.join("\n") +
    "</html>"
  );
}
