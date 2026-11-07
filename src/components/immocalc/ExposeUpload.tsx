"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { reviewExpose, type ExposeImport, type ImportReview } from "@/domain/immocalc/expose";

type Props={onComplete:(doc:ExposeImport,review:ImportReview)=>void;loaded:ExposeImport|null;review:ImportReview|null};
export function ExposeUpload({onComplete,loaded,review}:Props) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const upload=async(file:File)=>{
    setError("");setBusy(true);
    try {
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token) throw Error("Bitte melde dich erneut an.");
      const body=new FormData();body.append("file",file);
      const res=await fetch("/api/expose",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`},body});
      const json:unknown=await res.json();
      if(!res.ok) throw Error(typeof json==="object" && json!==null && "error" in json ? String(json.error) : "Die Datei konnte nicht gelesen werden.");
      const doc=json as ExposeImport;
      if(!Array.isArray(doc.pages)||!Number.isInteger(doc.pageCount)||doc.pageCount<1) throw Error("Die Antwort war unvollständig.");
      onComplete(doc,reviewExpose(doc));
    }catch(e){setError(e instanceof Error?e.message:"Die Datei konnte nicht verarbeitet werden.");}
    finally{setBusy(false);}
  };
  const readCount=loaded?.pages.filter(p=>p.status==="read").length||0;
  return <div className="valuation-card valuation-inputs">
    <h2>1. Exposé einlesen</h2>
    <p className="valuation-muted">Lade das Exposé hoch. Die KI prüft jede Seite einzeln und sammelt auch Angaben aus Tabellen, Fußnoten und Bildern. Danach siehst du alle erkannten Informationen und kannst sie kontrollieren.</p>
    <label className="valuation-field"><span>Exposé auswählen (PDF oder Bild, maximal 15 MB)</span>
      <input aria-label="Exposé hochladen" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*" disabled={busy}
        onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.currentTarget.value="";}}/>
    </label>
    {busy&&<p role="status" className="valuation-muted">Das Exposé wird Seite für Seite geprüft. Bitte die Seite geöffnet lassen.</p>}
    {error&&<div role="alert" className="valuation-notice">{error}</div>}
    {loaded&&<div className="valuation-notice">
      <strong>{loaded.filename}</strong> · {readCount} von {loaded.pageCount} Seiten ausgewertet · {review?.findings.length||0} Angaben erfasst.
      {readCount!==loaded.pageCount&&<p>Einige Seiten waren nicht lesbar. Die Premium-Bewertung bleibt deshalb gesperrt.</p>}
      <details><summary>Alle erkannten Angaben und Seiten prüfen</summary>
        {loaded.pages.map(p=><div key={p.page} style={{borderTop:"1px solid var(--glass-border)",padding:"10px 0"}}>
          <strong>Seite {p.page} · {p.status==="read"?"Gelesen":"Nicht zuverlässig gelesen"}</strong>
          <p className="valuation-muted">{p.summary}</p>
          {p.facts.map((f,i)=><p key={i} className="valuation-muted"><strong>{f.label}:</strong> {f.value}<br/><small>Beleg: „{f.evidence}“</small></p>)}
        </div>)}
      </details>
    </div>}
    <p className="valuation-muted" style={{fontSize:".76rem"}}>Wichtig: KI kann Informationen übersehen oder falsch erkennen. Darum muss jede wichtige Angabe bestätigt werden. Das Originaldokument wird nicht dauerhaft gespeichert. Erkannte Fakten werden für diesen Browser lokal gemerkt; hochgeladene Inhalte werden zur Auswertung an den eingerichteten KI-Dienst übertragen.</p>
  </div>;
}
