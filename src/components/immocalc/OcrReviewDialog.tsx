"use client";
import {useEffect,useRef} from 'react';
import type {OcrFields} from '@/lib/ocr';
export function OcrReviewDialog({result,onCancel,onApply}:{result:OcrFields;onCancel:()=>void;onApply:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=ref.current;node?.showModal();return()=>{node?.close();};},[]);
 return <dialog ref={ref} className="glass-panel scan-dialog" aria-labelledby="scan-result-title" onCancel={e=>{e.preventDefault();onCancel();}}>
            <h2 id="scan-result-title" style={{ color: 'var(--success-strong)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Erkannte Werte prüfen
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Das Bild verlässt bei der Texterkennung deinen Browser nicht. Diese Werte wurden aus dem Bild erkannt. Sie werden erst nach deiner Bestätigung übernommen.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {result.kaufpreis && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kaufpreis: bitte prüfen</span>
                  <strong style={{ color: 'var(--text-main)' }}>{result.kaufpreis} €</strong>
                </div>
              )}
              {result.wohnflaeche && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Wohnfläche: bitte prüfen</span>
                  <strong style={{ color: 'var(--text-main)' }}>{result.wohnflaeche} m²</strong>
                </div>
              )}
              {result.mietePM && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kaltmiete: bitte prüfen</span>
                  <strong style={{ color: 'var(--text-main)' }}>{result.mietePM} €</strong>
                </div>
              )}
              {result.baujahr && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Baujahr: bitte prüfen</span>
                  <strong style={{ color: 'var(--text-main)' }}>{result.baujahr}</strong>
                </div>
              )}
            </div>

            <p>Jedes erkannte Feld bitte prüfen und bei Bedarf nach der Übernahme korrigieren.</p>
            <div className="dialog-actions">
              <button type="button" className="dialog-button dialog-button--secondary" onClick={() => onCancel()}>
                Abbrechen
              </button>
              <button type="button" className="dialog-button dialog-button--primary" onClick={onApply}>
                Geprüfte Werte übernehmen
              </button>
            </div>
</dialog>;
}
