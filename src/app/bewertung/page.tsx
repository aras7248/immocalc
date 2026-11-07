"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { evaluateProperty, type ValuationInput } from "@/domain/immocalc/valuation";

const currency = (v: number | null | undefined) => v == null ? "Noch offen" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const moneyInput = (n: string) => Number(n.replace(/\s/g,"").replace(",","."));
const initial: ValuationInput = {
  address: "", type: "Mehrfamilienhaus", area: 0, year: 0, askingPrice: 0,
  annualRent: 0, comparisonPricesPerSqm: [0,0,0], comparisonSources: ["","",""],
  federalState: "NRW", interest: 4, repayment: 1.5, maintenancePerSqmMonthly: 1,
  managementMonthly: 30, reserveMonthly: 50, notaryPercent: 2, brokerPercent: 3.57,
  renovationBudget: 0, remarks: "",
};

export default function BewertungPage() {
  const [form, setForm] = useState<ValuationInput>(initial);
  const result = useMemo(() => evaluateProperty(form), [form]);
  const update = <K extends keyof ValuationInput>(field: K, value: ValuationInput[K]) => setForm(old => ({...old,[field]:value}));
  const numberField = (name: string, key: keyof ValuationInput, hint?: string) => (
    <label className="valuation-field"><span>{name}</span>
      <input type="number" min="0" step="any" value={form[key] as number || ""} placeholder={hint || "0"}
        onChange={e => update(key, Number(e.target.value) as never)} />
    </label>
  );
  return <main className="valuation-page">
    <style>{`
    .valuation-page{max-width:1120px;margin:0 auto;padding:36px 20px 80px;color:var(--text-main);font-family:var(--font-inter),sans-serif}
    .valuation-page a{color:var(--accent-color)}.valuation-header{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:24px}
    .valuation-page h1{font-size:clamp(1.65rem,4vw,2.4rem);font-weight:800;margin:0}.valuation-page h2{font-size:1.17rem;margin:0 0 14px}
    .valuation-muted{color:var(--text-muted);line-height:1.6;font-size:.92rem}
    .valuation-columns{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(290px,.9fr);gap:18px;align-items:start}
    .valuation-card{border:1px solid var(--glass-border);background:var(--card-bg);border-radius:18px;padding:23px;margin-bottom:16px}
    .valuation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}
    .valuation-field{display:flex;flex-direction:column;gap:5px;font-size:.78rem;font-weight:650;color:var(--text-muted)}
    .valuation-field input,.valuation-field select,.valuation-field textarea{width:100%;min-height:43px;padding:10px;border:1px solid var(--input-optional-border);border-radius:10px;background:var(--input-optional-bg);color:var(--text-main);font:inherit;font-size:.96rem}
    .valuation-field textarea{min-height:90px}.valuation-numbers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .valuation-number{background:var(--bg-secondary);border-radius:12px;padding:13px}.valuation-number span{display:block;font-size:.72rem;color:var(--text-muted)}.valuation-number strong{display:block;font-size:1.35rem;overflow-wrap:anywhere;margin-top:6px}
    .valuation-notice{padding:12px;border:1px solid var(--glass-border);border-radius:12px;margin-top:10px;font-size:.83rem;line-height:1.5}
    .valuation-btn{border:0;border-radius:12px;padding:12px 17px;color:white;background:var(--accent-color);font-weight:700;cursor:pointer}
    .valuation-print-head{display:none}
    @media(max-width:760px){.valuation-columns{grid-template-columns:1fr}.valuation-grid{grid-template-columns:1fr 1fr}}
    @media print{body{background:white!important}.valuation-page{max-width:none;padding:0;color:#152638}.valuation-page .valuation-inputs,.valuation-page .valuation-header button,.valuation-page .valuation-header a{display:none!important}.valuation-columns{display:block}.valuation-page .valuation-card{break-inside:avoid;border:1px solid #d7dde4;background:white}.valuation-number{background:#f1f4f6!important}.valuation-muted{color:#526070}.valuation-print-head{display:block}.valuation-page .valuation-header{margin-bottom:12px}}
    `}</style>
    <header className="valuation-header">
      <div><p className="valuation-muted">ImmoCalc · Neue Funktion</p><h1>Immobilie bewerten</h1><p className="valuation-muted">Prüfe Kaufpreis, Vergleichsangebote und monatliche Kosten – Schritt für Schritt.</p></div>
      <div style={{display:"flex",gap:12,alignItems:"center"}}><Link href="/">Zum Rechner</Link><button type="button" className="valuation-btn" onClick={()=>window.print()}>Bericht als PDF</button></div>
    </header>
    <div className="valuation-columns">
      <section className="valuation-inputs">
        <div className="valuation-card"><h2>1. Die Immobilie</h2><div className="valuation-grid">
          <label className="valuation-field" style={{gridColumn:"1/-1"}}><span>Adresse der Immobilie</span><input value={form.address} placeholder="Straße, Hausnummer, PLZ, Ort" onChange={e=>update("address",e.target.value)} /></label>
          <label className="valuation-field"><span>Immobilientyp</span><select value={form.type} onChange={e=>update("type",e.target.value)}><option>Mehrfamilienhaus</option><option>Eigentumswohnung</option><option>Einfamilienhaus</option></select></label>
          {numberField("Baujahr","year")}{numberField("Wohnfläche in m²","area")}{numberField("Angebotspreis in €","askingPrice")}{numberField("Kaltmiete pro Jahr in €","annualRent")}
          </div></div>
        <div className="valuation-card"><h2>2. Ähnliche Immobilien</h2>
          <p className="valuation-muted">Trage mindestens drei vergleichbare Kaufangebote ein. Den Preis je m² findest du oft im Exposé. Die App erfindet keine Vergleichspreise.</p>
          {form.comparisonPricesPerSqm.map((price,i)=><div key={i} className="valuation-grid" style={{marginBottom:12}}>
            <label className="valuation-field"><span>Angebot {i+1}: Preis je m² in €</span><input type="number" min="0" value={price||""} onChange={e=>update("comparisonPricesPerSqm",form.comparisonPricesPerSqm.map((v,j)=>i===j?moneyInput(e.target.value):v))}/></label>
            <label className="valuation-field"><span>Quelle / Link</span><input value={form.comparisonSources[i]||""} placeholder="Link oder Quelle" onChange={e=>update("comparisonSources",form.comparisonSources.map((v,j)=>i===j?e.target.value:v))}/></label>
          </div>)}
          <button type="button" onClick={()=>{update("comparisonPricesPerSqm",[...form.comparisonPricesPerSqm,0]);update("comparisonSources",[...form.comparisonSources,""])}} style={{color:"var(--accent-color)",background:"none",border:0,cursor:"pointer"}}>+ Weiteres Angebot</button>
        </div>
        <div className="valuation-card"><h2>3. Finanzierung und Kosten</h2><p className="valuation-muted">Für den ersten Vergleich rechnen wir wie im bestehenden ImmoCalc: Kaufpreis voll finanziert, Kaufnebenkosten als Eigenkapital.</p>
          <div className="valuation-grid">
            <label className="valuation-field"><span>Bundesland</span><select value={form.federalState} onChange={e=>update("federalState",e.target.value as ValuationInput["federalState"])}>{["BW","BY","BE","BB","HB","HH","HE","MV","NI","NRW","RP","SL","SN","ST","SH","TH"].map(s=><option key={s}>{s}</option>)}</select></label>
            {numberField("Zins in %","interest")}{numberField("Tilgung in %","repayment")}{numberField("Notar und Grundbuch in %","notaryPercent")}{numberField("Maklerkosten in %","brokerPercent")}{numberField("Instandhaltung pro m² und Monat","maintenancePerSqmMonthly")}{numberField("Verwaltung pro Monat in €","managementMonthly")}{numberField("Rücklage pro Monat in €","reserveMonthly")}{numberField("Geplante Sanierung in €","renovationBudget")}
          </div>
        </div>
        <div className="valuation-card"><h2>4. Hinweise zum Objekt</h2><label className="valuation-field"><span>Bekannte Mängel, Modernisierungen und Besonderheiten</span><textarea value={form.remarks} onChange={e=>update("remarks",e.target.value)} placeholder="Zum Beispiel: Heizung 2020 erneuert, Dach noch nicht geprüft."/></label></div>
      </section>
      <section aria-live="polite">
        <div className="valuation-card"><h2>Ergebnis auf einen Blick</h2><p className="valuation-muted">Bewertung: {result.status}. Alle Werte sind unverbindliche Orientierungen.</p>
          <div className="valuation-numbers">
            <div className="valuation-number"><span>Angebotspreis</span><strong>{currency(form.askingPrice||null)}</strong></div>
            <div className="valuation-number"><span>Mitte der Vergleichsangebote</span><strong>{currency(result.comparisonRange?.middle)}</strong></div>
            <div className="valuation-number"><span>Preis bei 0 € monatlichem Cashflow</span><strong>{currency(result.investmentLimit)}</strong></div>
            <div className="valuation-number"><span>Cashflow pro Monat vor Steuern</span><strong>{currency(result.finance?.base.cashFlowMonthly)}</strong></div>
          </div>
          {result.comparisonRange&&<p className="valuation-muted">Die Vergleichsangebote ergeben eine Spanne von {currency(result.comparisonRange.low)} bis {currency(result.comparisonRange.high)}. Das ist noch kein geprüfter Marktwert.</p>}
          <p className="valuation-muted">Der Investment-Preis ist eine rechnerische Grenze bei den eingegebenen Mieten und Kosten. Sanierung wird hier einmalig als zusätzlicher Abschlag berücksichtigt.</p>
        </div>
        <div className="valuation-card"><h2>Was wurde geprüft?</h2>
          <p className="valuation-muted">Die Finanzrechnung nutzt die vorhandenen ImmoCalc-Formeln. Der Preisvergleich basiert ausschließlich auf deinen Angaben.</p>
          {result.warnings.map((w,i)=><div key={i} className="valuation-notice">{w}</div>)}
        </div>
        <div className="valuation-card"><h2>Für das Verkäufergespräch</h2>
          <p className="valuation-muted">Die eingetragenen Vergleichsangebote geben eine erste Orientierung. Für ein belastbares Angebot müssen Lage, Zustand, Ausstattung und mögliche Sanierungen genauer geprüft werden.</p>
          <p className="valuation-muted">Die aktuelle Finanzierung zeigt {result.finance? `einen monatlichen Cashflow von ${currency(result.finance.base.cashFlowMonthly)} vor Steuern`:"noch keinen verlässlichen Cashflow"}. Daraus allein lässt sich kein objektiver Marktwert ableiten.</p>
          {form.remarks&&<p className="valuation-muted"><strong>Hinweise zum Objekt:</strong> {form.remarks}</p>}
        </div>
      </section>
    </div>
  </main>;
}
