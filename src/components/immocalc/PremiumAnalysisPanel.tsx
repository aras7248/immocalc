"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconAdjustmentsHorizontal,
  IconBuildingBank,
  IconChartLine,
  IconCrown,
  IconFileText,
  IconInfoCircle,
  IconMessageCircle,
  IconShieldCheck,
  IconScale,
  IconTable,
} from "@tabler/icons-react";
import { PremiumAdvisorChat } from "@/components/immocalc/PremiumAdvisorChat";
import { PremiumAssessmentReportButton } from "@/components/immocalc/PremiumAssessmentReportButton";
import {
  calculatePremiumInvestment,
  normalizePremiumLoans,
  type PremiumInvestmentInput,
  type PremiumLoan,
  type PremiumPlanId,
} from "@/domain/immocalc/premium";
import type { ExposeFacts } from "@/lib/exposeImport";
import type {
  EnergyPlan,
  FinancingResearch,
  FinancingUse,
  HouseholdProfile,
} from "@/lib/financingResearch";
import type { PremiumChatContext } from "@/lib/premiumChat";
import type { PremiumAssessmentReportData } from "@/lib/premiumAssessmentReport";

type PremiumModule = "overview" | "financing" | "funding" | "forecast" | "scenarios" | "chat";

export interface PremiumAnalysisSeed {
  objectName: string;
  purchasePrice: number;
  livingArea: number;
  yearBuilt: number;
  monthlyRent: number;
  federalState: string;
  notaryPercent: number;
  brokerPercent: number;
  hasBroker: boolean;
  maintenancePerSqmMonthly: number;
  managementMonthly: number;
  reserveMonthly: number;
  nonRecoverableHoaMonthly: number;
  otherOwnerCostsMonthly: number;
  equityAmount: number;
  interestPercent: number;
  repaymentPercent: number;
}

interface PremiumAnalysisPanelProps {
  plan: PremiumPlanId;
  seed: PremiumAnalysisSeed;
  initialInput: PremiumInvestmentInput;
  exposeFacts: ExposeFacts | null;
  onInputChange: (input: PremiumInvestmentInput) => void;
  onBackToPlans: () => void;
}

type EditablePremiumField = Exclude<
  keyof PremiumInvestmentInput,
  "purchasePrice" | "livingArea" | "federalState" | "notaryPercent" | "brokerPercent" | "hasBroker"
  | "nonRecoverableHoaMonthly" | "otherOwnerCostsMonthly" | "additionalLoans"
>;

type PremiumFormState = Record<EditablePremiumField, string>;

const EURO_FORMAT = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FORMAT = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number): string {
  return EURO_FORMAT.format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number): string {
  return NUMBER_FORMAT.format(Number.isFinite(value) ? value : 0);
}

function parseInput(value: string): number {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createInitialForm(
  seed: PremiumAnalysisSeed,
  initialInput?: PremiumInvestmentInput,
): PremiumFormState {
  return {
    monthlyRent: String(initialInput?.monthlyRent ?? seed.monthlyRent),
    maintenancePerSqmMonthly: String(
      initialInput?.maintenancePerSqmMonthly ?? seed.maintenancePerSqmMonthly,
    ),
    managementMonthly: String(initialInput?.managementMonthly ?? seed.managementMonthly),
    reserveMonthly: String(initialInput?.reserveMonthly ?? seed.reserveMonthly),
    vacancyPercent: String(initialInput?.vacancyPercent ?? 0),
    rentDefaultPercent: String(initialInput?.rentDefaultPercent ?? 0),
    renovationCosts: String(initialInput?.renovationCosts ?? 0),
    otherInitialCosts: String(initialInput?.otherInitialCosts ?? 0),
    costBufferPercent: String(initialInput?.costBufferPercent ?? 10),
    equityAmount: String(initialInput?.equityAmount ?? seed.equityAmount),
    interestPercent: String(initialInput?.interestPercent ?? seed.interestPercent),
    repaymentPercent: String(initialInput?.repaymentPercent ?? seed.repaymentPercent),
    fixedInterestYears: String(initialInput?.fixedInterestYears ?? 10),
    interestOnlyYears: String(initialInput?.interestOnlyYears ?? 0),
    followUpInterestPercent: String(initialInput?.followUpInterestPercent ?? 5.5),
    specialRepaymentAnnual: String(initialInput?.specialRepaymentAnnual ?? 0),
    rentGrowthPercent: String(initialInput?.rentGrowthPercent ?? 1.5),
    costGrowthPercent: String(initialInput?.costGrowthPercent ?? 2),
    valueGrowthPercent: String(initialInput?.valueGrowthPercent ?? 1.5),
    exitCostPercent: String(initialInput?.exitCostPercent ?? 3),
    forecastYears: String(initialInput?.forecastYears ?? 10),
  };
}

function buildPremiumInput(
  seed: PremiumAnalysisSeed,
  form: PremiumFormState,
): PremiumInvestmentInput {
  return {
    purchasePrice: seed.purchasePrice,
    livingArea: seed.livingArea,
    federalState: seed.federalState,
    notaryPercent: seed.notaryPercent,
    brokerPercent: seed.brokerPercent,
    hasBroker: seed.hasBroker,
    monthlyRent: parseInput(form.monthlyRent),
    maintenancePerSqmMonthly: parseInput(form.maintenancePerSqmMonthly),
    managementMonthly: parseInput(form.managementMonthly),
    reserveMonthly: parseInput(form.reserveMonthly),
    nonRecoverableHoaMonthly: seed.nonRecoverableHoaMonthly,
    otherOwnerCostsMonthly: seed.otherOwnerCostsMonthly,
    vacancyPercent: Math.min(100, Math.max(0, parseInput(form.vacancyPercent))),
    rentDefaultPercent: Math.min(100, Math.max(0, parseInput(form.rentDefaultPercent))),
    renovationCosts: parseInput(form.renovationCosts),
    otherInitialCosts: parseInput(form.otherInitialCosts),
    costBufferPercent: parseInput(form.costBufferPercent),
    equityAmount: parseInput(form.equityAmount),
    interestPercent: parseInput(form.interestPercent),
    repaymentPercent: parseInput(form.repaymentPercent),
    fixedInterestYears: parseInput(form.fixedInterestYears),
    interestOnlyYears: parseInput(form.interestOnlyYears),
    followUpInterestPercent: parseInput(form.followUpInterestPercent),
    specialRepaymentAnnual: parseInput(form.specialRepaymentAnnual),
    rentGrowthPercent: parseInput(form.rentGrowthPercent),
    costGrowthPercent: parseInput(form.costGrowthPercent),
    valueGrowthPercent: parseInput(form.valueGrowthPercent),
    exitCostPercent: parseInput(form.exitCostPercent),
    forecastYears: parseInput(form.forecastYears),
  };
}

function PremiumInput({
  id,
  label,
  value,
  suffix,
  min = 0,
  max,
  step = "0.1",
  helper,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  suffix: string;
  min?: number;
  max?: number;
  step?: string;
  helper?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="premium-field">
      <label htmlFor={id}>{label}</label>
      <div className="premium-field__control">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span aria-hidden="true">{suffix}</span>
      </div>
      {helper && <small>{helper}</small>}
    </div>
  );
}

function PremiumSelect<T extends string>({
  id,
  label,
  value,
  helper,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  helper?: string;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="premium-field">
      <label htmlFor={id}>{label}</label>
      <div className="premium-field__control premium-field__control--select">
        <select id={id} value={value} onChange={(event) => onChange(event.target.value as T)}>
          {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      {helper && <small>{helper}</small>}
    </div>
  );
}

export function PremiumAnalysisPanel({
  plan,
  seed,
  initialInput,
  exposeFacts,
  onInputChange,
  onBackToPlans,
}: PremiumAnalysisPanelProps) {
  const [activeModule, setActiveModule] = useState<PremiumModule>("overview");
  const [form, setForm] = useState<PremiumFormState>(() => createInitialForm(seed, initialInput));
  const [additionalLoans, setAdditionalLoans] = useState(() => normalizePremiumLoans(initialInput?.additionalLoans));
  const [fundingProfile, setFundingProfile] = useState<{
    financingUse: FinancingUse;
    energyPlan: EnergyPlan;
    householdProfile: HouseholdProfile;
    residenceLocation: string;
  }>({
    financingUse: "unknown",
    energyPlan: "unknown",
    householdProfile: "unknown",
    residenceLocation: "",
  });
  const [financingResearch, setFinancingResearch] = useState<FinancingResearch | null>(null);
  const [financingResearchState, setFinancingResearchState] = useState<"loading" | "ready" | "error">("loading");
  const [financingResearchRefresh, setFinancingResearchRefresh] = useState(0);
  const residenceLocationRef = useRef("");

  const updateField = (field: EditablePremiumField, value: string) => {
    const next = { ...form, [field]: value };
    setForm(next);
    onInputChange({ ...buildPremiumInput(seed, next), additionalLoans });
  };

  const investmentInput = { ...buildPremiumInput(seed, form), additionalLoans };
  const updateLoans = (loans: PremiumLoan[]) => {
    setAdditionalLoans(loans);
    onInputChange({ ...investmentInput, additionalLoans: loans });
  };
  const result = calculatePremiumInvestment(investmentInput);
  const objectLocation = exposeFacts?.facts.find((fact) => fact.key === "address" || fact.key === "location")?.value
    || seed.objectName;

  useEffect(() => {
    const controller = new AbortController();
    const loadResearch = async () => {
      setFinancingResearchState("loading");
      try {
        const response = await fetch("/api/financing-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            federalState: seed.federalState,
            objectLocation,
            residenceLocation: residenceLocationRef.current,
            financingUse: fundingProfile.financingUse,
            energyPlan: fundingProfile.energyPlan,
            householdProfile: fundingProfile.householdProfile,
          }),
        });
        if (!response.ok) throw new Error("Der Förder- und Zinscheck ist derzeit nicht erreichbar.");
        const data = await response.json() as FinancingResearch;
        if (!controller.signal.aborted) {
          setFinancingResearch(data);
          setFinancingResearchState("ready");
        }
      } catch {
        if (!controller.signal.aborted) {
          setFinancingResearchState("error");
        }
      }
    };
    void loadResearch();
    return () => controller.abort();
  }, [
    fundingProfile.energyPlan,
    fundingProfile.financingUse,
    fundingProfile.householdProfile,
    financingResearchRefresh,
    objectLocation,
    seed.federalState,
  ]);

  const planLabel = plan === "investor" ? "Investor" : "Professional";
  const hasRequiredData = seed.purchasePrice > 0 && seed.livingArea > 0 && result.scheduledAnnualRent > 0;
  const riskLevel = result.dscr >= 1.2
    ? "Stabil"
    : result.dscr >= 1
      ? "Knapp tragfähig"
      : "Nicht gedeckt";

  const moduleItems: Array<{
    id: PremiumModule;
    label: string;
    icon: typeof IconChartLine;
  }> = [
    { id: "overview", label: "Entscheidung", icon: IconChartLine },
    { id: "chat", label: "KI-Chat", icon: IconMessageCircle },
    { id: "financing", label: "Finanzierung", icon: IconBuildingBank },
    { id: "funding", label: "Zins & Förderung", icon: IconShieldCheck },
    { id: "forecast", label: "Entwicklung & Exit", icon: IconTable },
    { id: "scenarios", label: "Szenarien", icon: IconAdjustmentsHorizontal },
  ];

  const chatContext: PremiumChatContext = {
    object: {
      name: seed.objectName,
      federalState: seed.federalState,
      livingArea: seed.livingArea,
      purchasePrice: seed.purchasePrice,
      yearBuilt: seed.yearBuilt,
    },
    calculation: {
      monthlyRent: investmentInput.monthlyRent,
      annualRent: result.scheduledAnnualRent,
      totalInvestment: result.totalInvestment,
      acquisitionCosts: result.acquisitionCostAmount,
      loanAmount: result.loanAmount,
      interestPercent: investmentInput.interestPercent,
      repaymentPercent: investmentInput.repaymentPercent,
      annualDebtService: result.annualDebtService,
      operatingCostsAnnual: result.operatingCostsAnnual,
      monthlyCashFlow: result.monthlyCashFlow,
      dscr: result.dscr,
      breakEvenRentPerSqm: result.breakEvenRentPerSqm,
      vacancyPercent: investmentInput.vacancyPercent,
      rentDefaultPercent: investmentInput.rentDefaultPercent,
    },
    exposeFacts,
    financingResearch,
    investmentInput,
  };

  const scenarioAtNineEuro = calculatePremiumInvestment({
    ...investmentInput,
    monthlyRent: seed.livingArea * 9,
  });
  const scenarioAtTenEuro = calculatePremiumInvestment({
    ...investmentInput,
    monthlyRent: seed.livingArea * 10,
  });
  const reportData: PremiumAssessmentReportData = {
    generatedAt: new Date(),
    object: {
      name: seed.objectName,
      federalState: seed.federalState,
      livingArea: seed.livingArea,
      yearBuilt: seed.yearBuilt,
    },
    result,
    exposeFacts,
    financingResearch,
    scenarios: [
      {
        label: "1. Hinterlegte Miete",
        description: "Aktuelle Eingabe im Premium-Rechner",
        rentPerSqm: seed.livingArea > 0 ? investmentInput.monthlyRent / seed.livingArea : 0,
        monthlyRent: investmentInput.monthlyRent,
        monthlyCashFlow: result.monthlyCashFlow,
        dscr: result.dscr,
      },
      {
        label: "2. Szenario 9,00 EUR / m2",
        description: "Rechenannahme, Markt- und Mietrecht separat belegen",
        rentPerSqm: 9,
        monthlyRent: scenarioAtNineEuro.input.monthlyRent,
        monthlyCashFlow: scenarioAtNineEuro.monthlyCashFlow,
        dscr: scenarioAtNineEuro.dscr,
      },
      {
        label: "3. Szenario 10,00 EUR / m2",
        description: "Sensitivität, keine Zusage zur erzielbaren Miete",
        rentPerSqm: 10,
        monthlyRent: scenarioAtTenEuro.input.monthlyRent,
        monthlyCashFlow: scenarioAtTenEuro.monthlyCashFlow,
        dscr: scenarioAtTenEuro.dscr,
      },
    ],
  };
  const documentFacts = exposeFacts?.facts ?? [];
  const documentWarnings = exposeFacts?.warnings ?? [];
  const hasRentEvidence = investmentInput.monthlyRent > 0;
  const decisionStatus = hasRequiredData && result.monthlyCashFlow >= 0 && result.dscr >= 1
    ? "Rechnerisch tragfähig"
    : "Vor Entscheidung prüfen";

  return (
    <section
      id="premium-panel"
      role="tabpanel"
      aria-labelledby="premium-tab"
      className="premium-analysis"
    >
      <header className="premium-analysis__header">
        <div>
          <span className="premium-analysis__badge">
            <IconCrown size={16} aria-hidden="true" />
            Premium · {planLabel}
          </span>
          <h2>Premium-Entscheidungsanalyse</h2>
          <p>
            {seed.objectName || "Aktive Immobilie"} · {formatNumber(seed.livingArea)} m² ·{" "}
            {formatCurrency(seed.purchasePrice)}
          </p>
        </div>
        <div className="premium-analysis__actions">
          <button
            type="button"
            className="premium-analysis__chat-action"
            onClick={() => setActiveModule("chat")}
          >
            <IconMessageCircle size={17} aria-hidden="true" />
            Geführte Analyse öffnen
          </button>
          <PremiumAssessmentReportButton data={reportData} />
          <button type="button" className="premium-analysis__secondary" onClick={onBackToPlans}>
            Tarifansicht
          </button>
        </div>
      </header>

      <div className="premium-analysis__source-note" role="note">
        <IconInfoCircle size={19} aria-hidden="true" />
        <span>
          Das Premium-Dossier trennt Exposé-Fakten, Rechenannahmen und offene Prüfpunkte.
          {hasRentEvidence
            ? " Die hinterlegte Miete ist eine Annahme und sollte bei Bestandsobjekten mit der Mieterliste abgeglichen werden."
            : " Es liegt noch keine verwertbare Miete vor - deshalb ist die wirtschaftliche Bewertung vorläufig."}
        </span>
      </div>

      <nav className="premium-analysis__nav" aria-label="Premium-Module">
        {moduleItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={activeModule === id ? "is-active" : ""}
            onClick={() => setActiveModule(id)}
            aria-current={activeModule === id ? "page" : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {!hasRequiredData && (
        <p className="premium-analysis__warning" role="alert">
          Für Cashflow, DSCR und Break-even fehlt noch eine belegte Ist-Miete oder eine klar markierte Neuvermietungsannahme.
        </p>
      )}

      {activeModule === "overview" && (
        <div className="premium-analysis__content">
          <section className={`premium-dossier-hero ${decisionStatus === "Rechnerisch tragfähig" ? "is-stable" : "is-open"}`}>
            <div>
              <span>ENTSCHEIDUNGSDOSSIER</span>
              <h3>{decisionStatus}</h3>
              <p>
                {decisionStatus === "Rechnerisch tragfähig"
                  ? "Die hinterlegten Zahlen decken die Finanzierung rechnerisch. Jetzt zählt die Belegbarkeit von Miete, Zustand und Unterlagen."
                  : "Noch keine belastbare Kaufzusage: Exposé-Fakten, Miete, Risiken und Finanzierung müssen gemeinsam geprüft werden."}
              </p>
            </div>
            <button type="button" onClick={() => setActiveModule("chat")}>
              <IconMessageCircle size={18} aria-hidden="true" />
              Analyse Schritt für Schritt starten
            </button>
          </section>

          <div className="premium-dossier-status" aria-label="Stand der Premium-Entscheidungsanalyse">
            <article>
              <IconFileText size={18} aria-hidden="true" />
              <span>Exposé-Daten</span>
              <strong>{documentFacts.length ? `${documentFacts.length} Fakten erkannt` : "Dokument fehlt"}</strong>
              <small>{documentWarnings.length ? `${documentWarnings.length} Prüfpunkte offen` : "Keine Abweichung erkannt"}</small>
            </article>
            <article>
              <IconShieldCheck size={18} aria-hidden="true" />
              <span>Wirtschaftlichkeit</span>
              <strong className={result.monthlyCashFlow >= 0 ? "positive" : "negative"}>{formatCurrency(result.monthlyCashFlow)} / Monat</strong>
              <small>nach Kosten und Bankrate</small>
            </article>
            <article>
              <IconScale size={18} aria-hidden="true" />
              <span>Tragfähigkeit</span>
              <strong>DSCR {formatNumber(result.dscr)}</strong>
              <small>{riskLevel} · Break-even {formatCurrency(result.breakEvenRentPerSqm)} / m²</small>
            </article>
            <article>
              <IconBuildingBank size={18} aria-hidden="true" />
              <span>Zins & Förderung</span>
              <strong>
                {financingResearchState === "loading"
                  ? "wird aktualisiert"
                  : financingResearch?.benchmark.valuePercent != null
                    ? `${formatNumber(financingResearch.benchmark.valuePercent)} % Referenzzins`
                    : "Referenzzins offen"}
              </strong>
              <small>
                {financingResearch
                  ? `${financingResearch.programs.filter((program) => program.fit === "possible").length} Förderweg(e) potenziell passend`
                  : "Förderkriterien prüfen"}
              </small>
            </article>
          </div>

          <div className="premium-dossier-grid">
            <section className="premium-dossier-card">
              <div className="premium-dossier-card__heading">
                <span>01</span>
                <h3>Objekt- und Faktenlage</h3>
              </div>
              {documentFacts.length ? (
                <dl className="premium-dossier-list">
                  {documentFacts.slice(0, 6).map((fact) => (
                    <div key={fact.key}>
                      <dt>{fact.label}</dt>
                      <dd>{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="premium-dossier-card__empty">Lade ein Exposé oder hinterlege einen Link. Der Premium-Bereich trennt danach automatisch erkannte Fakten von Annahmen.</p>
              )}
            </section>

            <section className="premium-dossier-card premium-dossier-card--risks">
              <div className="premium-dossier-card__heading">
                <span>02</span>
                <h3>Risiken und Unterlagen vor Kauf</h3>
              </div>
              <ol className="premium-dossier-risks">
                {(documentWarnings.length ? documentWarnings : [
                  "Ist-Miete oder nachvollziehbare Neuvermietungsannahme belegen.",
                  "Wohnflächenberechnung, Grundrisse und Energieausweis anfordern.",
                  "Heizung, Modernisierungen und möglicher Instandhaltungsstau dokumentieren.",
                ]).slice(0, 4).map((warning, index) => (
                  <li key={warning}><span>{index + 1}</span>{warning}</li>
                ))}
              </ol>
            </section>

            <section className="premium-dossier-card premium-dossier-card--economics">
              <div className="premium-dossier-card__heading">
                <span>03</span>
                <h3>Wirtschaftlichkeit im Überblick</h3>
              </div>
              <dl className="premium-dossier-list">
                <div><dt>Gesamtinvestition</dt><dd>{formatCurrency(result.totalInvestment)}</dd></div>
                <div><dt>Gesamtrate der Darlehen</dt><dd>{formatCurrency(result.annualDebtService / 12)} / Monat</dd></div>
                <div><dt>Hinterlegte Miete</dt><dd>{hasRentEvidence ? `${formatCurrency(investmentInput.monthlyRent)} / Monat` : "nicht belegt"}</dd></div>
                <div><dt>Cashflow</dt><dd className={result.monthlyCashFlow >= 0 ? "positive" : "negative"}>{formatCurrency(result.monthlyCashFlow)} / Monat</dd></div>
              </dl>
            </section>

            <section className="premium-dossier-card premium-dossier-card--next">
              <div className="premium-dossier-card__heading">
                <span>04</span>
                <h3>Analyse und Verhandlung vertiefen</h3>
              </div>
              <p>Der KI-Chat erstellt eine strukturierte Einordnung aus Fakten, Rechenannahmen, Risiken und konkreten nächsten Schritten. Er nennt fehlende Daten ausdrücklich, statt sie zu erfinden.</p>
              <div className="premium-dossier-card__actions">
                <button type="button" onClick={() => setActiveModule("chat")}>
                  Geführte Analyse starten <IconMessageCircle size={16} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setActiveModule("funding")}>
                  Zins & Förderung prüfen <IconBuildingBank size={16} aria-hidden="true" />
                </button>
              </div>
            </section>

            <section className="premium-dossier-card premium-dossier-card--economics" style={{ gridColumn: "1 / -1" }}>
              <h3>Darlehen im Überblick</h3>
              <p>Monatsraten im ersten Jahr inklusive angesetzter Sondertilgungen. Restschuld am Ende von Jahr {result.input.forecastYears}.</p>
              <div className="premium-table-wrap">
                <table className="premium-table">
                  <thead>
                    <tr>{["Darlehen", "Betrag", "Sollzins", "Anfängliche Tilgung", "Monatsrate", "Restschuld"].map(label => (
                      <th key={label} scope="col">{label}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {result.loans.filter(loan => loan.amount > 0).map((loan, index) => (
                      <tr key={index}>
                        <th scope="row">
                          {loan.name}
                          {loan.interestOnlyYears > 0 && <small> · Tilgung ab Jahr {loan.interestOnlyYears + 1}</small>}
                        </th>
                        <td>{formatCurrency(loan.amount)}</td>
                        <td>{formatNumber(loan.interestPercent)} %</td>
                        <td>{formatNumber(loan.repaymentPercent)} %</td>
                        <td>{formatCurrency(loan.monthlyDebtServiceYearOne)}</td>
                        <td>{formatCurrency(loan.remainingDebtAtExit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <dl className="premium-dossier-list">
                <div><dt>Gesamtrate im Cashflow (Jahr 1)</dt><dd>{formatCurrency(result.annualDebtService / 12)} / Monat</dd></div>
              </dl>
            </section>
          </div>

          <section className="premium-dossier-steps" aria-label="Ablauf der Premium-Analyse">
            <span>Premium-Ablauf</span>
            <ol>
              <li><b>1</b> Fakten aus Exposé</li>
              <li><b>2</b> Risiken und Unterlagen</li>
              <li><b>3</b> Tragfähigkeit und Szenarien</li>
              <li><b>4</b> Kauf- und Verhandlungsentscheidung</li>
            </ol>
          </section>
        </div>
      )}

      {activeModule === "financing" && (
        <div className="premium-analysis__content">
          <div className="premium-analysis__columns">
            <section className="premium-module-card">
              <div className="premium-module-card__heading">
                <div>
                  <span>02</span>
                  <h3>Finanzierungsannahmen</h3>
                </div>
              </div>
              <div className="premium-form-grid">
                <PremiumInput
                  id="premium-vacancy"
                  label="Leerstand"
                  value={form.vacancyPercent}
                  suffix="%"
                  max={100}
                  helper="Anteil der angesetzten Kaltmiete, der wegen leer stehender Einheiten entfällt."
                  onChange={(value) => updateField("vacancyPercent", value)}
                />
                <PremiumInput
                  id="premium-rent-default"
                  label="Mietausfall bei vermieteten Einheiten"
                  value={form.rentDefaultPercent}
                  suffix="%"
                  max={100}
                  helper="Nur Zahlungsausfälle auf die Miete nach Leerstandsabzug ansetzen. Bereits in der Kaltmiete berücksichtigte Verluste hier nicht erneut erfassen."
                  onChange={(value) => updateField("rentDefaultPercent", value)}
                />
                <PremiumInput
                  id="premium-equity"
                  label="Eingesetztes Eigenkapital"
                  value={form.equityAmount}
                  suffix="€"
                  step="1000"
                  onChange={(value) => updateField("equityAmount", value)}
                />
                <PremiumInput
                  id="premium-interest"
                  label="Sollzins Bankdarlehen"
                  value={form.interestPercent}
                  suffix="%"
                  max={30}
                  onChange={(value) => updateField("interestPercent", value)}
                />
                <PremiumInput
                  id="premium-repayment"
                  label="Anfängliche Tilgung Bankdarlehen"
                  value={form.repaymentPercent}
                  suffix="%"
                  max={30}
                  onChange={(value) => updateField("repaymentPercent", value)}
                />
                <PremiumInput
                  id="premium-fixed-years"
                  label="Zinsbindung Bankdarlehen"
                  value={form.fixedInterestYears}
                  suffix="Jahre"
                  min={1}
                  max={50}
                  step="1"
                  onChange={(value) => updateField("fixedInterestYears", value)}
                />
                <PremiumInput
                  id="premium-interest-only"
                  label="Tilgungsfreie Anlaufjahre Bankdarlehen"
                  value={form.interestOnlyYears}
                  suffix="Jahre"
                  max={50}
                  step="1"
                  helper="In den Anlaufjahren fallen nur Zinsen an. Reguläre Tilgung und Sondertilgung beginnen anschließend."
                  onChange={(value) => updateField("interestOnlyYears", value)}
                />
                <PremiumInput
                  id="premium-follow-up"
                  label="Anschlusszins Bankdarlehen"
                  value={form.followUpInterestPercent}
                  suffix="%"
                  max={30}
                  onChange={(value) => updateField("followUpInterestPercent", value)}
                />
                <PremiumInput
                  id="premium-special-repayment"
                  label="Sondertilgung Bankdarlehen pro Jahr"
                  value={form.specialRepaymentAnnual}
                  suffix="€"
                  step="500"
                  onChange={(value) => updateField("specialRepaymentAnnual", value)}
                />
              </div>
              <h4>Darlehensbausteine</h4>
              <p>Weitere Darlehen decken einen Teil des Finanzierungsbedarfs. Das Bankdarlehen finanziert den Rest.</p>
              <p>Bankdarlehen: {formatCurrency(result.loans[0].amount)} · {formatCurrency(result.loans[0].initialMonthlyRate)} / Monat</p>
              {additionalLoans.map((loan, index) => (
                <fieldset key={index}>
                  <legend>Darlehen {index + 2}</legend>
                  <label htmlFor={`premium-loan-name-${index}`}>Bezeichnung</label>
                  <input id={`premium-loan-name-${index}`} value={loan.name} maxLength={80}
                    onChange={event => updateLoans(additionalLoans.map((entry, i) => i === index ? { ...entry, name: event.target.value } : entry))} />
                  <div className="premium-form-grid">
                    {([
                      ["amount", "Darlehensbetrag", "€", 0, undefined, "1000"],
                      ["interestPercent", "Sollzins", "%", 0, 30, "0.01"],
                      ["repaymentPercent", "Anfängliche Tilgung", "%", 0, 30, "0.01"],
                      ["fixedInterestYears", "Zinsbindung", "Jahre", 1, 50, "1"],
                      ["interestOnlyYears", "Tilgungsfreie Anlaufjahre", "Jahre", 0, 50, "1"],
                      ["followUpInterestPercent", "Anschlusszins", "%", 0, 30, "0.01"],
                    ] as const).map(([field, label, suffix, min, max, step]) => (
                      <PremiumInput key={field} id={`premium-loan-${index}-${field}`}
                        label={label} suffix={suffix} min={min} max={max} step={step} value={String(loan[field] ?? 0)}
                        onChange={value => updateLoans(additionalLoans.map((entry, i) =>
                          i === index ? { ...entry, [field]: parseInput(value) } : entry
                        ))}
                      />
                    ))}
                  </div>
                  <p>Angesetzt: {formatCurrency(result.loans[index + 1].amount)} · {formatCurrency(result.loans[index + 1].initialMonthlyRate)} / Monat</p>
                  {loan.amount > result.loans[index + 1].amount && <p role="status">Der Betrag wurde in der Rechnung auf den verbleibenden Finanzierungsbedarf begrenzt.</p>}
                  <button type="button" className="premium-secondary-action"
                    onClick={() => updateLoans(additionalLoans.filter((_, i) => i !== index))}>
                    Darlehen {index + 2} entfernen
                  </button>
                </fieldset>
              ))}
              <button type="button" className="premium-secondary-action" disabled={additionalLoans.length >= 10}
                onClick={() => updateLoans([...additionalLoans, {
                  name: "Förderdarlehen", amount: 0, interestPercent: 0, repaymentPercent: 0,
                  fixedInterestYears: 10, interestOnlyYears: 0, followUpInterestPercent: parseInput(form.followUpInterestPercent),
                }])}>
                Darlehen hinzufügen
              </button>
            </section>

            <section className="premium-module-card">
              <div className="premium-module-card__heading">
                <div>
                  <span>Finanzierung</span>
                  <h3>Tragfähigkeit</h3>
                </div>
              </div>
              <dl className="premium-breakdown">
                <div>
                  <dt>Darlehensbetrag</dt>
                  <dd>{formatCurrency(result.loanAmount)}</dd>
                </div>
                <div>
                  <dt>Beleihungsauslauf</dt>
                  <dd>{formatNumber(result.loanToValuePercent)} %</dd>
                </div>
                <div>
                  <dt>Alle Darlehensraten inkl. Sondertilgung / Monat (Jahr 1)</dt>
                  <dd>{formatCurrency(result.annualDebtService / 12)}</dd>
                </div>
                <div>
                  <dt>Schuldendienst Jahr 1</dt>
                  <dd>{formatCurrency(result.annualDebtService)}</dd>
                </div>
                <div>
                  <dt>DSCR Jahr 1</dt>
                  <dd>{formatNumber(result.dscr)}</dd>
                </div>
                <div className="premium-breakdown__total">
                  <dt>Restschuld nach {result.input.forecastYears} Jahren</dt>
                  <dd>{formatCurrency(result.remainingDebtAtExit)}</dd>
                </div>
              </dl>
              {result.loanToValuePercent > 100 && (
                <p className="premium-analysis__warning">
                  Die Finanzierung übersteigt den Kaufpreis. Das erhöht Risiko und
                  Eigenkapitalanforderungen der Bank.
                </p>
              )}
            </section>
          </div>

          <div className="premium-table-wrap">
            <table className="premium-table">
              <caption>Tilgungsverlauf über den gewählten Prognosezeitraum</caption>
              <thead>
                <tr>
                  <th scope="col">Jahr</th>
                  <th scope="col">Zins</th>
                  <th scope="col">Tilgung</th>
                  <th scope="col">Cashflow</th>
                  <th scope="col">Restschuld</th>
                </tr>
              </thead>
              <tbody>
                {result.projection.map((year) => (
                  <tr key={year.year}>
                    <th scope="row">{year.year}</th>
                    <td>{formatCurrency(year.interest)}</td>
                    <td>{formatCurrency(year.repayment)}</td>
                    <td className={year.cashFlow >= 0 ? "positive" : "negative"}>
                      {formatCurrency(year.cashFlow)}
                    </td>
                    <td>{formatCurrency(year.remainingDebt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeModule === "funding" && (
        <div className="premium-analysis__content">
          <section className="premium-funding-hero">
            <div>
              <span>OFFIZIELLER MARKT- UND FÖRDERCHECK</span>
              <h3>Zins, Förderfähigkeit und Bankvergleich getrennt prüfen</h3>
              <p>
                Die Referenz wird direkt aus der Bundesbank-Statistik aktualisiert. Sie ist ein Marktdurchschnitt,
                kein persönliches Darlehensangebot. Förderwege zeigen nur eine potenzielle Passung und keine Zusage.
              </p>
            </div>
            <button type="button" className="premium-analysis__secondary" onClick={() => setFinancingResearchRefresh((value) => value + 1)}>
              Zinscheck aktualisieren
            </button>
          </section>

          <div className="premium-funding-rate-grid">
            <article>
              <span>Hinterlegter Sollzins</span>
              <strong>{formatNumber(investmentInput.interestPercent)} %</strong>
              <small>für deine aktuelle Kalkulation</small>
            </article>
            <article>
              <span>Öffentlicher Referenzzins</span>
              <strong>
                {financingResearchState === "loading"
                  ? "wird geladen"
                  : financingResearch?.benchmark.valuePercent != null
                    ? `${formatNumber(financingResearch.benchmark.valuePercent)} %`
                    : "nicht abrufbar"}
              </strong>
              <small>
                {financingResearch?.benchmark.period
                  ? `Neugeschäft, Zinsbindung über 10 Jahre · ${financingResearch.benchmark.period}`
                  : "Bundesbank-Referenz, kein verbindliches Angebot"}
              </small>
            </article>
            <article>
              <span>Bankrate in deiner Rechnung</span>
              <strong>{formatCurrency(result.annualDebtService / 12)}</strong>
              <small>Zins und anfängliche Tilgung pro Monat</small>
            </article>
          </div>

          <div className="premium-analysis__columns premium-analysis__columns--funding">
            <section className="premium-module-card">
              <div className="premium-module-card__heading">
                <div>
                  <span>Förderprofil</span>
                  <h3>Nur Kriterien angeben, die wirklich feststehen</h3>
                </div>
              </div>
              <div className="premium-form-grid">
                <PremiumSelect
                  id="premium-financing-use"
                  label="Geplante Nutzung"
                  value={fundingProfile.financingUse}
                  options={[
                    { value: "unknown", label: "Noch offen" },
                    { value: "owner-occupied", label: "Eigennutzung" },
                    { value: "investment", label: "Kapitalanlage" },
                  ]}
                  onChange={(financingUse) => setFundingProfile((current) => ({ ...current, financingUse }))}
                />
                <PremiumSelect
                  id="premium-household-profile"
                  label="Haushalt für Familienförderung"
                  value={fundingProfile.householdProfile}
                  options={[
                    { value: "unknown", label: "Noch offen" },
                    { value: "family-with-children", label: "Familie mit Kindern" },
                    { value: "not-applicable", label: "Nicht zutreffend" },
                  ]}
                  onChange={(householdProfile) => setFundingProfile((current) => ({ ...current, householdProfile }))}
                />
                <PremiumSelect
                  id="premium-energy-plan"
                  label="Energetischer Plan"
                  value={fundingProfile.energyPlan}
                  options={[
                    { value: "unknown", label: "Noch offen" },
                    { value: "none", label: "Keine Effizienzhaus-Sanierung geplant" },
                    { value: "efficiency-house", label: "Effizienzhaus-Sanierung geplant" },
                  ]}
                  onChange={(energyPlan) => setFundingProfile((current) => ({ ...current, energyPlan }))}
                />
                <div className="premium-field">
                  <label htmlFor="premium-residence-location">Eigener Wohnort / PLZ</label>
                  <div className="premium-field__control premium-field__control--select">
                    <input
                      id="premium-residence-location"
                      type="text"
                      value={fundingProfile.residenceLocation}
                      placeholder="optional für dritte Bankanfrage"
                      maxLength={120}
                      onChange={(event) => {
                        residenceLocationRef.current = event.target.value;
                        setFundingProfile((current) => ({ ...current, residenceLocation: event.target.value }));
                      }}
                    />
                  </div>
                  <small>Die Ortsangabe wird nur für die Empfehlung in diesem Check verwendet.</small>
                </div>
              </div>
              <p className="premium-module-card__disclaimer">
                Besonders wichtig: KfW- und Landesförderungen müssen in der Regel vor Kaufvertragsabschluss oder Maßnahmenbeginn über den Finanzierungspartner bzw. die zuständige Stelle beantragt werden.
              </p>
            </section>

            <section className="premium-module-card">
              <div className="premium-module-card__heading">
                <div>
                  <span>Offene Förderkriterien</span>
                  <h3>Diese Nachweise zuerst beschaffen</h3>
                </div>
              </div>
              <ol className="premium-funding-open-criteria">
                {(financingResearch?.openCriteria ?? [
                  "Fördercheck wird geladen.",
                  "Eigennutzung oder Kapitalanlage festlegen.",
                  "Energieausweis und Sanierungsziel belegen.",
                ]).map((criterion, index) => (
                  <li key={criterion}><span>{index + 1}</span>{criterion}</li>
                ))}
              </ol>
              {financingResearchState === "error" && (
                <p className="premium-analysis__warning">Der öffentliche Zinswert konnte gerade nicht abgerufen werden. Mit „Zinscheck aktualisieren“ erneut versuchen.</p>
              )}
            </section>
          </div>

          <section className="premium-funding-section" aria-labelledby="premium-programs-title">
            <div className="premium-funding-section__heading">
              <span>Förderwege</span>
              <h3 id="premium-programs-title">Potenziell passende Programme</h3>
              <p>Die Einstufung ist ein Vorcheck. Der endgültige Förderentscheid kommt ausschließlich von Förderstelle und Finanzierungspartner.</p>
            </div>
            <div className="premium-funding-programs">
              {(financingResearch?.programs ?? []).map((program) => (
                <article key={program.name} className={`premium-funding-program premium-funding-program--${program.fit}`}>
                  <div>
                    <span>{program.provider}</span>
                    <h4>{program.name}</h4>
                  </div>
                  <p>{program.summary}</p>
                  <ul>
                    {program.openCriteria.slice(0, 3).map((criterion) => <li key={criterion}>{criterion}</li>)}
                  </ul>
                  <a href={program.sourceUrl} target="_blank" rel="noreferrer">Offizielle Konditionen prüfen</a>
                </article>
              ))}
            </div>
          </section>

          <section className="premium-funding-section" aria-labelledby="premium-bank-routes-title">
            <div className="premium-funding-section__heading">
              <span>Bankvergleich</span>
              <h3 id="premium-bank-routes-title">Drei Anfragen, eine vergleichbare Vorgabe</h3>
              <p>Vergleiche nicht nur den Zinssatz, sondern auch Tilgung, Zinsbindung, Sondertilgung, Bereitstellungszinsen, Kosten und Fördermittel-Einbindung.</p>
            </div>
            <div className="premium-bank-routes">
              {(financingResearch?.bankRecommendations ?? []).map((recommendation, index) => (
                <article key={recommendation.title}>
                  <span>{index + 1}</span>
                  <div>
                    <h4>{recommendation.title}</h4>
                    <p>{recommendation.description}</p>
                    <a href={recommendation.sourceUrl} target="_blank" rel="noreferrer">Zur offiziellen Anlaufstelle</a>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {financingResearch && (
            <p className="premium-funding-footnote">
              Datencheck: {new Date(financingResearch.checkedAt).toLocaleString("de-DE")}. {financingResearch.benchmark.note}
            </p>
          )}
        </div>
      )}

      {activeModule === "forecast" && (
        <div className="premium-analysis__content">
          <div className="premium-analysis__columns">
            <section className="premium-module-card">
              <div className="premium-module-card__heading">
                <div>
                  <span>03</span>
                  <h3>Investition und Entwicklung</h3>
                </div>
              </div>
              <div className="premium-form-grid">
                <PremiumInput
                  id="premium-renovation"
                  label="Sanierung / Modernisierung"
                  value={form.renovationCosts}
                  suffix="€"
                  step="1000"
                  onChange={(value) => updateField("renovationCosts", value)}
                />
                <PremiumInput
                  id="premium-other-costs"
                  label="Sonstige Anfangskosten"
                  value={form.otherInitialCosts}
                  suffix="€"
                  step="1000"
                  onChange={(value) => updateField("otherInitialCosts", value)}
                />
                <PremiumInput
                  id="premium-buffer"
                  label="Kostenpuffer"
                  value={form.costBufferPercent}
                  suffix="%"
                  max={100}
                  onChange={(value) => updateField("costBufferPercent", value)}
                />
                <PremiumInput
                  id="premium-rent-growth"
                  label="Mietsteigerung"
                  value={form.rentGrowthPercent}
                  suffix="% p.a."
                  min={-20}
                  max={50}
                  onChange={(value) => updateField("rentGrowthPercent", value)}
                />
                <PremiumInput
                  id="premium-cost-growth"
                  label="Kostensteigerung"
                  value={form.costGrowthPercent}
                  suffix="% p.a."
                  min={-20}
                  max={50}
                  onChange={(value) => updateField("costGrowthPercent", value)}
                />
                <PremiumInput
                  id="premium-value-growth"
                  label="Wertentwicklung"
                  value={form.valueGrowthPercent}
                  suffix="% p.a."
                  min={-20}
                  max={50}
                  onChange={(value) => updateField("valueGrowthPercent", value)}
                />
                <PremiumInput
                  id="premium-exit-cost"
                  label="Verkaufskosten"
                  value={form.exitCostPercent}
                  suffix="%"
                  max={30}
                  onChange={(value) => updateField("exitCostPercent", value)}
                />
                <PremiumInput
                  id="premium-years"
                  label="Prognosezeitraum"
                  value={form.forecastYears}
                  suffix="Jahre"
                  min={1}
                  max={30}
                  step="1"
                  onChange={(value) => updateField("forecastYears", value)}
                />
              </div>
            </section>

            <section className="premium-module-card">
              <div className="premium-module-card__heading">
                <div>
                  <span>Exit</span>
                  <h3>Ergebnis nach {result.input.forecastYears} Jahren</h3>
                </div>
              </div>
              <dl className="premium-breakdown">
                <div>
                  <dt>Prognostizierter Objektwert</dt>
                  <dd>{formatCurrency(result.salePrice)}</dd>
                </div>
                <div>
                  <dt>Verkaufskosten</dt>
                  <dd>-{formatCurrency(result.saleCosts)}</dd>
                </div>
                <div>
                  <dt>Restschuld</dt>
                  <dd>-{formatCurrency(result.remainingDebtAtExit)}</dd>
                </div>
                <div>
                  <dt>Kumulierter Cashflow</dt>
                  <dd>{formatCurrency(result.cumulativeCashFlow)}</dd>
                </div>
                <div className="premium-breakdown__total">
                  <dt>Gesamtgewinn</dt>
                  <dd>{formatCurrency(result.totalProfit)}</dd>
                </div>
                <div>
                  <dt>Eigenkapital-Multiplikator</dt>
                  <dd>{formatNumber(result.equityMultiple)}x</dd>
                </div>
                <div>
                  <dt>Modellierter IRR</dt>
                  <dd>{formatNumber(result.irrPercent)} %</dd>
                </div>
              </dl>
              <p className="premium-module-card__disclaimer">
                Modellrechnung vor Steuern. Wertentwicklung und Verkaufserlös sind
                Annahmen, keine Prognose oder Anlageberatung.
              </p>
            </section>
          </div>
        </div>
      )}

      {activeModule === "scenarios" && (
        <div className="premium-analysis__content">
          <div className="premium-module-card premium-module-card--wide">
            <div className="premium-module-card__heading">
              <div>
                <span>04</span>
                <h3>Szenariovergleich</h3>
              </div>
            </div>
            <p className="premium-module-card__lead">
              Die Szenarien verändern Leerstand, Miet- und Kostenentwicklung,
              Anschlusszins sowie Wertentwicklung nachvollziehbar um das Basismodell.
            </p>
            <div className="premium-scenarios">
              {result.scenarios.map((scenario) => (
                <article
                  key={scenario.id}
                  className={`premium-scenario premium-scenario--${scenario.id}`}
                >
                  <span>{scenario.label}</span>
                  <strong className={scenario.monthlyCashFlowYearOne >= 0 ? "positive" : "negative"}>
                    {formatCurrency(scenario.monthlyCashFlowYearOne)}
                  </strong>
                  <small>Cashflow / Monat im ersten Jahr</small>
                  <dl>
                    <div>
                      <dt>DSCR</dt>
                      <dd>{formatNumber(scenario.dscrYearOne)}</dd>
                    </div>
                    <div>
                      <dt>Restschuld Exit</dt>
                      <dd>{formatCurrency(scenario.remainingDebtAtExit)}</dd>
                    </div>
                    <div>
                      <dt>Eigenkapital im Objekt</dt>
                      <dd>{formatCurrency(scenario.equityAtExit)}</dd>
                    </div>
                    <div>
                      <dt>Gesamtgewinn</dt>
                      <dd>{formatCurrency(scenario.totalProfit)}</dd>
                    </div>
                    <div>
                      <dt>IRR</dt>
                      <dd>{formatNumber(scenario.irrPercent)} %</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      <PremiumAdvisorChat
        key={`${chatContext.object.name}|${chatContext.object.purchasePrice}|${chatContext.object.livingArea}`}
        context={chatContext}
        hidden={activeModule !== "chat"}
      />
    </section>
  );
}
