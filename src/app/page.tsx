"use client";

import { useState, useEffect, useRef } from "react";
import { createWorker } from "tesseract.js";
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import "./globals.css";

// Interface for saved objects
interface SavedObject {
  id: number;
  db_id?: string;
  date: string;
  calc: CalcState;
  rev: ReverseState;
  mieten: string[];
}

// Helper für Zahlen-Parsing und Formatierung
const parseNumber = (val: string | number) => {
  if (typeof val === "number") return val;
  if (!val) return 0;
  const cleaned = val.replace(/\./g, "").replace(",", ".");
  return parseFloat(cleaned) || 0;
};

const formatAcc = (val: number) => {
  if (isNaN(val) || !isFinite(val)) return "0,00";
  return val.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Interface for standard calculation
interface CalcState {
  objektname: string;
  anzahlEinheiten: string;
  kaufpreis: string;
  bundesland: string;
  notarProzent: string;
  hasMakler: boolean;
  maklerProzent: string;
  zins: string;
  tilgung: string;
  mietePM: string;
  mietePA: string;
  wohnflaeche: string;
  baujahr: string;
  instandhaltungQm: string;
  verwaltungPm: string;
  ruecklagePm: string;
}

// Interface for reverse calculation
interface ReverseState {
  bundesland: string;
  notarProzent: string;
  hasMakler: boolean;
  maklerProzent: string;
  zins: string;
  tilgung: string;
  zielMietePA: string;
  zielMietpreisQm: string; // NEU
  instandhaltungQm: string;
  verwaltungPm: string;
  ruecklagePm: string;
}

// Info-Tooltip Komponente
const InfoTooltip = ({ id, title, text, activeId, onToggle }: { id: string, title: string, text: string | React.ReactNode, activeId: string | null, onToggle: (id: string) => void }) => {
  const isActive = activeId === id;
  return (
    <div className="tooltip-container" onClick={(e) => { e.stopPropagation(); onToggle(id); }}>
      <svg className="tooltip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <div className={`tooltip-text ${isActive ? 'is-active' : ''}`}>
        <strong>{title}</strong><br /><br />
        {text}
      </div>
    </div>
  );
};

// Wiederverwendbare klappbare Sektion
const CollapsibleSection = ({ title, icon, children, defaultOpen = true, badge }: {
  title: string, icon: React.ReactNode, children: React.ReactNode, defaultOpen?: boolean, badge?: string | number
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: isOpen ? 0 : '-0.5rem' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.6rem 1rem',
          background: isOpen ? 'var(--glass-bg)' : 'var(--glass-bg)',
          border: `1px solid ${isOpen ? 'var(--accent-color)' : 'var(--glass-border)'}`,
          borderRadius: isOpen ? '16px 16px 0 0' : '16px',
          cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600,
          color: isOpen ? 'var(--accent-color)' : 'var(--text-main)',
          transition: 'all 0.25s ease',
          backdropFilter: 'blur(12px)'
        }}
      >
        {icon}
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        {badge && !isOpen && (
          <span style={{
            background: 'var(--accent-color)', color: '#fff', borderRadius: '999px',
            padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 700
          }}>{badge}</span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      {isOpen && (
        <div style={{
          border: '1px solid var(--accent-color)', borderTop: 'none',
          borderRadius: '0 0 16px 16px', overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          {children}
        </div>
      )}
    </div>
  );
};

const initialCalcState: CalcState = {
  objektname: "Musterstraße 1",
  anzahlEinheiten: "3",
  kaufpreis: "350.000,00",
  bundesland: "NRW",
  notarProzent: "2,00",
  hasMakler: true,
  maklerProzent: "3,57",
  zins: "4,00",
  tilgung: "1,50",
  mietePM: "1.825,00",
  mietePA: "21.900,00",
  wohnflaeche: "268,00",
  baujahr: "1980",
  instandhaltungQm: "0,00",
  verwaltungPm: "0,00",
  ruecklagePm: "0,00"
};

const initialRevState: ReverseState = {
  bundesland: "NRW",
  notarProzent: "2,00",
  hasMakler: true,
  maklerProzent: "3,57",
  zins: "4,00",
  tilgung: "1,50",
  zielMietePA: "21.900,00",
  zielMietpreisQm: "10,00",
  instandhaltungQm: "1,00",
  verwaltungPm: "30,00",
  ruecklagePm: "50,00"
};

export default function Home() {
  // === STANDARD KALKULATION STATE ===
  const [calc, setCalc] = useState<CalcState>(initialCalcState);

  const { user } = useAuth();
  const [mieten, setMieten] = useState<string[]>([""]);
  const [savedObjects, setSavedObjects] = useState<SavedObject[]>([]);
  const [isSavedObjectsOpen, setIsSavedObjectsOpen] = useState(false);
  const [isObjektInfoOpen, setIsObjektInfoOpen] = useState(false);
  const [isMietenRechnerOpen, setIsMietenRechnerOpen] = useState(false);
  const [isNotarLocked, setIsNotarLocked] = useState(true);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // OCR States
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ kaufpreis?: string, wohnflaeche?: string, mietePM?: string, baujahr?: string } | null>(null);
  const [isFlashActive, setIsFlashActive] = useState(false); // NEU: Flash-Effekt State
  const [isSaveEffectActive, setIsSaveEffectActive] = useState(false); // NEU: Speicher-Effekt State
  const [syncedFields, setSyncedFields] = useState<Record<string, boolean>>({}); // NEU: Tracking synchronisierter Felder
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UX-Hilfen für Einheiten-Rechner
  const mietenRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rechnerRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const mietenFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);
  const [mietenFeedbackActive, setMietenFeedbackActive] = useState(false);
  const [mietenFeedbackSeen, setMietenFeedbackSeen] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<'standard' | 'reverse'>('standard');


  useEffect(() => {
    if (pendingFocusIndex !== null && mietenRefs.current[pendingFocusIndex]) {
      mietenRefs.current[pendingFocusIndex]?.focus();
      setPendingFocusIndex(null);
    }
  }, [pendingFocusIndex, mieten]);

  useEffect(() => {
    return () => {
      if (mietenFeedbackTimerRef.current) {
        clearTimeout(mietenFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('immocalc_saved_objects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        const loadedObjects: SavedObject[] = (data || []).map(row => ({
          id: new Date(row.created_at).getTime(),
          db_id: row.id,
          date: new Date(row.created_at).toISOString().split('T')[0],
          calc: row.calc_data.calc,
          rev: row.calc_data.rev,
          mieten: row.calc_data.mieten
        }));
        setSavedObjects(loadedObjects);
      } catch (e) {
        console.error("Failed to load saved objects", e);
      }
    };
    loadFromSupabase();
  }, [user]);

  // Click-Away für Tooltips und Einheiten-Rechner
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Rechner schließen
      if (isMietenRechnerOpen &&
        rechnerRef.current && !rechnerRef.current.contains(event.target as Node) &&
        toggleBtnRef.current && !toggleBtnRef.current.contains(event.target as Node)) {
        setIsMietenRechnerOpen(false);
      }

      // Tooltip schließen
      if (activeTooltip) {
        const target = event.target as HTMLElement;
        if (!target.closest('.tooltip-container')) {
          setActiveTooltip(null);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMietenRechnerOpen, activeTooltip]);


  // === RÜCKWÄRTSRECHNUNG ===
  // Startwerte passen zu Standard, werden aber durch updateCalc ohnehin überschrieben, 
  // sobald oben was geändert wird.
  const [rev, setRev] = useState<ReverseState>(initialRevState);

  // Helper zum Aktualisieren des States (Standard & Synchronisation nach unten)
  const updateCalc = (field: keyof CalcState, value: string | boolean) => {
    setCalc(prev => {
      const next = { ...prev, [field]: value };

      // Bidirektionale Miete
      if (field === "mietePM" && typeof value === "string" && !isMietenRechnerOpen) {
        const pm = parseNumber(value);
        if (!isNaN(pm)) next.mietePA = formatAcc(pm * 12);
      } else if (field === "mietePA" && typeof value === "string" && !isMietenRechnerOpen) {
        const pa = parseNumber(value);
        if (!isNaN(pa)) next.mietePM = formatAcc(pa / 12);
      }

      return next;
    });
  };

  const updateCalcMieteFromRechner = (currentMieten: string[], isOpen: boolean) => {
    if (!isOpen) return; // Nur überschreiben, wenn Rechner offen ist
    let sum = 0;
    currentMieten.forEach(m => {
      const v = parseNumber(m);
      if (!isNaN(v)) sum += v;
    });

    // Setzen der neuen Miete im State, triggert updateCalc Logik durch direkten Setzer
    setCalc(prev => {
      const newPm = formatAcc(sum);
      const newPa = formatAcc(sum * 12);
      return { ...prev, mietePM: newPm, mietePA: newPa };
    });
  };

  const triggerMietenFeedback = (currentMieten: string[]) => {
    const hasInput = currentMieten.some(miete => miete.trim() !== "");
    if (!hasInput) {
      setMietenFeedbackSeen(false);
      setMietenFeedbackActive(false);
      return;
    }

    setMietenFeedbackSeen(true);
    setMietenFeedbackActive(true);

    if (mietenFeedbackTimerRef.current) {
      clearTimeout(mietenFeedbackTimerRef.current);
    }

    mietenFeedbackTimerRef.current = setTimeout(() => {
      setMietenFeedbackActive(false);
    }, 900);
  };

  const mietenSummeDisplay = String(Math.min(
    Math.round(mieten.reduce((sum, miete) => sum + parseNumber(miete), 0)),
    9999999
  ));

  const handleMieteChange = (index: number, value: string) => {
    const limitedValue = value.slice(0, 7);
    const newMieten = [...mieten];
    newMieten[index] = limitedValue;
    setMieten(newMieten);
    updateCalcMieteFromRechner(newMieten, isMietenRechnerOpen);
    triggerMietenFeedback(newMieten);
  };

  const addMiete = () => {
    if (mieten.length < 10) {
      setMieten([...mieten, ""]);
      setPendingFocusIndex(mieten.length);
    }
  };

  const removeMiete = (index: number) => {
    const newMieten = mieten.filter((_, i) => i !== index);
    setMieten(newMieten);
    updateCalcMieteFromRechner(newMieten, isMietenRechnerOpen);
    triggerMietenFeedback(newMieten);
  };

  const toggleMietenRechner = () => {
    const newState = !isMietenRechnerOpen;
    setIsMietenRechnerOpen(newState);
    if (newState) {
      setPendingFocusIndex(0);
    }
  };

  const handleBlurCalc = (field: keyof CalcState) => {
    const rawVal = calc[field];
    if (typeof rawVal === "string") {
      const val = parseNumber(rawVal);
      if (!isNaN(val)) updateCalc(field, formatAcc(val));
    }
  };

  const handleEnterKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  // === OCR LOGIK ===
  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const worker = await createWorker('deu');
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();

      processOcrText(text);
    } catch (error) {
      console.error("OCR Error:", error);
      alert("Fehler bei der Texterkennung. Bitte versuche es mit einem klareren Bild.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const processOcrText = (text: string) => {
    // Einfache Heuristiken für Immobilien-Daten
    const results: Record<string, string> = {};

    // Kaufpreis-Suche (nach € oder EUR, oft fünf- bis siebenstellig)
    const priceMatch = text.match(/(?:Kaufpreis|Preis|Festpreis)[:\s]*([\d\.,]+)\s*(?:€|EUR)/i) ||
      text.match(/([\d\.]{5,})\s*€/);
    if (priceMatch) results.kaufpreis = priceMatch[1].trim();

    // Wohnfläche (m2 oder qm)
    const areaMatch = text.match(/([\d\.,]+)\s*(?:m[²2]|qm)/i) ||
      text.match(/(?:Wohnfläche)[:\s]*([\d\.,]+)/i);
    if (areaMatch) results.wohnflaeche = areaMatch[1].trim();

    // Kaltmiete
    const rentMatch = text.match(/(?:Kaltmiete|Miete)[:\s]*([\d\.,]+)\s*€/i) ||
      text.match(/(?:Einnahmen)[:\s]*([\d\.,]+)\s*€/i);
    if (rentMatch) results.mietePM = rentMatch[1].trim();

    // Baujahr (vierstellig, 18xx, 19xx, 20xx)
    const yearMatch = text.match(/(?:Baujahr|Bauw\.)[:\s]*(\d{4})/i) ||
      text.match(/\b(18|19|20)\d{2}\b/);
    if (yearMatch) results.baujahr = yearMatch[1] || yearMatch[0];

    if (Object.keys(results).length > 0) {
      if (results.kaufpreis) updateCalc("kaufpreis", results.kaufpreis);
      if (results.wohnflaeche) updateCalc("wohnflaeche", results.wohnflaeche);
      if (results.mietePM) updateCalc("mietePM", results.mietePM);
      if (results.baujahr) updateCalc("baujahr", results.baujahr);
      setScanResult(results);
    } else {
      alert("Es konnten keine eindeutigen Daten erkannt werden. Bitte stelle sicher, dass Kaufpreis, Fläche oder Miete im Text sichtbar sind.");
    }
  };

  // Berechnungen Standard
  const kaufpreis = parseNumber(calc.kaufpreis) || 0;
  const wohnflaeche = parseNumber(calc.wohnflaeche) || 0;
  const mietePA = parseNumber(calc.mietePA) || 0;
  const zins = parseNumber(calc.zins) || 0;
  const tilgung = parseNumber(calc.tilgung) || 0;

  // Grunderwerbsteuer Tabelle
  const grunderwerbsteuer: Record<string, number> = {
    "BW": 5.0, "BY": 3.5, "BE": 6.0, "BB": 6.5,
    "HB": 5.0, "HH": 5.5, "HE": 6.0, "MV": 6.0,
    "NI": 5.0, "NRW": 6.5, "RP": 5.0, "SL": 6.5,
    "SN": 3.5, "ST": 5.0, "SH": 6.5, "TH": 6.5
  };

  const steuerProzent = grunderwerbsteuer[calc.bundesland] || 0;
  const notarProzent = parseNumber(calc.notarProzent) || 0;
  const maklerProzent = calc.hasMakler ? (parseNumber(calc.maklerProzent) || 0) : 0;
  const gesamtNkProzent = steuerProzent + notarProzent + maklerProzent;

  const steuerEuro = kaufpreis * (steuerProzent / 100);
  const notarEuro = kaufpreis * (notarProzent / 100);
  const maklerEuro = kaufpreis * (maklerProzent / 100);
  const nkEuro = kaufpreis * (gesamtNkProzent / 100);

  const summeGesamt = kaufpreis + nkEuro;
  const abtragPA = summeGesamt * ((zins + tilgung) / 100);
  const abtragPM = abtragPA / 12;

  // Szenario (Mietsteigerung)
  const [rentIncrease, setRentIncrease] = useState<number>(0);
  const mietePaSzenario = mietePA * (1 + rentIncrease / 100);
  const mietePmSzenario = mietePaSzenario / 12;
  const cashFlowPA = mietePaSzenario - abtragPA;
  const cashFlowPM = cashFlowPA / 12;

  const mietpreisQm = wohnflaeche > 0 ? (mietePaSzenario / 12) / wohnflaeche : 0;
  const kaufpreisQm = wohnflaeche > 0 ? summeGesamt / wohnflaeche : 0;

  const zinsEuroPA = summeGesamt * (zins / 100);
  const tilgungEuroPA = summeGesamt * (tilgung / 100);
  const tilgungPM = tilgungEuroPA / 12;

  // Professionelle Kennzahlen
  const bruttoRendite = kaufpreis > 0 ? (mietePA / kaufpreis) * 100 : 0;
  const nettoRendite = summeGesamt > 0 ? (mietePA / summeGesamt) * 100 : 0;
  const kaufpreisFaktor = mietePA > 0 ? kaufpreis / mietePA : 0;
  const roe = nkEuro > 0 ? (cashFlowPA / nkEuro) * 100 : 0;

  // Diagramm-Daten: Verteilung der vorhandenen Miete.
  // Wenn die Bankrate höher als die Miete ist, wird die Deckungslücke separat gezeigt.
  const zinsAusMietePA = Math.min(Math.max(zinsEuroPA, 0), Math.max(mietePaSzenario, 0));
  const tilgungAusMietePA = Math.min(Math.max(tilgungEuroPA, 0), Math.max(mietePaSzenario - zinsAusMietePA, 0));
  const cashflowAusMietePA = Math.max(mietePaSzenario - zinsAusMietePA - tilgungAusMietePA, 0);
  const deckungslueckePA = Math.max(abtragPA - mietePaSzenario, 0);

  const zinsAnteil = mietePaSzenario > 0 ? (zinsAusMietePA / mietePaSzenario) * 100 : 0;
  const tilgungAnteil = mietePaSzenario > 0 ? (tilgungAusMietePA / mietePaSzenario) * 100 : 0;
  const cashflowAnteil = mietePaSzenario > 0 ? (cashflowAusMietePA / mietePaSzenario) * 100 : 0;

  const degZins = zinsAnteil;
  const degTilgung = zinsAnteil + tilgungAnteil;
  const degCF = zinsAnteil + tilgungAnteil + cashflowAnteil;

  const updateRev = (field: keyof ReverseState, value: string | boolean) => {
    // Wenn ein Feld manuell geändert wird, verliert es den Synchronisations-Status
    setSyncedFields(prev => ({ ...prev, [field]: false }));

    setRev(prev => {
      const next = { ...prev, [field]: value };

      // Synchronisation: Wenn Ziel-m²-Miete geändert wird, berechne Ziel-Jahresmiete
      if (field === "zielMietpreisQm" && typeof value === "string") {
        const qm = parseNumber(value);
        const fl = parseNumber(calc.wohnflaeche);
        if (fl > 0) next.zielMietePA = formatAcc(qm * fl * 12);
      }

      // Synchronisation: Wenn Ziel-Jahresmiete geändert wird, berechne m²-Miete
      if (field === "zielMietePA" && typeof value === "string") {
        const pa = parseNumber(value);
        const fl = parseNumber(calc.wohnflaeche);
        if (fl > 0) next.zielMietpreisQm = formatAcc(pa / fl / 12);
      }

      return next;
    });
  };

  const handleBlurRev = (field: keyof ReverseState) => {
    const rawVal = rev[field];
    if (typeof rawVal === "string") {
      const val = parseNumber(rawVal);
      if (!isNaN(val)) updateRev(field, formatAcc(val));
    }
  };

  const revSteuerProzent = grunderwerbsteuer[rev.bundesland] || 0;
  const revNotarProzent = parseNumber(rev.notarProzent) || 0;
  const revMaklerProzent = rev.hasMakler ? (parseNumber(rev.maklerProzent) || 0) : 0;
  const revGesamtNkProzent = revSteuerProzent + revNotarProzent + revMaklerProzent;

  const revZins = parseNumber(rev.zins) || 0;
  const revTilgung = parseNumber(rev.tilgung) || 0;
  const revZielMietePA = parseNumber(rev.zielMietePA) || 0;

  // Max Kaufpreis (inkl NK) = zielMiete / ((zins+tilgung)/100)
  const revBankRate = (revZins + revTilgung) / 100;
  const revMaxGesamtKaufpreis = revBankRate > 0 ? revZielMietePA / revBankRate : 0;

  // Eigentlicher Kaufpreis = Gesamtkaufpreis / (1 + nk/100)
  const revKaufpreis = revMaxGesamtKaufpreis / (1 + revGesamtNkProzent / 100);
  const revNkEuro = revMaxGesamtKaufpreis - revKaufpreis;

  // Makler in € im Reverse Case:
  const revMaklerEuro = revKaufpreis * (revMaklerProzent / 100);

  // Szenario für Rückwärtsrechnung (Neuer Kaufpreis bei Mietsteigerung)
  const revZielMieteNeu = revZielMietePA * (1 + rentIncrease / 100);
  const revMaxGesamtKaufpreisNeu = revBankRate > 0 ? revZielMieteNeu / revBankRate : 0;
  const revKaufpreisNeu = revMaxGesamtKaufpreisNeu / (1 + revGesamtNkProzent / 100);

  // Manuelle Synchronisation
  const syncFromCalcToRev = () => {
    setRev(prev => ({
      ...prev,
      bundesland: calc.bundesland,
      notarProzent: calc.notarProzent,
      hasMakler: calc.hasMakler,
      maklerProzent: calc.maklerProzent,
      zins: calc.zins,
      tilgung: calc.tilgung,
      zielMietePA: calc.mietePA,
      zielMietpreisQm: formatAcc(parseNumber(calc.mietePA) / parseNumber(calc.wohnflaeche) / 12)
    }));

    // Alle synchronisierten Felder markieren
    setSyncedFields({
      bundesland: true,
      notarProzent: true,
      hasMakler: true,
      maklerProzent: true,
      zins: true,
      tilgung: true,
      zielMietePA: true,
      zielMietpreisQm: true
    });

    // Trigger Flash Effekt
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 800);
  };

  const handleSaveObject = async () => {
    if (!user) {
      alert("Du musst eingeloggt sein, um Objekte speichern zu können.");
      return;
    }
    
    let trimmedName = calc.objektname.trim();
    if (!trimmedName) {
      // Automatically generate a name if empty instead of blocking the save
      const dateStr = new Date().toLocaleDateString('de-DE');
      trimmedName = `Unbenanntes Objekt (${dateStr})`;
      updateCalc("objektname", trimmedName);
    }

    // Prüfen, ob Objekt mit diesem Namen bereits existiert
    const existingIndex = savedObjects.findIndex(o => o.calc.objektname.trim() === trimmedName);
    let nameToSave = trimmedName;
    let existingDbId: string | undefined = undefined;

    if (existingIndex !== -1) {
      const wantOverwrite = window.confirm(`Ein Objekt mit dem Namen "${trimmedName}" existiert bereits.\n\nMöchtest du es überschreiben?\n(Klicke "Abbrechen", um eine Kopie unter neuem Namen zu speichern)`);
      if (wantOverwrite) {
        existingDbId = savedObjects[existingIndex].db_id;
      } else {
        const newName = window.prompt("Bitte gib einen neuen Namen für dieses Objekt ein:", trimmedName + " (Kopie)");
        if (!newName || !newName.trim()) return;
        nameToSave = newName.trim();
        updateCalc("objektname", nameToSave);
      }
    }

    try {
      const payload = {
        user_id: user.id,
        calc_data: { calc: { ...calc, objektname: nameToSave }, rev, mieten }
      };

      if (existingDbId) {
        const { error } = await supabase
          .from('immocalc_saved_objects')
          .update(payload)
          .eq('id', existingDbId);

        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from('immocalc_saved_objects')
          .insert(payload);

        if (error) {
          throw error;
        }
      }

      const { data, error } = await supabase
        .from('immocalc_saved_objects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setSavedObjects((data || []).map(row => ({
        id: new Date(row.created_at).getTime(),
        db_id: row.id,
        date: new Date(row.created_at).toISOString().split('T')[0],
        calc: row.calc_data.calc,
        rev: row.calc_data.rev,
        mieten: row.calc_data.mieten
      })));

      setIsSavedObjectsOpen(true);
      setIsObjektInfoOpen(false);
      setIsSaveEffectActive(true);
      setTimeout(() => setIsSaveEffectActive(false), 800);
    } catch (e) {
      console.error("Speichern fehlgeschlagen:", e);
      const message = e instanceof Error
        ? e.message
        : typeof e === "object" && e && "message" in e
          ? String(e.message)
          : "Unbekannter Fehler";
      alert(`Fehler beim Speichern in der Cloud:\n${message}`);
    }
  };

  const handleLoadObject = (obj: SavedObject) => {
    setCalc(obj.calc);
    setRev(obj.rev || rev);
    setMieten(obj.mieten || [""]);
  };

  const handleResetData = () => {
    if (window.confirm("Bist du sicher, dass du alle Eingaben zurücksetzen möchtest?")) {
      setCalc(initialCalcState);
      setRev(initialRevState);
      setSyncedFields({ zins: true, tilgung: true, zielMietePA: true, zielMietpreisQm: true });
      setMieten([""]);
      setIsFlashActive(true);
      setTimeout(() => setIsFlashActive(false), 800);
    }
  };

  const handleDeleteObject = async (id: number) => {
    const obj = savedObjects.find(o => o.id === id);
    if (obj?.db_id) {
      const { error } = await supabase
        .from('immocalc_saved_objects')
        .delete()
        .eq('id', obj.db_id);

      if (error) {
        console.error("Löschen fehlgeschlagen:", error);
        alert(`Fehler beim Löschen:\n${error.message}`);
        return;
      }
    }
    setSavedObjects(savedObjects.filter(o => o.id !== id));
  };

  return (
    <div className="app-container">
      {/* ═══ TOP BAR — ImmoCow product family style ═══ */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.35rem 0 0.6rem', marginBottom: '0.15rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
          <img
            src="/logos/immocow-icon-light-v2.png"
            alt="ImmoCow"
            style={{ width: 46, height: 46, objectFit: 'contain', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontFamily: 'Outfit, Inter, sans-serif', fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-main)' }}>
              ImmoCalc
            </div>
            <div style={{ fontSize: '0.63rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              by ImmoCow
            </div>
          </div>
        </div>

        {/* Action Buttons — Right-aligned icon row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {/* Scan Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            title="Exposé scannen"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              color: 'var(--success-color)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease', backdropFilter: 'blur(16px)',
              opacity: isScanning ? 0.6 : 1,
            }}
          >
            {isScanning ? (
              <div className="spinner-small"></div>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            )}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleScanImage} accept="image/*" style={{ display: 'none' }} />

          {/* Reset Button */}
          <button
            onClick={handleResetData}
            title="Daten zurücksetzen"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              color: '#ef4444', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease', backdropFilter: 'blur(16px)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
          </button>

          {/* Save Button war hier, wurde zu Baujahr verschoben */}

          {/* Objekt-Infos Toggle */}
          <button
            onClick={() => { setIsObjektInfoOpen(!isObjektInfoOpen); if (!isObjektInfoOpen) setIsSavedObjectsOpen(false); }}
            title="Objekt-Infos"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: isObjektInfoOpen ? 'var(--accent-color)' : 'var(--glass-bg)',
              border: `1px solid ${isObjektInfoOpen ? 'var(--accent-color)' : 'var(--glass-border)'}`,
              color: isObjektInfoOpen ? '#fff' : 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease', backdropFilter: 'blur(16px)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </button>

          {/* Saved Objects Toggle */}
          <button
            onClick={() => { setIsSavedObjectsOpen(!isSavedObjectsOpen); if (!isSavedObjectsOpen) setIsObjektInfoOpen(false); }}
            title={`Gespeicherte Objekte (${savedObjects.length})`}
            style={{
              width: 36, height: 36, borderRadius: 10, position: 'relative',
              background: isSavedObjectsOpen ? 'var(--accent-color)' : 'var(--glass-bg)',
              border: `1px solid ${isSavedObjectsOpen ? 'var(--accent-color)' : 'var(--glass-border)'}`,
              color: isSavedObjectsOpen ? '#fff' : 'var(--text-main)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s ease', backdropFilter: 'blur(16px)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            {savedObjects.length > 0 && (
              <span style={{
                position: 'absolute', top: '-3px', right: '-3px',
                background: 'var(--danger-color)', color: '#fff',
                borderRadius: '50%', width: 16, height: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.6rem', fontWeight: 700, border: '2px solid var(--bg-color)',
              }}>{savedObjects.length}</span>
            )}
          </button>
        </div>
      </header>

      {/* ═══ EXPANDABLE PANELS (below top bar) ═══ */}

      {/* Objekt-Infos Panel */}
      {isObjektInfoOpen && (
        <div className="glass-panel" style={{
          padding: '0.75rem', marginBottom: '0.25rem',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-color)' }}>Objekt-Informationen</span>
            <button
              onClick={() => setIsObjektInfoOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
          </div>
          <div className="calculation-row">
            <div className="input-group input-optional">
              <label>Objektname</label>
              <div className="input-wrapper">
                <input type="text" value={calc.objektname} onChange={(e) => updateCalc("objektname", e.target.value)} placeholder="z.B. Mehrfamilienhaus Mitte" onKeyDown={handleEnterKey} />
              </div>
            </div>
            <div className="input-group input-optional">
              <label>Anzahl Einheiten</label>
              <div className="input-wrapper">
                <input type="text" value={calc.anzahlEinheiten} onChange={(e) => updateCalc("anzahlEinheiten", e.target.value)} placeholder="z.B. 3" onKeyDown={handleEnterKey} />
              </div>
            </div>
            <div className="input-group input-optional">
              <label>Baujahr</label>
              <div className="input-wrapper" style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" value={calc.baujahr} onChange={(e) => updateCalc("baujahr", e.target.value)} onBlur={() => handleBlurCalc("baujahr")} onKeyDown={handleEnterKey} style={{ flex: 1 }} />
                
                {/* Save Button */}
                <button
                  onClick={handleSaveObject}
                  title="Objekt speichern"
                  style={{
                    width: 48, height: 48, borderRadius: 10, flexShrink: 0,
                    background: isSaveEffectActive ? 'var(--success-color)' : 'var(--glass-bg)', 
                    border: '1px solid var(--glass-border)',
                    color: isSaveEffectActive ? '#fff' : 'var(--accent-color)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s ease', backdropFilter: 'blur(16px)',
                    boxShadow: isSaveEffectActive ? '0 0 15px var(--success-color)' : 'none',
                    transform: isSaveEffectActive ? 'scale(1.05)' : 'scale(1)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gespeicherte Objekte Panel */}
      {isSavedObjectsOpen && (
        <div className="glass-panel" style={{
          padding: '0.75rem', marginBottom: '0.25rem',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-color)' }}>Gespeicherte Objekte ({savedObjects.length})</span>
            <button
              onClick={() => setIsSavedObjectsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
          </div>
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.4rem',
            maxHeight: '240px', overflowY: 'auto', paddingRight: '0.25rem'
          }}>
            {savedObjects.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                Noch keine Objekte gespeichert.
              </div>
            ) : (
              savedObjects.map(obj => (
                <div
                  key={obj.id}
                  onClick={() => handleLoadObject(obj)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--input-optional-bg)', border: '1px solid var(--input-optional-border)',
                    borderRadius: '8px', padding: '0.45rem 0.65rem', cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-color)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--input-optional-border)'; }}
                  title="Klicken zum Laden"
                >
                  <div style={{ flex: 1, overflow: 'hidden', paddingRight: '0.5rem' }}>
                    <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {obj.calc.objektname || "Unbenanntes Objekt"}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {obj.date} · {obj.calc.kaufpreis} €
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteObject(obj.id); }}
                    style={{
                      background: 'none', border: 'none', color: 'var(--danger-color)',
                      padding: '0.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', opacity: 0.5, transition: 'opacity 0.15s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}
                    title="Löschen"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB NAVIGATION */}
      <div className="tabs-container">
        <button
          className={`tab-button ${activeTab === 'standard' ? 'active' : ''}`}
          onClick={() => setActiveTab('standard')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          Standard-Rechner
        </button>
        <button
          className={`tab-button ${activeTab === 'reverse' ? 'active' : ''}`}
          onClick={() => setActiveTab('reverse')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
          Rückwärts-Rechner
        </button>
      </div>

      {activeTab === 'standard' && (
        <div className="dashboard-layout">

          {/* LINKS: EINGABEN */}
          <CollapsibleSection
            title="Kalkulation"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><line x1="8" y1="6" x2="16" y2="6"></line><line x1="8" y1="10" x2="10" y2="10"></line><line x1="14" y1="10" x2="16" y2="10"></line><line x1="8" y1="14" x2="10" y2="14"></line><line x1="14" y1="14" x2="16" y2="14"></line><line x1="8" y1="18" x2="16" y2="18"></line></svg>}
          >
            <section className="glass-panel" style={{ padding: '1rem', borderRadius: 0, border: 'none', boxShadow: 'none' }}>
              <div className="grid-layout">



                <h3 className="cluster-title">1. Objektdaten</h3>
                <div className="calculation-row">
                  <div className="input-group input-required">
                    <label>Kaufpreis</label>
                    <div className="input-wrapper">
                      <input type="text" value={calc.kaufpreis} onChange={(e) => updateCalc("kaufpreis", e.target.value)} onBlur={() => handleBlurCalc("kaufpreis")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>

                  <div className="input-group input-required">
                    <label>Wohnfläche</label>
                    <div className="input-wrapper">
                      <input type="text" value={calc.wohnflaeche} onChange={(e) => updateCalc("wohnflaeche", e.target.value)} onBlur={() => handleBlurCalc("wohnflaeche")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">m²</span>
                    </div>
                  </div>

                  <div className="input-group" style={{ visibility: 'hidden' }}></div>
                </div>



                <h3 className="cluster-title">2. Kaufnebenkosten</h3>
                <div className="calculation-row">
                  <div className="input-group input-required">
                    <label>BL (Steuer)</label>
                    <div className="input-wrapper">
                      <select
                        value={calc.bundesland}
                        onChange={(e) => updateCalc("bundesland", e.target.value)}
                        style={{ border: '1px solid var(--input-required-border)', background: 'var(--input-required-bg)', color: 'var(--input-required-text)', appearance: 'none', cursor: 'pointer' }}
                      >
                        {Object.keys(grunderwerbsteuer).sort().map(bl => (
                          <option key={bl} value={bl}>{bl} ({formatAcc(grunderwerbsteuer[bl])}%)</option>
                        ))}
                      </select>
                      <span className="input-suffix">▼</span>
                    </div>
                  </div>

                  <div className="input-group output-calc">
                    <label>Gesamte NK <span style={{ fontWeight: 'bold' }}>- {formatAcc(gesamtNkProzent)}%</span></label>
                    <div className="input-wrapper">
                      <input type="text" readOnly value={formatAcc(nkEuro)} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                </div>

                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label>Notar</label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        value={calc.notarProzent}
                        onChange={(e) => updateCalc("notarProzent", e.target.value)}
                        onBlur={() => handleBlurCalc("notarProzent")}
                        readOnly={isNotarLocked}
                        style={{
                          opacity: isNotarLocked ? 0.7 : 1,
                          transition: 'opacity 0.2s',
                          background: isNotarLocked ? 'var(--bg-color)' : 'var(--input-optional-bg)'
                        }}
                        onKeyDown={handleEnterKey}
                      />
                      <button
                        onClick={() => setIsNotarLocked(!isNotarLocked)}
                        style={{
                          position: 'absolute', right: '1.8rem', background: 'none', border: 'none',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.6
                        }}
                        title={isNotarLocked ? "Klicken zum Entsperren" : "Klicken zum Sperren"}
                      >
                        {isNotarLocked ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                        )}
                      </button>
                      <span className="input-suffix">%</span>
                    </div>
                  </div>

                  <div className="input-group input-optional">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input type="checkbox" checked={calc.hasMakler} onChange={(e) => updateCalc("hasMakler", e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)' }} />
                      Maklerprovision
                    </label>
                    <div className="input-wrapper" style={{ opacity: calc.hasMakler ? 1 : 0.5, pointerEvents: calc.hasMakler ? 'auto' : 'none' }}>
                      <input type="text" value={calc.maklerProzent} onChange={(e) => updateCalc("maklerProzent", e.target.value)} onBlur={() => handleBlurCalc("maklerProzent")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>

                  <div className="input-group output-calc">
                    <label>Maklerprovision (€)</label>
                    <div className="input-wrapper" style={{ opacity: calc.hasMakler ? 1 : 0.5 }}>
                      <input type="text" readOnly value={formatAcc(maklerEuro)} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                </div>

                <h3 className="cluster-title">3. Einnahmen (Kaltmiete)</h3>

                <div className="calculation-row">
                  <div className="input-group input-required">
                    <label>Kaltmiete / Monat</label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        value={calc.mietePM}
                        onChange={(e) => updateCalc("mietePM", e.target.value)}
                        onBlur={() => handleBlurCalc("mietePM")}
                        readOnly={isMietenRechnerOpen}
                        style={{ background: isMietenRechnerOpen ? 'var(--bg-color)' : '', opacity: isMietenRechnerOpen ? 0.7 : 1 }}
                        onKeyDown={handleEnterKey}
                      />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>

                  <div className="input-group input-required">
                    <label>Kaltmiete / p.a.</label>
                    <div className="input-wrapper">
                      <input
                        type="text"
                        value={calc.mietePA}
                        onChange={(e) => updateCalc("mietePA", e.target.value)}
                        onBlur={() => handleBlurCalc("mietePA")}
                        readOnly={isMietenRechnerOpen}
                        style={{ background: isMietenRechnerOpen ? 'var(--bg-color)' : '', opacity: isMietenRechnerOpen ? 0.7 : 1 }}
                        onKeyDown={handleEnterKey}
                      />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>

                  {/* Mieten-Rechner Toggle-Button in der dritten Spalte */}
                  <div className="input-group">
                    <label style={{ visibility: 'hidden' }}>Platzhalter</label>
                    <button
                      ref={toggleBtnRef}
                      onClick={toggleMietenRechner}
                      className={`unit-rent-toggle ${mietenFeedbackSeen ? 'has-confirmation' : ''} ${mietenFeedbackActive ? 'is-confirmed' : ''}`}
                      style={{
                        background: 'var(--input-optional-bg)',
                        border: '1px solid var(--accent-color)',
                        color: 'var(--accent-color)',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        padding: '0 0.8rem',
                        borderRadius: '8px',
                        fontWeight: 500,
                        width: '100%',
                        height: '38px'
                      }}
                    >
                      <span>{isMietenRechnerOpen ? 'Einheiten einzeln ▲' : 'Einheiten einzeln ▼'}</span>
                      {mietenFeedbackSeen && (
                        <span className="unit-rent-status" aria-label={`Werte übernommen: ${mietenSummeDisplay} Euro`}>
                          <span className="unit-rent-total">{mietenSummeDisplay}</span>
                          <span className="unit-rent-check">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                          </span>
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {isMietenRechnerOpen && (
                  <div className="calculation-row" style={{ marginTop: '-0.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ visibility: 'hidden' }}></div>
                    <div style={{ visibility: 'hidden' }}></div>

                    <div
                      ref={rechnerRef}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        background: 'var(--input-optional-bg)',
                        padding: '1rem',
                        borderRadius: '12px',
                        border: '1px solid var(--input-optional-border)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        animation: 'fadeIn 0.3s ease-out',
                        width: '100%',
                        minWidth: 0
                      }}>
                      {/* Der Header mit "Einheiten Kalkulator" wurde entfernt, um Platz zu sparen. Die erste Einheit startet direkt hier. */}
                      {mieten.map((miete, index) => (
                        <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <div className="input-wrapper" style={{ flex: 1 }}>
                            <input
                              ref={el => { mietenRefs.current[index] = el; }}
                              type="text"
                              placeholder={`Einheit ${index + 1}`}
                              value={miete}
                              maxLength={7}
                              onChange={(e) => handleMieteChange(index, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (index < mieten.length - 1) {
                                    mietenRefs.current[index + 1]?.focus();
                                  } else if (mieten.length < 10) {
                                    addMiete();
                                  }
                                }
                              }}
                              style={{ background: 'var(--bg-color)', border: '1px solid var(--input-optional-border)', fontSize: '0.85rem' }}
                            />
                            <span className="input-suffix">€</span>
                          </div>
                          {mieten.length > 1 && (
                            <button
                              onClick={() => removeMiete(index)}
                              style={{ background: 'var(--bg-color)', border: '1px solid var(--input-optional-border)', borderRadius: '8px', color: 'var(--danger-color)', cursor: 'pointer', padding: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Entfernen"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                          )}
                        </div>
                      ))}

                      {mieten.length < 10 && (
                        <button
                          onClick={addMiete}
                          style={{
                            padding: '0.6rem', background: 'var(--bg-color)',
                            border: '1px dashed var(--accent-color)', borderRadius: '8px', color: 'var(--accent-color)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                            fontSize: '0.8rem', fontWeight: 600, marginTop: '0.25rem', transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-color-light)'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-color)'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                          Einheit hinzufügen
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <h3 className="cluster-title">4. Finanzierung</h3>
                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label>Zins</label>
                    <div className="input-wrapper">
                      <input type="text" value={calc.zins} onChange={(e) => updateCalc("zins", e.target.value)} onBlur={() => handleBlurCalc("zins")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label>Tilgung</label>
                    <div className="input-wrapper">
                      <input type="text" value={calc.tilgung} onChange={(e) => updateCalc("tilgung", e.target.value)} onBlur={() => handleBlurCalc("tilgung")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                </div>

              </div>
            </section>
          </CollapsibleSection>



          <CollapsibleSection
            title="Ergebnisse & Rendite"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>}
            badge={`${formatAcc(roe)}% ROE`}
          >
            <section className="results-sticky">
              <div className="glass-panel" style={{ padding: '1rem', background: 'var(--output-calc-bg)', border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                <div style={{ position: 'relative', marginBottom: '1.5rem', borderBottom: '1px solid var(--output-calc-border)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.25rem' }}>
                    <span className="label" style={{ color: 'var(--output-calc-text)', fontSize: '0.9rem', margin: 0 }}>Gesamt-Investition</span>
                    <InfoTooltip
                      id="gesamt"
                      title="Gesamt-Investition"
                      text="Kaufpreis + alle Kaufnebenkosten (Grunderwerbsteuer, Notar, Makler). Dies ist der Betrag, den du insgesamt finanzieren oder aufbringen musst."
                      activeId={activeTooltip}
                      onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                    />
                  </div>
                  <span className="value" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--output-calc-text)', whiteSpace: 'nowrap' }}>
                    {formatAcc(summeGesamt)} €
                  </span>

                  {/* Deal-Check Daumen Indikator - Absolut positioniert & Interaktiv */}
                  <div
                    className="tooltip-container"
                    onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'dealcheck' ? null : 'dealcheck'); }}
                    style={{
                      position: 'absolute',
                      right: '0',
                      top: '32%',
                      transform: 'translateY(-50%)',
                      color: roe > 12 ? 'var(--success-color)' : roe >= 5 ? '#f59e0b' : 'var(--danger-color)',
                      transition: 'all 0.4s ease',
                      filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))',
                      cursor: 'pointer'
                    }}
                  >
                    <svg
                      width="64"
                      height="64"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        transform: `rotate(${roe > 12 ? '0deg' : roe >= 5 ? '270deg' : '180deg'})`,
                        transition: 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)'
                      }}
                    >
                      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
                    </svg>

                    {/* Erklärung für Deal-Status */}
                    <div className={`tooltip-text ${activeTooltip === 'dealcheck' ? 'is-active' : ''}`} style={{ right: '110%', left: 'auto', bottom: '10%', transform: 'none', width: '280px' }}>
                      <strong>Profi-Check Status:</strong><br /><br />
                      {roe > 12 ? (
                        <>
                          <span style={{ color: 'var(--success-color)', fontWeight: 700 }}>Top Profi-Deal!</span><br />
                          Deine Eigenkapitalrendite (ROE) liegt mit {formatAcc(roe)}% über dem Zielwert von 12%. Das Objekt erwirtschaftet eine exzellente Verzinsung auf dein Kapital.
                        </>
                      ) : roe >= 5 ? (
                        <>
                          <span style={{ color: '#f59e0b', fontWeight: 700 }}>Solider Bereich</span><br />
                          Mit {formatAcc(roe)}% ROE liegt das Objekt im marktüblichen Mittelfeld (Ziel: {'>'}12%). Prüfe Lage und Entwicklungspotenzial genau.
                        </>
                      ) : (
                        <>
                          <span style={{ color: 'var(--danger-color)', fontWeight: 700 }}>Kritische Rendite</span><br />
                          Eine ROE von {formatAcc(roe)}% ist für professionelle Investoren (Ziel: {'>'}12%) oft nicht wirtschaftlich genug. Versuche den Kaufpreis zu verhandeln.
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rendite-Analyse Inline */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                  <div className="result-card" style={{ padding: '0.75rem', border: '1px solid var(--accent-color)', background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="label" style={{ color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
                        Eigenkapital-Rendite (ROE)
                      </span>
                      <InfoTooltip
                        id="roe"
                        title="Return on Equity (ROE)"
                        text="Berechnung: (Cashflow p.a. / Kaufnebenkosten) * 100. Zeigt die Verzinsung deines tatsächlich eingesetzten Eigenkapitals (hier die Nebenkosten)."
                        activeId={activeTooltip}
                        onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                      />
                    </div>
                    <span className={`value ${roe >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '1.5rem' }}>
                      {formatAcc(roe)} %
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>auf eingesetzte Nebenkosten</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div className="result-card" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="label" style={{ fontSize: '0.7rem', margin: 0 }}>Brutto-Rendite</span>
                        <InfoTooltip
                          id="brutto"
                          title="Brutto-Mietrendite"
                          text="Berechnung: (Jahreskaltmiete / Kaufpreis) * 100. Einfacher Vergleichswert, berücksichtigt keine Nebenkosten."
                          activeId={activeTooltip}
                          onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                        />
                      </div>
                      <span className="value" style={{ fontSize: '1rem' }}>{formatAcc(bruttoRendite)} %</span>
                    </div>
                    <div className="result-card" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="label" style={{ fontSize: '0.7rem', margin: 0 }}>Netto-Rendite</span>
                        <InfoTooltip
                          id="netto"
                          title="Netto-Mietrendite"
                          text="Berechnung: (Jahreskaltmiete / Gesamt-Investition) * 100. Der ehrlichere Wert, da er die Kaufnebenkosten einbezieht."
                          activeId={activeTooltip}
                          onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                        />
                      </div>
                      <span className="value" style={{ fontSize: '1rem' }}>{formatAcc(nettoRendite)} %</span>
                    </div>
                  </div>

                  <div className="result-card" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="label" style={{ margin: 0, fontSize: '0.8rem' }}>Kaufpreis-Faktor</span>
                      <InfoTooltip
                        id="faktor"
                        title="Kaufpreis-Faktor"
                        text="Berechnung: Kaufpreis / Jahreskaltmiete. Gibt an, nach wie vielen Jahren sich der Kaufpreis durch die Miete amortisiert hat."
                        activeId={activeTooltip}
                        onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                      />
                    </div>
                    <span className="value" style={{ fontSize: '1.1rem', color: 'var(--accent-color)' }}>{formatAcc(kaufpreisFaktor)}x</span>
                  </div>
                </div>

                {/* Zwei Spalten für CashFlow */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div className="result-card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="label" style={{ margin: 0 }}>CF / Monat</span>
                      <InfoTooltip
                        id="cfpm"
                        title="Cashflow pro Monat"
                        text="Monatliche Kaltmiete minus Bankrate (Zins + Tilgung). Das Geld, das monatlich nach Kreditbedienung übrig bleibt."
                        activeId={activeTooltip}
                        onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                      />
                    </div>
                    <span className={`value ${cashFlowPM >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '1.15rem', whiteSpace: 'nowrap' }}>
                      {cashFlowPM >= 0 ? '+' : ''}{formatAcc(cashFlowPM)} €
                    </span>
                  </div>
                  <div className="result-card" style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="label" style={{ margin: 0 }}>CF / Jahr</span>
                      <InfoTooltip
                        id="cfpa"
                        title="Cashflow pro Jahr"
                        text="Jahreskaltmiete minus jährliche Bankrate. Dein kalkulatorischer Gewinn nach Finanzierungskosten."
                        activeId={activeTooltip}
                        onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                      />
                    </div>
                    <span className={`value ${cashFlowPA >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '1.15rem', whiteSpace: 'nowrap' }}>
                      {cashFlowPA >= 0 ? '+' : ''}{formatAcc(cashFlowPA)} €
                    </span>
                  </div>
                </div>

                {/* Zwei Kacheln für m²-Preise */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div className="result-card" style={{ padding: '0.8rem', background: 'var(--bg-color)', border: '1px solid var(--input-optional-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Miete / m²</span>
                      <InfoTooltip
                        id="mieteqm"
                        title="Mietpreis pro m²"
                        text="Kaltmiete pro Monat dividiert durch die Wohnfläche. Wichtig für den Marktabgleich."
                        activeId={activeTooltip}
                        onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                      />
                    </div>
                    <span className="value" style={{ fontSize: '1.1rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {formatAcc(mietpreisQm)} €
                    </span>
                  </div>
                  <div className="result-card" style={{ padding: '0.8rem', background: 'var(--bg-color)', border: '1px solid var(--input-optional-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Preis / m²</span>
                      <InfoTooltip
                        id="preisqm"
                        title="Kaufpreis pro m²"
                        text="Gesamt-Investition dividiert durch die Wohnfläche. Der reale Preis, den du pro m² bezahlst."
                        activeId={activeTooltip}
                        onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                      />
                    </div>
                    <span className="value" style={{ fontSize: '1.1rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                      {formatAcc(kaufpreisQm)} €
                    </span>
                  </div>
                </div>

                {/* Bankabtrag Kacheln */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div className="result-card" style={{ padding: '0.8rem', background: 'var(--bg-color)', border: '1px solid var(--input-optional-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Zins / Mo.</span>
                      <InfoTooltip
                        id="zinsmo"
                        title="Zinsanteil pro Monat"
                        text="Der Teil der Bankrate, der als reine Kosten für das Darlehen anfällt."
                        activeId={activeTooltip}
                        onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                      />
                    </div>
                    <span className="value" style={{ fontSize: '1.1rem', color: 'var(--danger-color)', whiteSpace: 'nowrap' }}>
                      -{formatAcc(zinsEuroPA / 12)} €
                    </span>
                  </div>
                  <div className="result-card" style={{ padding: '0.8rem', background: 'var(--bg-color)', border: '1px solid var(--input-optional-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Tilgung / Mo.</span>
                      <InfoTooltip
                        id="tilgungmo"
                        title="Tilgung pro Monat"
                        text="Der Teil der Bankrate, der dein Darlehen reduziert — also dein monatlicher Vermögensaufbau."
                        activeId={activeTooltip}
                        onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                      />
                    </div>
                    <span className="value" style={{ fontSize: '1.1rem', color: 'var(--success-color)', whiteSpace: 'nowrap' }}>
                      +{formatAcc(tilgungEuroPA / 12)} €
                    </span>
                  </div>
                </div>

                {/* Kreisdiagramm: Miet-Verwendung */}
                <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column' }}>
                  <span className="label" style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '0.75rem', fontWeight: 700 }}>Miet-Verwendung (monatlich)</span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                      position: 'relative', width: '90px', height: '90px', borderRadius: '50%',
                      background: mietePA > 0
                        ? `conic-gradient(var(--danger-color) 0% ${degZins}%, var(--accent-color) ${degZins}% ${degTilgung}%, var(--success-color) ${degTilgung}% ${degCF}%, #eee ${degCF}% 100%)`
                        : '#eee',
                      flexShrink: 0
                    }}>
                      {/* Donut Hole */}
                      <div style={{ position: 'absolute', top: '22%', left: '22%', width: '56%', height: '56%', background: 'var(--output-calc-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {formatAcc(mietePmSzenario)}€
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                        <div style={{ width: '10px', height: '10px', background: 'var(--danger-color)', borderRadius: '2px' }}></div>
                        <div style={{ flex: 1 }}>Zinsen</div>
                        <div style={{ fontWeight: 600 }}>{Math.round(zinsAnteil)}%</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                        <div style={{ width: '10px', height: '10px', background: 'var(--accent-color)', borderRadius: '2px' }}></div>
                        <div style={{ flex: 1 }}>Tilgung</div>
                        <div style={{ fontWeight: 600 }}>{Math.round(tilgungAnteil)}%</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
                        <div style={{ width: '10px', height: '10px', background: 'var(--success-color)', borderRadius: '2px' }}></div>
                        <div style={{ flex: 1 }}>Cashflow</div>
                        <div style={{ fontWeight: 600 }}>{Math.round(cashflowAnteil)}%</div>
                      </div>
                      {deckungslueckePA > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--danger-color)' }}>
                          <div style={{ width: '10px', height: '10px', background: 'transparent', border: '1px solid var(--danger-color)', borderRadius: '2px' }}></div>
                          <div style={{ flex: 1 }}>Deckungslücke</div>
                          <div style={{ fontWeight: 700 }}>{formatAcc(deckungslueckePA / 12)} €</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Vermögensaufbau (Tilgung): {formatAcc(tilgungPM)} € / Monat
                    {tilgungAusMietePA < tilgungEuroPA && `, davon ${formatAcc(tilgungAusMietePA / 12)} € aus der Miete gedeckt`}
                  </div>
                </div>

              </div>
            </section>
          </CollapsibleSection>
        </div>
      )}

      {activeTab === 'reverse' && (
        <div style={{ padding: '0' }}>
          <div className="dashboard-layout">
            <CollapsibleSection
              title="Ziel-Vorgabe & Konditionen"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>}
            >
              <section style={{ padding: '1rem' }}>
                {/* SCHNELL-MIET-CHECKER INNERHALB DER ZIEL-VORGABE */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="glass-panel" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--input-optional-bg)', border: '1px dashed var(--accent-color)' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)' }}>Miet-Potenzial Check:</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Fläche"
                        defaultValue={calc.wohnflaeche}
                        style={{ width: '60px', padding: '0.25rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                        id="quick-area"
                        onChange={(e) => {
                          const fl = parseFloat(e.target.value) || 0;
                          const pr = parseFloat((document.getElementById('quick-price') as HTMLInputElement).value) || 0;
                          (document.getElementById('quick-result') as HTMLElement).innerText = formatAcc(fl * pr) + " €";
                        }}
                      />
                      <span style={{ fontSize: '0.8rem' }}>m² ×</span>
                      <input
                        type="text"
                        placeholder="€/m²"
                        style={{ width: '50px', padding: '0.25rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-color)', color: 'var(--text-main)' }}
                        id="quick-price"
                        onChange={(e) => {
                          const pr = parseFloat(e.target.value) || 0;
                          const fl = parseFloat((document.getElementById('quick-area') as HTMLInputElement).value) || 0;
                          (document.getElementById('quick-result') as HTMLElement).innerText = formatAcc(fl * pr) + " €";
                        }}
                      />
                      <span style={{ fontSize: '0.8rem' }}>=</span>
                      <strong id="quick-result" style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>0,00 €</strong>
                    </div>
                  </div>
                </div>
                <div className="grid-layout">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h3 className="cluster-title" style={{ margin: 0 }}>1. Ziel Vorgabe</h3>
                    <button
                      onClick={syncFromCalcToRev}
                      className="btn-sync"
                      style={{
                        padding: '0.3rem 0.6rem',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: 'var(--accent-color)',
                        border: '1px solid var(--accent-color)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>
                      IST-DATEN ÜBERNEHMEN
                    </button>
                  </div>
                  <div className="calculation-row">
                    <div className="input-group input-required">
                      <label>Miete / m² (Ziel)</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zielMietpreisQm ? 'input-synced' : ''}`} style={{ border: '1px solid var(--accent-color)', borderRadius: '8px' }}>
                        <input type="text" value={rev.zielMietpreisQm} onChange={(e) => updateRev("zielMietpreisQm", e.target.value)} onBlur={() => handleBlurRev("zielMietpreisQm")} onKeyDown={handleEnterKey} style={{ fontWeight: 700, color: syncedFields.zielMietpreisQm ? 'var(--success-color)' : 'var(--accent-color)' }} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                    <div className="input-group input-required">
                      <label>Kaltmiete / p.a. (Ziel)</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zielMietePA ? 'input-synced' : ''}`}>
                        <input type="text" value={rev.zielMietePA} onChange={(e) => updateRev("zielMietePA", e.target.value)} onBlur={() => handleBlurRev("zielMietePA")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="cluster-title">2. Konditionen & Steuern</h3>
                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label>BL (Grunderwerbsteuer)</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.bundesland ? 'input-synced' : ''}`}>
                        <select
                          value={rev.bundesland}
                          onChange={(e) => updateRev("bundesland", e.target.value)}
                          style={{ border: '1px solid var(--input-optional-border)', background: 'var(--input-optional-bg)', color: 'var(--input-optional-text)', appearance: 'none', cursor: 'pointer' }}
                        >
                          {Object.keys(grunderwerbsteuer).sort().map(bl => (
                            <option key={bl} value={bl}>{bl} ({formatAcc(grunderwerbsteuer[bl])}%)</option>
                          ))}
                        </select>
                        <span className="input-suffix">▼</span>
                      </div>
                    </div>

                    <div className="input-group output-calc">
                      <label>Gesamte NK <span style={{ fontWeight: 'bold' }}>- {formatAcc(revGesamtNkProzent)}%</span></label>
                      <div className="input-wrapper">
                        <input type="text" readOnly value={formatAcc(revGesamtNkProzent)} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label>Notar (Fixiert)</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.notarProzent ? 'input-synced' : ''}`}>
                        <input type="text" value={rev.notarProzent} readOnly style={{ opacity: 0.7, cursor: 'not-allowed', background: 'var(--bg-color)' }} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" checked={rev.hasMakler} onChange={(e) => updateRev("hasMakler", e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)' }} />
                        Maklerprovision
                      </label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.maklerProzent ? 'input-synced' : ''}`} style={{ opacity: rev.hasMakler ? 1 : 0.5, pointerEvents: rev.hasMakler ? 'auto' : 'none' }}>
                        <input type="text" value={rev.maklerProzent} onChange={(e) => updateRev("maklerProzent", e.target.value)} onBlur={() => handleBlurRev("maklerProzent")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>

                    <div className="input-group output-calc">
                      <label>Maklerprovision (€)</label>
                      <div className="input-wrapper" style={{ opacity: rev.hasMakler ? 1 : 0.5 }}>
                        <input type="text" readOnly value={formatAcc(revMaklerEuro)} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                  </div>

                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label>Instandhaltung / m²</label>
                      <div className="input-wrapper">
                        <input type="text" value={rev.instandhaltungQm} onChange={(e) => updateRev("instandhaltungQm", e.target.value)} onBlur={() => handleBlurRev("instandhaltungQm")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label>Hausverwaltung (Mo.)</label>
                      <div className="input-wrapper">
                        <input type="text" value={rev.verwaltungPm} onChange={(e) => updateRev("verwaltungPm", e.target.value)} onBlur={() => handleBlurRev("verwaltungPm")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label>Rücklage (Mo.)</label>
                      <div className="input-wrapper">
                        <input type="text" value={rev.ruecklagePm} onChange={(e) => updateRev("ruecklagePm", e.target.value)} onBlur={() => handleBlurRev("ruecklagePm")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                  </div>

                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label>Zins</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zins ? 'input-synced' : ''}`}>
                        <input type="text" value={rev.zins} onChange={(e) => updateRev("zins", e.target.value)} onBlur={() => handleBlurRev("zins")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label>Tilgung</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.tilgung ? 'input-synced' : ''}`}>
                        <input type="text" value={rev.tilgung} onChange={(e) => updateRev("tilgung", e.target.value)} onBlur={() => handleBlurRev("tilgung")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </CollapsibleSection>

            <section className="results-sticky">
              <CollapsibleSection
                title="Ergebnis (Break-Even)"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>}
                badge={`${formatAcc(revKaufpreis)} €`}
              >
                <section style={{ padding: '1rem', background: 'var(--output-calc-bg)', borderRadius: '0 0 12px 12px' }}>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--success-color)' }}>Ergebnis (Break-Even)</h3>

                  <div className="results-hero-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="result-card" style={{ padding: '1rem', border: '2px solid var(--success-color)' }}>
                      <span className="label">Max. Kaufpreis (vor NK)</span>
                      <span className="value positive" style={{ fontSize: '1.8rem' }}>
                        {formatAcc(revKaufpreis)} €
                      </span>
                    </div>

                    <div className="result-card" style={{ padding: '1rem' }}>
                      <span className="label">Gesamtkaufpreis (inkl. NK)</span>
                      <span className="value" style={{ fontSize: '1.4rem' }}>
                        {formatAcc(revMaxGesamtKaufpreis)} €
                      </span>
                    </div>
                  </div> {/* End Hero Vertical */}

                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    <span>Anteil NK: <strong>{formatAcc(revNkEuro)} €</strong></span>
                  </div>

                  {/* Szenario Regler in der Rückwärtsrechnung */}
                  <div style={{ marginTop: '2rem', borderTop: '1px solid var(--success-color)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600 }}>Szenario Analyse</span>
                      <button
                        onClick={() => setRentIncrease(15)}
                        style={{ background: 'var(--success-color)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        +15% Fix
                      </button>
                    </div>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>
                      <span>Mietsteigerung (+{rentIncrease}%)</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Max Kaufpreis neu: <span className="positive" style={{ fontWeight: 700 }}>{formatAcc(revKaufpreisNeu)} €</span></span>
                      <div style={{ background: 'rgba(34,197,94,0.1)', padding: '0.5rem', borderRadius: '6px', marginTop: '0.5rem', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--success-color)' }}>📈 Bei 15% Steigerung: <strong>{formatAcc(revKaufpreis * 1.15)} €</strong></span>
                      </div>
                    </label>
                    <input
                      type="range"
                      min="0" max="50" step="1"
                      value={rentIncrease}
                      onChange={(e) => setRentIncrease(parseInt(e.target.value))}
                      style={{ width: '100%', marginTop: '0.5rem', accentColor: 'var(--success-color)', height: '6px', cursor: 'pointer' }}
                    />
                  </div>
                </section>
              </CollapsibleSection>
            </section>
          </div>
        </div>
      )}

      {scanResult && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '450px', padding: '2rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid var(--success-color)' }}>
            <h2 style={{ color: 'var(--success-color)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Erfolgreich ausgefüllt!
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Folgende Werte wurden aus dem Bild extrahiert und direkt übernommen:</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              {scanResult.kaufpreis && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kaufpreis:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{scanResult.kaufpreis} €</strong>
                </div>
              )}
              {scanResult.wohnflaeche && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Wohnfläche:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{scanResult.wohnflaeche} m²</strong>
                </div>
              )}
              {scanResult.mietePM && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kaltmiete:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{scanResult.mietePM} €</strong>
                </div>
              )}
              {scanResult.baujahr && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Baujahr:</span>
                  <strong style={{ color: 'var(--text-main)' }}>{scanResult.baujahr}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setScanResult(null)}
                style={{ flex: 1, padding: '0.8rem', background: 'var(--success-color)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 700, boxShadow: '0 4px 12px rgba(34,197,94,0.3)' }}
              >
                Super, danke!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
