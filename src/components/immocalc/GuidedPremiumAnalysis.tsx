"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import type { PremiumChatContext } from "@/lib/premiumChat";
import { PREMIUM_ANALYSIS_STEPS } from "@/lib/premiumAnalysisPrompts";
import {
  analysisFingerprint,
  createAnalysisStep,
  createAnalysisReport,
  renderAnalysisReportHtml,
} from "@/lib/premiumAnalysis";

type Progress = {
  fingerprint: string;
  step: number;
  notes: string[];
  results: string[];
  confirmed: boolean[];
};
const blank = (fingerprint: string): Progress => ({
  fingerprint,
  step: 0,
  notes: Array(6).fill(""),
  results: Array(6).fill(""),
  confirmed: Array(6).fill(false),
});
const hints = [
  "Adresse, Objektart, Nutzung, Ist-Miete, Hausgeld, Rücklagen, Energieausweis und bekannte Modernisierungen. Zahlen bitte im Rechner ergänzen.",
  "Vergleichsangebote, Mietspiegel, Bodenrichtwert: jeweils Quelle / Link, Stichtag und Vergleichbarkeit nennen. Ohne Nachweise bleibt die Marktbewertung offen.",
  "Kostenaufteilung, Hausgeld und Rücklagen abgleichen. Zusätzliche Zahlen hier werden nicht automatisch in den Rechner übernommen.",
  "Befunde, Kostenvoranschläge, WEG-Protokolle und Mietverträge. Gewünschte Mindestrendite und Angebotsgrenze ergänzen und belegen.",
  "Bestätigter Angebotsbetrag, belegte Vorteile, Verhandlungsargumente und Vorbehalte. Kein automatischer Versand an Verkäufer.",
  "Schlussbemerkungen und verbleibende Prüfaufträge. Der Bericht ist auch mit offenen Punkten ausdrücklich nur eine Vorprüfung.",
];
export function AnalysisText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
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
      blocks.push(
        <div className="guided-analysis__table" key={i}>
          <table>
            <thead>
              <tr>
                {rows[0]?.map((x, j) => (
                  <th key={j}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(1).map((r, j) => (
                <tr key={j}>
                  {r.map((x, k) => (
                    <td key={k}>{x}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (line.startsWith("## "))
      blocks.push(<h4 key={i}>{line.slice(3)}</h4>);
    else if (line.startsWith("# "))
      blocks.push(<h3 key={i}>{line.slice(2)}</h3>);
    else if (line.trim())
      blocks.push(
        <p key={i}>
          {line
            .split(/(\*\*.*?\*\*)/)
            .map((x, j) =>
              x.startsWith("**") ? (
                <strong key={j}>{x.slice(2, -2)}</strong>
              ) : (
                x
              ),
            )}
        </p>,
      );
  }
  return <>{blocks}</>;
}
export function GuidedPremiumAnalysis({
  context,
  onStepChange,
  onEvidenceChange,
}: {
  context: PremiumChatContext;
  onStepChange: (step: number) => void;
  onEvidenceChange: (text: string) => void;
}) {
  const { user } = useAuth();
  const fingerprint = analysisFingerprint(context);
  const key = `immocalc:guided-analysis:v1:${user?.id ?? "anonymous"}:${encodeURIComponent(context.object.name)}`;
  const [state, setState] = useState<Progress>(() => blank(fingerprint));
  const [loadedKey, setLoadedKey] = useState("");
  const ready = loadedKey === key;
  const [storageWarning, setStorageWarning] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = JSON.parse(localStorage.getItem(key) ?? "null");
        if (
          raw &&
          typeof raw.fingerprint === "string" &&
          Number.isInteger(raw.step) &&
          raw.step >= 0 &&
          raw.step < 6 &&
          ["notes", "results"].every(
            (k) =>
              Array.isArray(raw[k]) &&
              raw[k].length === 6 &&
              raw[k].every((x: unknown) => typeof x === "string"),
          ) &&
          Array.isArray(raw.confirmed) &&
          raw.confirmed.length === 6 &&
          raw.confirmed.every((x: unknown) => typeof x === "boolean")
        )
          setState(raw);
        else setState(blank(fingerprint));
      } catch {
        setState(blank(fingerprint));
      }
      setLoadedKey(key);
    });
    return () => cancelAnimationFrame(frame);
  }, [key, fingerprint]); // Context changes are detected as stale, not silently overwritten.
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(state));
      } catch {
        requestAnimationFrame(() => setStorageWarning(true));
      }
  }, [key, ready, state]);
  useEffect(
    () =>
      onEvidenceChange(
        state.notes.map((n, i) => `Schritt ${i + 1}: ${n}\n${state.confirmed[i] ? state.results[i] : "Ergebnis noch nicht bestätigt."}`).join("\n"),
      ),
    [state.notes, state.results, state.confirmed, onEvidenceChange],
  );
  useEffect(() => onStepChange(state.step + 1), [state.step, onStepChange]);
  const current = state.step;
  const stale = state.fingerprint !== fingerprint;
  const result = createAnalysisStep(current + 1, context, state.notes[current]);
  const updateNotes = (value: string) =>
    setState((s) => ({
      ...s,
      notes: s.notes.map((n, i) => (i === current ? value : n)),
      results: s.results.map((r, i) => (i >= current ? "" : r)),
      confirmed: s.confirmed.map((b, i) => (i >= current ? false : b)),
    }));
  const generate = () =>
    setState((s) => ({
      ...s,
      results: s.results.map((r, i) =>
        i > current
          ? ""
          : i === current
            ? current === 5
              ? createAnalysisReport(context, [...s.results.slice(0, 5), createAnalysisStep(6, context, s.notes[5]).text])
                    : result.text
            : r,
      ),
      confirmed: s.confirmed.map((b, i) => (i >= current ? false : b)),
    }));
  const confirm = () =>
    setState((s) => ({
      ...s,
      confirmed: s.confirmed.map((b, i) => (i === current ? true : b)),
      step: Math.min(5, current + 1),
    }));
  const exportReport = () => {
    const report = state.results[5];
    if (!report) return;
    const html = renderAnalysisReportHtml(report);
    const url = URL.createObjectURL(
      new Blob([html], { type: "text/html;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "ImmoCalc-Gesamtbericht.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section
      id="guided-premium-analysis"
      className="guided-analysis"
      aria-label="Geführte Immobilienbewertung in sechs Schritten"
    >
      <h3>Immobilie Schritt für Schritt bewerten</h3>
      <p>
        Sechs Schritte nach deiner Claude-Vorlage. Ergebnisse prüfen, Rückfragen
        ergänzen und erst dann fortfahren. Die strukturierte Vorprüfung
        funktioniert auch ohne KI-Freischaltung.
      </p>
      <button type="button" className="premium-analysis__secondary" onClick={() => { if (window.confirm("Den lokalen Analysefortschritt neu beginnen? Sichere bei Bedarf zuerst den Gesamtbericht.")) setState(blank(fingerprint)); }}>Neue Analyse beginnen</button>
      <ol className="guided-analysis__steps">
        {PREMIUM_ANALYSIS_STEPS.map((step, i) => (
          <li key={step.id}>
            <button
              type="button"
              aria-current={i === current ? "step" : undefined}
              disabled={!ready || stale || (i > 0 && !state.confirmed[i - 1])}
              onClick={() => setState((s) => ({ ...s, step: i }))}
            >
              {step.id}. {step.title}
              <small>
                {state.confirmed[i]
                  ? "Geprüft / offene Punkte dokumentiert"
                  : i === current
                    ? "In Bearbeitung"
                    : "Noch offen"}
              </small>
            </button>
          </li>
        ))}
      </ol>
      {stale && (
        <div role="alert">
          Die Objektdaten oder Rechenannahmen wurden geändert. Frühere
          Ergebnisse müssen neu geprüft werden.{" "}
          <button
            type="button"
            onClick={() =>
              setState((s) => ({ ...blank(fingerprint), notes: s.notes }))
            }
          >
            Mit aktuellen Daten neu starten
          </button>
        </div>
      )}
      {storageWarning && (
        <p role="status">
          Der Browser kann den Fortschritt nicht speichern. Bitte den Bericht
          vor dem Schließen sichern.
        </p>
      )}
      <details>
        <summary>Original-Prompt für Schritt {current + 1} ansehen</summary>
        <pre>{PREMIUM_ANALYSIS_STEPS[current].prompt}</pre>
      </details>
      <label htmlFor="guided-analysis-notes">
        Angaben, Quellen und offene Fragen zu Schritt {current + 1}
      </label>
      <p id="guided-analysis-hint">{hints[current]}</p>
      <textarea
        id="guided-analysis-notes"
        aria-describedby="guided-analysis-hint"
        value={state.notes[current]}
        maxLength={12000}
        rows={4}
        disabled={!ready || stale}
        onChange={(e) => updateNotes(e.target.value)}
      />
      <p>
        Notizen sind ungeprüfte Nutzerangaben. Rechenwerte bitte in den
        entsprechenden Eingabefeldern ändern; eine Notiz verändert keine
        Rechnung.
      </p>
      <button
        type="button"
        className="premium-analysis__secondary"
        disabled={!ready || stale}
        onClick={generate}
      >
        {current === 5
          ? "Gesamtbericht erstellen"
          : "Schritt auswerten / Rückfragen anzeigen"}
      </button>
      {state.results[current] && (
        <div className="guided-analysis__result" aria-live="polite">
          <AnalysisText text={state.results[current]} />
        </div>
      )}
      {state.results[current] && !stale && (
        <div className="guided-analysis__actions">
          <button
            type="button"
            className="premium-analysis__primary"
            onClick={confirm}
          >
            {current === 5
              ? "Bericht geprüft"
              : result.missing.length
                ? "Mit dokumentierten offenen Punkten bestätigen"
                : "Ergebnis geprüft – weiter"}
          </button>
          {current === 5 && (
            <button type="button" onClick={exportReport}>
              Druckfertigen Gesamtbericht herunterladen
            </button>
          )}
        </div>
      )}
    </section>
  );
}
