"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { ExposeUpload } from "@/components/immocalc/ExposeUpload";
import { criticalQuestions, reviewExpose, type ExposeImport, type ImportReview } from "@/domain/immocalc/expose";
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
  const {user}=useAuth();
  const [expose,setExpose]=useState<ExposeImport|null>(null);
  const [review,setReview]=useState<ImportReview|null>(null);
  const [occupancy,setOccupancy]=useState("");
  const [resolved,setResolved]=useState<string[]>([]);
  const [confirmed,setConfirmed]=useState(false);
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    if(!user)return;
    try{
      const raw=localStorage.getItem("immocalc_expose_"+user.id);
      if(raw){
        const saved=JSON.parse(raw) as {form:ValuationInput;expose:ExposeImport;occupancy:string;resolved:string[]};
        if(saved.expose?.pages && saved.form){
          setForm(saved.form);setExpose(saved.expose);setReview(reviewExpose(saved.expose));
          setOccupancy(saved.occupancy||"");setResolved(saved.resolved||[]);
        }
      }
    }catch{/* Alte oder ungültige Daten ignorieren. */}
    setLoaded(true);
  },[user]);
  useEffect(()=>{
    if(!user||!loaded||!expose)return;
    try{localStorage.setItem("immocalc_expose_"+user.id,JSON.stringify({form,expose,occupancy,resolved}));}
    catch{/* Speichern im Browser ist nicht immer verfügbar. */}
  },[user,loaded,form,expose,occupancy,resolved]);
  const remainingReview=review?{...review,conflicts:review.conflicts.filter(c=>!resolved.includes(c.key))}:null;
  const questions=criticalQuestions(form,remainingReview,occupancy);
  const canAnalyze=confirmed&&questions.length===0;
  const result=useMemo(()=>canAnalyze?evaluateProperty(form):null,[form,canAnalyze]);
  const update=<K extends keyof ValuationInput>(field:K,value:ValuationInput[K])=>{
    setForm(old=>({...old,[field]:value}));
    if(["address","area","year","askingPrice","annualRent"].includes(field))setConfirmed(false);
  };
  const onExposeComplete=(doc:ExposeImport,report:ImportReview)=>{
    setExpose(doc);setReview(report);setResolved([]);setConfirmed(false);
    setForm(old=>({...old,...report.updates}));
    const item=report.findings.find(f=>f.key==="occupancy");
    const v=item?.value.toLowerCase()||"";
    setOccupancy(v.includes("vermietet")?"vermietet":v.includes("leer")?"leer":v.includes("eigen")?"eigengenutzt":"");
  };
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
    .valuation-btn:disabled{opacity:.4;cursor:not-allowed}.valuation-btn{border:0;border-radius:12px;padding:12px 17px;color:white;background:var(--accent-color);font-weight:700;cursor:pointer}
    .valuation-print-head{display:none}
    @media(max-width:760px){.valuation-columns{grid-template-columns:1fr}.valuation-grid{grid-template-columns:1fr 1fr}}
    @media print{body{background:white!important}.valuation-page{max-width:none;padding:0;color:#152638}.valuation-page .valuation-inputs,.valuation-page .valuation-header button,.valuation-page .valuation-header a{display:none!important}.valuation-columns{display:block}.valuation-page .valuation-card{break-inside:avoid;border:1px solid #d7dde4;background:white}.valuation-number{background:#f1f4f6!important}.valuation-muted{color:#526070}.valuation-print-head{display:block}.valuation-page .valuation-header{margin-bottom:12px}}
    `}</style>
    <header className="valuation-header">
      <div><p className="valuation-muted">ImmoCalc · Neue Funktion</p><h1>Immobilie bewerten</h1><p className="valuation-muted">Prüfe Kaufpreis, Vergleichsangebote und monatliche Kosten – Schritt für Schritt.</p></div>
      <div style={{display:"flex",gap:12,alignItems:"center"}}><Link href="/">Zum Rechner</Link><button type="button" className="valuation-btn" disabled={!canAnalyze} onClick={()=>window.print()}>Bericht als PDF</button></div>
    </header>
    <ExposeUpload loaded={expose} review={review} onComplete={onExposeComplete}/>
    <div className="valuation-columns">
      <section className="valuation-inputs">
        <div className="valuation-card"><h2>2. Die Immobilie</h2><div className="valuation-grid">
          <label className="valuation-field" style={{gridColumn:"1/-1"}}><span>Adresse der Immobilie</span><input value={form.address} placeholder="Straße, Hausnummer, PLZ, Ort" onChange={e=>update("address",e.target.value)} /></label>
          <label className="valuation-field"><span>Immobilientyp</span><select value={form.type} onChange={e=>update("type",e.target.value)}><option>Mehrfamilienhaus</option><option>Eigentumswohnung</option><option>Einfamilienhaus</option></select></label>
          {numberField("Baujahr","year")}{numberField("Wohnfläche in m²","area")}{numberField("Angebotspreis in €","askingPrice")}{numberField("Kaltmiete pro Jahr in €","annualRent")}
          </div>
          <label className="valuation-field" style={{marginTop:15}}><span>Wie wird die Immobilie zurzeit genutzt?</span>
            <select value={occupancy} onChange={e=>{setOccupancy(e.target.value);setConfirmed(false);}}>
              <option value="">Bitte auswählen</option><option value="vermietet">Vermietet</option>
              <option value="leer">Leer stehend</option><option value="eigengenutzt">Selbst genutzt</option>
            </select>
          </label>
          <p className="valuation-muted">Bei vermieteten Objekten zählt die aktuelle Kaltmiete, sonst eine geplante Miete. Bitte nicht vermischen.</p>
          {review?.conflicts.map(c=><div key={c.key} className="valuation-notice">
            <strong>Widersprüchliche Angabe: {c.label}</strong><p>{c.values.join(" / ")}</p>
            <label><input type="checkbox" checked={resolved.includes(c.key)} onChange={e=>{setResolved(old=>e.target.checked?[...old,c.key]:old.filter(k=>k!==c.key));setConfirmed(false);}}/> Richtigen Wert oben geprüft und eingetragen</label>
          </div>)}
          </div>
        <div className="valuation-card"><h2>3. Ähnliche Immobilien</h2>
          <p className="valuation-muted">Trage mindestens drei vergleichbare Kaufangebote ein. Den Preis je m² findest du oft im Exposé. Die App erfindet keine Vergleichspreise.</p>
          {form.comparisonPricesPerSqm.map((price,i)=><div key={i} className="valuation-grid" style={{marginBottom:12}}>
            <label className="valuation-field"><span>Angebot {i+1}: Preis je m² in €</span><input type="number" min="0" value={price||""} onChange={e=>update("comparisonPricesPerSqm",form.comparisonPricesPerSqm.map((v,j)=>i===j?moneyInput(e.target.value):v))}/></label>
            <label className="valuation-field"><span>Quelle / Link</span><input value={form.comparisonSources[i]||""} placeholder="Link oder Quelle" onChange={e=>update("comparisonSources",form.comparisonSources.map((v,j)=>i===j?e.target.value:v))}/></label>
          </div>)}
          <button type="button" onClick={()=>{update("comparisonPricesPerSqm",[...form.comparisonPricesPerSqm,0]);update("comparisonSources",[...form.comparisonSources,""])}} style={{color:"var(--accent-color)",background:"none",border:0,cursor:"pointer"}}>+ Weiteres Angebot</button>
        </div>
        <div className="valuation-card"><h2>4. Finanzierung und Kosten</h2><p className="valuation-muted">Für den ersten Vergleich rechnen wir wie im bestehenden ImmoCalc: Kaufpreis voll finanziert, Kaufnebenkosten als Eigenkapital.</p>
          <div className="valuation-grid">
            <label className="valuation-field"><span>Bundesland</span><select value={form.federalState} onChange={e=>update("federalState",e.target.value as ValuationInput["federalState"])}>{["BW","BY","BE","BB","HB","HH","HE","MV","NI","NRW","RP","SL","SN","ST","SH","TH"].map(s=><option key={s}>{s}</option>)}</select></label>
            {numberField("Zins in %","interest")}{numberField("Tilgung in %","repayment")}{numberField("Notar und Grundbuch in %","notaryPercent")}{numberField("Maklerkosten in %","brokerPercent")}{numberField("Instandhaltung pro m² und Monat","maintenancePerSqmMonthly")}{numberField("Verwaltung pro Monat in €","managementMonthly")}{numberField("Rücklage pro Monat in €","reserveMonthly")}{numberField("Geplante Sanierung in €","renovationBudget")}
          </div>
        </div>
        <div className="valuation-card"><h2>5. Hinweise zum Objekt</h2><label className="valuation-field"><span>Bekannte Mängel, Modernisierungen und Besonderheiten</span><textarea value={form.remarks} onChange={e=>update("remarks",e.target.value)} placeholder="Zum Beispiel: Heizung 2020 erneuert, Dach noch nicht geprüft."/></label></div>
      </section>
      <section aria-live="polite">
        <div className="valuation-card">
          <h2>Offene Fragen klären</h2>
          <p className="valuation-muted">Die Premium-Bewertung beginnt erst, wenn die wichtigsten Daten geklärt und bestätigt sind.</p>
          {questions.map((q,i)=><div key={i} className="valuation-notice">{i+1}. {q}</div>)}
          {questions.length===0&&<p className="valuation-muted">Die Grundangaben sind vollständig. Bitte überprüfe sie vor der Berechnung.</p>}
          <label style={{display:"flex",gap:9,alignItems:"flex-start",marginTop:14,fontSize:".88rem"}}>
            <input type="checkbox" disabled={questions.length>0} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>
            <span>Ich habe die wichtigen Angaben geprüft und bestätige, dass sie für die erste Bewertung verwendet werden dürfen.</span>
          </label>
          {!canAnalyze&&<p className="valuation-muted">Ergebnisse und PDF bleiben bis zur Bestätigung gesperrt.</p>}
        </div>
        {result&&<div>
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
        </div>}
      </section>
    </div>
  </main>;
}
