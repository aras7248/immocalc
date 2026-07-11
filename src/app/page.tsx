"use client";

import Image from "next/image";
import { useState, useEffect, useId, useRef } from "react";
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/context/ThemeContext';
import {
  calculateReverse,
  calculateStandard,
  LAND_TRANSFER_TAX_RATES_2026,
} from '@/lib/calculations';
import { supabase } from '@/lib/supabase';

// Interface for saved objects
interface SavedObject {
  id: string;
  db_id?: string;
  date: string;
  calc: CalcState;
  rev: ReverseState;
  mieten: string[];
  rentIncrease: number;
}

// Helper für Zahlen-Parsing und Formatierung
const parseNumber = (val: string | number) => {
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  if (!val) return 0;

  const normalized = val
    .trim()
    .replace(/[\s\u00a0€%]/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!normalized || !/^-?[\d.,]+$/.test(normalized)) return 0;

  const lastComma = normalized.lastIndexOf(",");
  const lastDot = normalized.lastIndexOf(".");
  let cleaned = normalized;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    cleaned = normalized.split(thousandsSeparator).join("");
    cleaned = cleaned.replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    cleaned = normalized.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0) {
    const dotCount = (normalized.match(/\./g) || []).length;
    const digitsAfterDot = normalized.length - lastDot - 1;
    const digitsBeforeDot = normalized.replace("-", "").slice(0, lastDot).length;
    const looksLikeGermanThousands = dotCount > 1 || (digitsAfterDot === 3 && digitsBeforeDot > 1);
    cleaned = looksLikeGermanThousands ? normalized.replace(/\./g, "") : normalized;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
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
  wohnflaeche: string;
  angebotspreis: string;
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
    <button
      type="button"
      className="tooltip-container tooltip-trigger"
      onClick={(e) => { e.stopPropagation(); onToggle(id); }}
      aria-expanded={isActive}
      aria-controls={`${id}-tooltip`}
      aria-label={`${title}: Erklärung anzeigen`}
    >
      <svg className="tooltip-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span id={`${id}-tooltip`} role="tooltip" className={`tooltip-text ${isActive ? 'is-active' : ''}`}>
        <strong>{title}</strong><br /><br />
        {text}
      </span>
    </button>
  );
};

// Wiederverwendbare klappbare Sektion
const CollapsibleSection = ({ title, icon, children, defaultOpen = true, badge }: {
  title: string, icon: React.ReactNode, children: React.ReactNode, defaultOpen?: boolean, badge?: string | number
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();
  return (
    <div style={{ marginBottom: isOpen ? 0 : '-0.5rem' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={contentId}
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
        <div id={contentId} style={{
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
  wohnflaeche: "268,00",
  angebotspreis: "350.000,00",
  bundesland: "NRW",
  notarProzent: "2,00",
  hasMakler: true,
  maklerProzent: "3,57",
  zins: "4,00",
  tilgung: "1,50",
  zielMietePA: "32.160,00",
  zielMietpreisQm: "10,00",
  instandhaltungQm: "1,00",
  verwaltungPm: "30,00",
  ruecklagePm: "50,00"
};

const emptyCalcState: CalcState = {
  objektname: "",
  anzahlEinheiten: "",
  kaufpreis: "",
  bundesland: "NRW",
  notarProzent: "",
  hasMakler: false,
  maklerProzent: "",
  zins: "",
  tilgung: "",
  mietePM: "",
  mietePA: "",
  wohnflaeche: "",
  baujahr: "",
  instandhaltungQm: "",
  verwaltungPm: "",
  ruecklagePm: ""
};

const emptyRevState: ReverseState = {
  wohnflaeche: "",
  angebotspreis: "",
  bundesland: "NRW",
  notarProzent: "",
  hasMakler: false,
  maklerProzent: "",
  zins: "",
  tilgung: "",
  zielMietePA: "",
  zielMietpreisQm: "",
  instandhaltungQm: "",
  verwaltungPm: "",
  ruecklagePm: ""
};

const SAVED_OBJECT_SCHEMA_VERSION = 2;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function mergeState<T extends object>(defaults: T, value: unknown): T {
  if (!isRecord(value)) return defaults;

  return Object.fromEntries(
    Object.entries(defaults as Record<string, unknown>).map(([key, fallback]) => {
      const candidate = value[key];
      return [key, typeof candidate === typeof fallback ? candidate : fallback];
    }),
  ) as T;
}

function parseSavedObjectRow(row: unknown): SavedObject | null {
  if (!isRecord(row) || typeof row.id !== "string" || !isRecord(row.calc_data)) return null;

  const payload = row.calc_data;
  const createdAt = typeof row.created_at === "string" ? new Date(row.created_at) : new Date();
  const parsedRentIncrease = typeof payload.rentIncrease === "number" && Number.isFinite(payload.rentIncrease)
    ? Math.min(Math.max(payload.rentIncrease, 0), 50)
    : 0;

  const parsedCalc = mergeState(initialCalcState, payload.calc);
  const parsedRev = mergeState(initialRevState, payload.rev);
  if (!isRecord(payload.rev) || typeof payload.rev.wohnflaeche !== "string") {
    parsedRev.wohnflaeche = parsedCalc.wohnflaeche;
  }
  if (!isRecord(payload.rev) || typeof payload.rev.angebotspreis !== "string") {
    parsedRev.angebotspreis = parsedCalc.kaufpreis;
  }

  return {
    id: row.id,
    db_id: row.id,
    date: Number.isNaN(createdAt.getTime())
      ? new Date().toISOString().split("T")[0]
      : createdAt.toISOString().split("T")[0],
    calc: parsedCalc,
    rev: parsedRev,
    mieten: Array.isArray(payload.mieten)
      ? payload.mieten.filter((entry): entry is string => typeof entry === "string").slice(0, 10)
      : [""],
    rentIncrease: parsedRentIncrease,
  };
}

export default function Home() {
  // === STANDARD KALKULATION STATE ===
  const [calc, setCalc] = useState<CalcState>(initialCalcState);
  const [rev, setRev] = useState<ReverseState>(initialRevState);

  const { user, signOut } = useAuth();
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
  const [isSaving, setIsSaving] = useState(false);
  const [syncedFields, setSyncedFields] = useState<Record<string, boolean>>({}); // NEU: Tracking synchronisierter Felder
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanButtonRef = useRef<HTMLButtonElement>(null);
  const scanDialogRef = useRef<HTMLDivElement>(null);
  const hasManualFederalStateChangeRef = useRef(false);

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
  const quickRentPotential = parseNumber(calc.wohnflaeche) * parseNumber(rev.zielMietpreisQm);

  const activePropertyIsSaved = savedObjects.some((object) => (
    object.calc.objektname.trim() === calc.objektname.trim()
    && parseNumber(object.calc.wohnflaeche) === parseNumber(calc.wohnflaeche)
    && parseNumber(object.calc.kaufpreis) === parseNumber(calc.kaufpreis)
  ));


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

        const loadedObjects = (data || [])
          .map(parseSavedObjectRow)
          .filter((entry): entry is SavedObject => entry !== null);
        setSavedObjects(loadedObjects);
      } catch (e) {
        console.error("Failed to load saved objects", e);
      }
    };
    loadFromSupabase();
  }, [user]);

  useEffect(() => {
    let isActive = true;

    const applyLocationDefault = async () => {
      try {
        const response = await fetch("/api/location", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json() as { federalState?: string | null };
        const federalState = data.federalState;
        if (!isActive || hasManualFederalStateChangeRef.current || !federalState) return;

        setCalc(prev => ({ ...prev, bundesland: federalState }));
        setRev(prev => ({ ...prev, bundesland: federalState }));
      } catch {
        // Ohne Geo-Header bleibt die sichere Standardauswahl NRW bestehen.
      }
    };

    void applyLocationDefault();

    return () => {
      isActive = false;
    };
  }, []);

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

  useEffect(() => {
    if (!scanResult) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : scanButtonRef.current;
    scanDialogRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setScanResult(null);
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      previouslyFocused?.focus();
    };
  }, [scanResult]);


  // Helper zum Aktualisieren des States (Standard & Synchronisation nach unten)
  const updateCalc = (field: keyof CalcState, value: string | boolean) => {
    if (field === "wohnflaeche" && typeof value === "string") {
      setRev(prev => {
        const next = { ...prev, wohnflaeche: value };
        const area = parseNumber(value);
        if (area > 0) {
          next.zielMietePA = formatAcc(parseNumber(next.zielMietpreisQm) * area * 12);
        }
        return next;
      });
    }

    if (field === "kaufpreis" && typeof value === "string") {
      setRev(prev => ({ ...prev, angebotspreis: value }));
    }

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

  const updateFederalState = (value: string) => {
    hasManualFederalStateChangeRef.current = true;
    setCalc(prev => ({ ...prev, bundesland: value }));
    setRev(prev => ({ ...prev, bundesland: value }));
    setSyncedFields(prev => ({ ...prev, bundesland: false }));
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
      updateCalc(field, formatAcc(Math.max(val, 0)));
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

    if (!file.type.startsWith("image/")) {
      alert("Bitte wähle eine Bilddatei aus.");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      alert("Das Bild ist größer als 12 MB. Bitte verkleinere es vor dem Scan.");
      return;
    }

    setIsScanning(true);
    let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | null = null;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker('deu');
      const { data: { text } } = await worker.recognize(file);

      processOcrText(text);
    } catch (error) {
      console.error("OCR Error:", error);
      alert("Fehler bei der Texterkennung. Bitte versuche es mit einem klareren Bild.");
    } finally {
      if (worker) await worker.terminate();
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
      text.match(/\b(?:18|19|20)\d{2}\b/);
    if (yearMatch) results.baujahr = yearMatch[1] || yearMatch[0];

    if (Object.keys(results).length > 0) {
      setScanResult(results);
    } else {
      alert("Es konnten keine eindeutigen Daten erkannt werden. Bitte stelle sicher, dass Kaufpreis, Fläche oder Miete im Text sichtbar sind.");
    }
  };

  const applyScanResult = () => {
    if (!scanResult) return;
    if (scanResult.kaufpreis) updateCalc("kaufpreis", scanResult.kaufpreis);
    if (scanResult.wohnflaeche) updateCalc("wohnflaeche", scanResult.wohnflaeche);
    if (scanResult.mietePM) updateCalc("mietePM", scanResult.mietePM);
    if (scanResult.baujahr) updateCalc("baujahr", scanResult.baujahr);
    setScanResult(null);
  };

  // Berechnungen Standard
  const kaufpreis = parseNumber(calc.kaufpreis) || 0;
  const wohnflaeche = parseNumber(calc.wohnflaeche) || 0;
  const mietePA = parseNumber(calc.mietePA) || 0;
  const zins = parseNumber(calc.zins) || 0;
  const tilgung = parseNumber(calc.tilgung) || 0;
  const [rentIncrease, setRentIncrease] = useState<number>(0);
  const grunderwerbsteuer: Record<string, number> = LAND_TRANSFER_TAX_RATES_2026;
  const standardResult = calculateStandard({
    federalState: calc.bundesland,
    notaryPercent: parseNumber(calc.notarProzent),
    brokerPercent: parseNumber(calc.maklerProzent),
    hasBroker: calc.hasMakler,
    purchasePrice: kaufpreis,
    annualRent: mietePA,
    livingArea: wohnflaeche,
    maintenancePerSqmMonthly: parseNumber(calc.instandhaltungQm),
    managementMonthly: parseNumber(calc.verwaltungPm),
    reserveMonthly: parseNumber(calc.ruecklagePm),
    interestPercent: zins,
    repaymentPercent: tilgung,
    scenarioRentIncreasePercent: rentIncrease,
  });
  const standardCase = rentIncrease > 0 ? standardResult.scenario : standardResult.base;

  const gesamtNkProzent = standardResult.acquisitionCosts.totalPercent;
  const maklerEuro = standardResult.acquisitionCosts.brokerAmount;
  const nkEuro = standardResult.acquisitionCosts.totalAmount;
  const summeGesamt = standardResult.totalInvestment;
  const mietePmSzenario = standardCase.monthlyRent;
  const cashFlowPA = standardCase.cashFlowAnnual;
  const cashFlowPM = standardCase.cashFlowMonthly;
  const mietpreisQm = standardCase.monthlyRentPerSqm;
  const kaufpreisQm = standardResult.squareMeterValues.totalInvestmentPerSqm;
  const zinsEuroPA = standardResult.financing.interestAnnual;
  const tilgungEuroPA = standardResult.financing.repaymentAnnual;
  const tilgungPM = standardResult.financing.repaymentMonthly;
  const bruttoRendite = standardCase.grossRentalYieldPercent;
  const nettoRendite = standardCase.netRentalYieldPercent;
  const kaufpreisFaktor = standardCase.purchasePriceFactor;
  const roe = standardCase.returnOnEquityPercent;
  const laufendeKostenPM = standardResult.operatingCosts.totalMonthly;

  const kostenAnteil = standardCase.chart.operatingCosts.percentOfRent;
  const zinsAnteil = standardCase.chart.interest.percentOfRent;
  const tilgungAnteil = standardCase.chart.repayment.percentOfRent;
  const cashflowAnteil = standardCase.chart.positiveCashFlow.percentOfRent;
  const tilgungAusMietePA = standardCase.chart.repayment.annualAmount;
  const deckungslueckePA = standardCase.chart.coverageGapAnnual;

  const degKosten = kostenAnteil;
  const degZins = degKosten + zinsAnteil;
  const degTilgung = degZins + tilgungAnteil;
  const degCF = degTilgung + cashflowAnteil;

  const updateRev = (field: keyof ReverseState, value: string | boolean) => {
    // Wenn ein Feld manuell geändert wird, verliert es den Synchronisations-Status
    setSyncedFields(prev => ({ ...prev, [field]: false }));

    setRev(prev => {
      const next = { ...prev, [field]: value };

      // Fläche und Ziel-m²-Miete bestimmen gemeinsam die Ziel-Jahresmiete.
      if ((field === "zielMietpreisQm" || field === "wohnflaeche") && typeof value === "string") {
        const qm = parseNumber(next.zielMietpreisQm);
        const fl = parseNumber(next.wohnflaeche);
        if (fl > 0) next.zielMietePA = formatAcc(qm * fl * 12);
      }

      // Synchronisation: Wenn Ziel-Jahresmiete geändert wird, berechne m²-Miete
      if (field === "zielMietePA" && typeof value === "string") {
        const pa = parseNumber(value);
        const fl = parseNumber(next.wohnflaeche);
        if (fl > 0) next.zielMietpreisQm = formatAcc(pa / fl / 12);
      }

      return next;
    });
  };

  const handleBlurRev = (field: keyof ReverseState) => {
    const rawVal = rev[field];
    if (typeof rawVal === "string") {
      const val = parseNumber(rawVal);
      updateRev(field, formatAcc(Math.max(val, 0)));
    }
  };

  const reverseResult = calculateReverse({
    federalState: rev.bundesland,
    notaryPercent: parseNumber(rev.notarProzent),
    brokerPercent: parseNumber(rev.maklerProzent),
    hasBroker: rev.hasMakler,
    targetAnnualRent: parseNumber(rev.zielMietePA),
    offeredPurchasePrice: parseNumber(calc.kaufpreis),
    livingArea: parseNumber(calc.wohnflaeche),
    maintenancePerSqmMonthly: parseNumber(rev.instandhaltungQm),
    managementMonthly: parseNumber(rev.verwaltungPm),
    reserveMonthly: parseNumber(rev.ruecklagePm),
    interestPercent: parseNumber(rev.zins),
    repaymentPercent: parseNumber(rev.tilgung),
    scenarioRentIncreasePercent: rentIncrease,
  });
  const revGesamtNkProzent = reverseResult.base.acquisitionCosts.totalPercent;
  const revKaufpreis = reverseResult.base.maxPurchasePrice;
  const revMaxGesamtKaufpreis = reverseResult.base.totalInvestment;
  const revNkEuro = reverseResult.base.acquisitionCosts.totalAmount;
  const revMaklerEuro = reverseResult.base.acquisitionCosts.brokerAmount;
  const revKaufpreisNeu = reverseResult.scenario.maxPurchasePrice;
  const revLaufendeKostenPA = reverseResult.operatingCosts.totalAnnual;
  const revAngebot = reverseResult.offerAnalysis;

  // Manuelle Synchronisation
  const syncFromCalcToRev = () => {
    hasManualFederalStateChangeRef.current = true;
    const syncedArea = parseNumber(calc.wohnflaeche);
    const syncedTargetPrice = formatAcc(syncedArea > 0 ? parseNumber(calc.mietePA) / syncedArea / 12 : 0);
    setRev(prev => ({
      ...prev,
      bundesland: calc.bundesland,
      notarProzent: calc.notarProzent,
      hasMakler: calc.hasMakler,
      maklerProzent: calc.maklerProzent,
      zins: calc.zins,
      tilgung: calc.tilgung,
      instandhaltungQm: calc.instandhaltungQm,
      verwaltungPm: calc.verwaltungPm,
      ruecklagePm: calc.ruecklagePm,
      wohnflaeche: calc.wohnflaeche,
      angebotspreis: calc.kaufpreis,
      zielMietePA: calc.mietePA,
      zielMietpreisQm: syncedTargetPrice
    }));
    // Alle synchronisierten Felder markieren
    setSyncedFields({
      bundesland: true,
      notarProzent: true,
      hasMakler: true,
      maklerProzent: true,
      zins: true,
      tilgung: true,
      instandhaltungQm: true,
      verwaltungPm: true,
      ruecklagePm: true,
      wohnflaeche: true,
      angebotspreis: true,
      zielMietePA: true,
      zielMietpreisQm: true
    });

    // Trigger Flash Effekt
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 800);
  };

  const handleSaveObject = async () => {
    if (isSaving) return;
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

    setIsSaving(true);
    try {
      const payload = {
        user_id: user.id,
        calc_data: {
          schemaVersion: SAVED_OBJECT_SCHEMA_VERSION,
          calc: { ...calc, objektname: nameToSave },
          rev,
          mieten,
          rentIncrease,
        }
      };

      if (existingDbId) {
        const { error } = await supabase
          .from('immocalc_saved_objects')
          .update(payload)
          .eq('id', existingDbId)
          .eq('user_id', user.id);

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

      setSavedObjects(
        (data || [])
          .map(parseSavedObjectRow)
          .filter((entry): entry is SavedObject => entry !== null),
      );

      setIsSavedObjectsOpen(true);
      setIsObjektInfoOpen(false);
    } catch (e) {
      console.error("Speichern fehlgeschlagen:", e);
      alert("Das Objekt konnte nicht gespeichert werden. Bitte prüfe deine Verbindung und versuche es erneut.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadObject = (obj: SavedObject) => {
    hasManualFederalStateChangeRef.current = true;
    setCalc(obj.calc);
    setRev({
      ...(obj.rev || rev),
      wohnflaeche: obj.calc.wohnflaeche,
      angebotspreis: obj.calc.kaufpreis,
    });
    setMieten(obj.mieten || [""]);
    setRentIncrease(obj.rentIncrease || 0);
  };

  const handleClearData = () => {
    if (window.confirm("Möchtest du wirklich alle eingegebenen Werte löschen?")) {
      setCalc(emptyCalcState);
      setRev(emptyRevState);
      setSyncedFields({});
      setMieten([""]);
      setRentIncrease(0);
      setScanResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsFlashActive(true);
      setTimeout(() => setIsFlashActive(false), 800);
    }
  };

  const handleDeleteObject = async (id: string) => {
    const obj = savedObjects.find(o => o.id === id);
    if (obj?.db_id && user) {
      const shouldDelete = window.confirm(`Möchtest du „${obj.calc.objektname || "Unbenanntes Objekt"}“ wirklich löschen?`);
      if (!shouldDelete) return;

      const { error } = await supabase
        .from('immocalc_saved_objects')
        .delete()
        .eq('id', obj.db_id)
        .eq('user_id', user.id);

      if (error) {
        console.error("Löschen fehlgeschlagen:", error);
        alert("Das Objekt konnte nicht gelöscht werden. Bitte versuche es erneut.");
        return;
      }
    }
    setSavedObjects(savedObjects.filter(o => o.id !== id));
  };

  return (
    <div className="app-container">
      {/* ═══ TOP BAR — ImmoCow product family style ═══ */}
      <header className="app-topbar">
        <div className="app-brand">
          <Image
            className="app-brand__mark brand-logo brand-logo--light"
            src="/brand/logo-icon.png"
            alt="ImmoCow"
            width={52}
            height={52}
            priority
          />
          <Image
            className="app-brand__mark brand-logo brand-logo--dark"
            src="/brand/logo-icon-white.png"
            alt=""
            width={52}
            height={52}
            priority
          />
          <div>
            <h1 className="app-brand__title">ImmoCalc</h1>
            <span className="app-brand__eyebrow">Deal-Analyse von ImmoCow</span>
          </div>
        </div>

        {/* Action Buttons — Right-aligned icon row */}
        <div className="app-topbar__actions">
          {/* Scan Button */}
          <button
            ref={scanButtonRef}
            type="button"
            className="icon-button icon-button--success"
            onClick={() => fileInputRef.current?.click()}
            disabled={isScanning}
            title="Exposé scannen"
            aria-label={isScanning ? "Exposé wird gescannt" : "Exposé scannen"}
          >
            {isScanning ? (
              <div className="spinner-small" aria-hidden="true" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            )}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleScanImage} accept="image/*" className="sr-only" tabIndex={-1} />

          {/* Eingaben vollständig leeren */}
          <button
            type="button"
            className="icon-button icon-button--danger app-action--secondary"
            onClick={handleClearData}
            title="Alle Werte löschen"
            aria-label="Alle Werte löschen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>

          {/* Save Button war hier, wurde zu Baujahr verschoben */}

          {/* Objekt-Infos Toggle */}
          <button
            type="button"
            className={`icon-button app-action--object${isObjektInfoOpen ? ' icon-button--active' : ''}`}
            onClick={() => { setIsObjektInfoOpen(!isObjektInfoOpen); if (!isObjektInfoOpen) setIsSavedObjectsOpen(false); }}
            title="Objekt-Infos"
            aria-label="Objekt-Informationen anzeigen"
            aria-pressed={isObjektInfoOpen}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </button>

          {/* Saved Objects Toggle */}
          <button
            type="button"
            className={`icon-button${isSavedObjectsOpen ? ' icon-button--active' : ''}`}
            onClick={() => { setIsSavedObjectsOpen(!isSavedObjectsOpen); if (!isSavedObjectsOpen) setIsObjektInfoOpen(false); }}
            title={`Gespeicherte Objekte (${savedObjects.length})`}
            aria-label={`Gespeicherte Objekte anzeigen, ${savedObjects.length} vorhanden`}
            aria-pressed={isSavedObjectsOpen}
            style={{ position: 'relative' }}
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
          <ThemeToggle compact />
          <button type="button" className="app-signout" onClick={() => void signOut()}>
            Abmelden
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
              type="button"
              onClick={() => setIsObjektInfoOpen(false)}
              aria-label="Objekt-Informationen schließen"
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem', display: 'flex' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </button>
          </div>
          <div className="calculation-row">
            <div className="input-group input-optional">
              <label htmlFor="unit-count">Anzahl Einheiten</label>
              <div className="input-wrapper">
                <input id="unit-count" inputMode="numeric" type="text" value={calc.anzahlEinheiten} onChange={(e) => updateCalc("anzahlEinheiten", e.target.value)} placeholder="z.B. 3" onKeyDown={handleEnterKey} />
              </div>
            </div>
            <div className="input-group input-optional">
              <label htmlFor="construction-year">Baujahr</label>
              <div className="input-wrapper">
                <input id="construction-year" inputMode="numeric" type="text" value={calc.baujahr} onChange={(e) => updateCalc("baujahr", e.target.value)} onKeyDown={handleEnterKey} />
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
              type="button"
              onClick={() => setIsSavedObjectsOpen(false)}
              aria-label="Gespeicherte Objekte schließen"
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
                  className="saved-object"
                >
                  <button type="button" className="saved-object__load" onClick={() => handleLoadObject(obj)}>
                    <span className="sr-only">Objekt laden: </span>
                    <span style={{ flex: 1, overflow: 'hidden', paddingRight: '0.5rem', textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {obj.calc.objektname || "Unbenanntes Objekt"}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {obj.date} · {obj.calc.kaufpreis} €
                    </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="saved-object__delete"
                    onClick={(e) => { e.stopPropagation(); handleDeleteObject(obj.id); }}
                    aria-label={`${obj.calc.objektname || "Unbenanntes Objekt"} löschen`}
                    title="Objekt löschen"
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
      <div className="tabs-container" role="tablist" aria-label="Rechenmodus">
        <button
          type="button"
          role="tab"
          id="standard-tab"
          aria-selected={activeTab === 'standard'}
          aria-controls="standard-panel"
          className={`tab-button ${activeTab === 'standard' ? 'active' : ''}`}
          onClick={() => setActiveTab('standard')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          Standard-Rechner
        </button>
        <button
          type="button"
          role="tab"
          id="reverse-tab"
          aria-selected={activeTab === 'reverse'}
          aria-controls="reverse-panel"
          className={`tab-button ${activeTab === 'reverse' ? 'active' : ''}`}
          onClick={() => setActiveTab('reverse')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
          Rückwärts-Rechner
        </button>
      </div>

      <section className={`active-property${isFlashActive ? ' active-property--flash' : ''}`} aria-labelledby="active-property-title">
        <div className="active-property__heading">
          <span id="active-property-title">Aktive Immobilie</span>
          <button type="button" className="active-property__sync" onClick={syncFromCalcToRev}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            Standardwerte übernehmen
          </button>
        </div>

        <div className="active-property__fields">
          <label className="active-property__field active-property__field--name">
            <span>Straße / Objekt</span>
            <input
              type="text"
              value={calc.objektname}
              onChange={(event) => updateCalc("objektname", event.target.value)}
              placeholder="z. B. Musterstraße 1"
              onKeyDown={handleEnterKey}
            />
          </label>
          <label className="active-property__field">
            <span>Wohnfläche</span>
            <span className="active-property__input-wrap">
              <input
                inputMode="decimal"
                type="text"
                value={calc.wohnflaeche}
                onChange={(event) => updateCalc("wohnflaeche", event.target.value)}
                onBlur={() => handleBlurCalc("wohnflaeche")}
                onKeyDown={handleEnterKey}
              />
              <span aria-hidden="true">m²</span>
            </span>
          </label>
          <label className="active-property__field">
            <span>Kaufpreis</span>
            <span className="active-property__input-wrap">
              <input
                inputMode="decimal"
                type="text"
                value={calc.kaufpreis}
                onChange={(event) => updateCalc("kaufpreis", event.target.value)}
                onBlur={() => handleBlurCalc("kaufpreis")}
                onKeyDown={handleEnterKey}
              />
              <span aria-hidden="true">€</span>
            </span>
          </label>
          <button
            type="button"
            className={`active-property__save${activePropertyIsSaved ? ' active-property__save--saved' : ''}`}
            onClick={handleSaveObject}
            disabled={isSaving || activePropertyIsSaved}
            title={activePropertyIsSaved ? "Immobilie ist gespeichert" : "Immobilie speichern"}
            aria-label={isSaving ? "Immobilie wird gespeichert" : activePropertyIsSaved ? "Immobilie ist gespeichert" : "Immobilie speichern"}
          >
            {isSaving ? (
              <span className="spinner-small" aria-hidden="true" />
            ) : (
              <>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                {activePropertyIsSaved && (
                  <span className="active-property__saved-check" aria-hidden="true">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </span>
                )}
              </>
            )}
          </button>
        </div>
        <p className="active-property__hint">Alle folgenden Kalkulationen verwenden diese Objektdaten.</p>
      </section>

      {activeTab === 'standard' && (
        <div id="standard-panel" role="tabpanel" aria-labelledby="standard-tab" className="dashboard-layout">

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
                    <label htmlFor="purchase-price">Kaufpreis</label>
                    <div className="input-wrapper">
                      <input id="purchase-price" inputMode="decimal" type="text" value={calc.kaufpreis} onChange={(e) => updateCalc("kaufpreis", e.target.value)} onBlur={() => handleBlurCalc("kaufpreis")} onKeyDown={handleEnterKey} required aria-required="true" />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>

                  <div className="input-group input-required">
                    <label htmlFor="living-area">Wohnfläche</label>
                    <div className="input-wrapper">
                      <input id="living-area" inputMode="decimal" type="text" value={calc.wohnflaeche} onChange={(e) => updateCalc("wohnflaeche", e.target.value)} onBlur={() => handleBlurCalc("wohnflaeche")} onKeyDown={handleEnterKey} required aria-required="true" />
                      <span className="input-suffix">m²</span>
                    </div>
                  </div>

                  <div className="input-group" style={{ visibility: 'hidden' }}></div>
                </div>



                <h3 className="cluster-title">2. Kaufnebenkosten</h3>
                <div className="calculation-row">
                  <div className="input-group input-required">
                    <label htmlFor="federal-state">Bundesland (Grunderwerbsteuer)</label>
                    <div className="input-wrapper">
                      <select
                        id="federal-state"
                        value={calc.bundesland}
                        onChange={(e) => updateFederalState(e.target.value)}
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
                    <label htmlFor="acquisition-costs">Gesamte NK <span style={{ fontWeight: 'bold' }}>- {formatAcc(gesamtNkProzent)}%</span></label>
                    <div className="input-wrapper">
                      <input id="acquisition-costs" type="text" readOnly value={formatAcc(nkEuro)} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                </div>

                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="notary-percent">Notar</label>
                    <div className="input-wrapper">
                      <input
                        id="notary-percent"
                        inputMode="decimal"
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
                      <input id="has-broker" type="checkbox" checked={calc.hasMakler} onChange={(e) => updateCalc("hasMakler", e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)' }} />
                      Maklerprovision
                    </label>
                    <div className="input-wrapper" style={{ opacity: calc.hasMakler ? 1 : 0.5, pointerEvents: calc.hasMakler ? 'auto' : 'none' }}>
                      <input id="broker-percent" aria-label="Maklerprovision in Prozent" inputMode="decimal" type="text" value={calc.maklerProzent} onChange={(e) => updateCalc("maklerProzent", e.target.value)} onBlur={() => handleBlurCalc("maklerProzent")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>

                  <div className="input-group output-calc">
                    <label htmlFor="broker-amount">Maklerprovision (€)</label>
                    <div className="input-wrapper" style={{ opacity: calc.hasMakler ? 1 : 0.5 }}>
                      <input id="broker-amount" type="text" readOnly value={formatAcc(maklerEuro)} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                </div>

                <h3 className="cluster-title">3. Einnahmen (Kaltmiete)</h3>

                <div className="calculation-row">
                  <div className="input-group input-required">
                    <label htmlFor="monthly-rent">Kaltmiete / Monat</label>
                    <div className="input-wrapper">
                      <input
                        id="monthly-rent"
                        inputMode="decimal"
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
                    <label htmlFor="annual-rent">Kaltmiete / p.a.</label>
                    <div className="input-wrapper">
                      <input
                        id="annual-rent"
                        inputMode="decimal"
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
                    <span aria-hidden="true" style={{ visibility: 'hidden', minHeight: '1.5rem' }}>Einheiten</span>
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

                <h3 className="cluster-title">4. Laufende, nicht umlagefähige Kosten</h3>
                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="maintenance-monthly">Instandhaltung / m² / Monat</label>
                    <div className="input-wrapper">
                      <input id="maintenance-monthly" inputMode="decimal" type="text" value={calc.instandhaltungQm} onChange={(e) => updateCalc("instandhaltungQm", e.target.value)} onBlur={() => handleBlurCalc("instandhaltungQm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="management-monthly">Verwaltung / Monat</label>
                    <div className="input-wrapper">
                      <input id="management-monthly" inputMode="decimal" type="text" value={calc.verwaltungPm} onChange={(e) => updateCalc("verwaltungPm", e.target.value)} onBlur={() => handleBlurCalc("verwaltungPm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="reserve-monthly">Rücklage / Monat</label>
                    <div className="input-wrapper">
                      <input id="reserve-monthly" inputMode="decimal" type="text" value={calc.ruecklagePm} onChange={(e) => updateCalc("ruecklagePm", e.target.value)} onBlur={() => handleBlurCalc("ruecklagePm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                </div>

                <h3 className="cluster-title">5. Finanzierung</h3>
                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="interest-percent">Zins</label>
                    <div className="input-wrapper">
                      <input id="interest-percent" inputMode="decimal" type="text" value={calc.zins} onChange={(e) => updateCalc("zins", e.target.value)} onBlur={() => handleBlurCalc("zins")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="repayment-percent">Tilgung</label>
                    <div className="input-wrapper">
                      <input id="repayment-percent" inputMode="decimal" type="text" value={calc.tilgung} onChange={(e) => updateCalc("tilgung", e.target.value)} onBlur={() => handleBlurCalc("tilgung")} onKeyDown={handleEnterKey} />
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
            badge={`${formatAcc(roe)}% CoC`}
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
                  <button
                    type="button"
                    className="tooltip-container tooltip-trigger"
                    onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'dealcheck' ? null : 'dealcheck'); }}
                    aria-label="Cash-on-Cash-Einordnung anzeigen"
                    aria-expanded={activeTooltip === 'dealcheck'}
                    aria-controls="dealcheck-tooltip"
                    style={{
                      position: 'absolute',
                      right: '0',
                      top: '32%',
                      transform: 'translateY(-50%)',
                      color: roe > 12 ? 'var(--success-color)' : roe >= 5 ? 'var(--warning-color)' : 'var(--danger-color)',
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
                    <span id="dealcheck-tooltip" role="tooltip" className={`tooltip-text ${activeTooltip === 'dealcheck' ? 'is-active' : ''}`} style={{ right: '110%', left: 'auto', bottom: '10%', transform: 'none', width: '280px' }}>
                      <strong>Einordnung des Szenarios:</strong><br /><br />
                      {roe > 12 ? (
                        <>
                          <span style={{ color: 'var(--success-color)', fontWeight: 700 }}>Starker positiver Cash-on-Cash-Wert</span><br />
                          Die laufenden Kosten und die Annuität sind in diesem Szenario gedeckt. Prüfe zusätzlich Leerstand, Steuern und den tatsächlichen Darlehensvertrag.
                        </>
                      ) : roe >= 5 ? (
                        <>
                          <span style={{ color: 'var(--warning-color)', fontWeight: 700 }}>Positiver Cash-on-Cash-Wert</span><br />
                          Das Szenario liefert {formatAcc(roe)}% auf die als Eigenkapital angesetzten Kaufnebenkosten. Zusätzliche Risiken sind noch nicht enthalten.
                        </>
                      ) : (
                        <>
                          <span style={{ color: 'var(--danger-color)', fontWeight: 700 }}>Niedriger oder negativer Cashflow</span><br />
                          Nach laufenden Kosten und Annuität verbleiben {formatAcc(cashFlowPA)} € pro Jahr. Prüfe Kaufpreis, Finanzierung und Kostenannahmen.
                        </>
                      )}
                    </span>
                  </button>
                </div>

                {/* Rendite-Analyse Inline */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                  <div className="result-card" style={{ padding: '0.75rem', border: '1px solid var(--accent-color)', background: 'rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="label" style={{ color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
                        Cash-on-Cash-Rendite
                      </span>
                      <InfoTooltip
                        id="roe"
                        title="Cash-on-Cash-Rendite"
                        text="Berechnung: Jahrescashflow nach laufenden Kosten und Annuität geteilt durch die als Eigenkapital angesetzten Kaufnebenkosten. Modellannahme: Der Kaufpreis wird vollständig finanziert."
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
                          text="Berechnung: Jahreskaltmiete minus Instandhaltung, Verwaltung und Rücklage, geteilt durch die Gesamt-Investition. Leerstand und Steuern sind nicht enthalten."
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

                <div className="metric-summary" aria-label="Laufende Kosten und Netto-Mietertrag">
                  <div>
                    <span>Laufende Kosten / Monat</span>
                    <strong>-{formatAcc(laufendeKostenPM)} €</strong>
                  </div>
                  <div>
                    <span>Netto-Mietertrag / Monat</span>
                    <strong>{formatAcc(standardCase.noiMonthly)} €</strong>
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
                        text="Monatliche Kaltmiete minus laufende nicht umlagefähige Kosten und Annuität (Zins + Tilgung)."
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
                        text="Jahreskaltmiete minus laufende nicht umlagefähige Kosten und jährliche Annuität. Leerstand und Steuern sind nicht enthalten."
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
                        ? `conic-gradient(var(--warning-color) 0% ${degKosten}%, var(--danger-color) ${degKosten}% ${degZins}%, var(--accent-color) ${degZins}% ${degTilgung}%, var(--success-color) ${degTilgung}% ${degCF}%, var(--border) ${degCF}% 100%)`
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
                        <div style={{ width: '10px', height: '10px', background: 'var(--warning-color)', borderRadius: '2px' }}></div>
                        <div style={{ flex: 1 }}>Laufende Kosten</div>
                        <div style={{ fontWeight: 600 }}>{Math.round(kostenAnteil)}%</div>
                      </div>
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
        <div id="reverse-panel" role="tabpanel" aria-labelledby="reverse-tab" style={{ padding: '0' }}>
          <div className="dashboard-layout">
            <CollapsibleSection
              title="Ziel-Vorgabe & Konditionen"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>}
            >
              <section style={{ padding: '1rem' }}>
                {/* SCHNELL-MIET-CHECKER INNERHALB DER ZIEL-VORGABE */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <div className="glass-panel quick-rent-checker">
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)' }}>Miet-Potenzial Check (steuert die Rückwärtsrechnung):</span>
                    <div className="quick-rent-checker__formula">
                      <input
                        aria-label="Fläche für Mietpotenzial"
                        inputMode="decimal"
                        type="text"
                        placeholder="Fläche"
                        value={calc.wohnflaeche}
                        onChange={(e) => updateCalc("wohnflaeche", e.target.value)}
                      />
                      <span style={{ fontSize: '0.8rem' }}>m² ×</span>
                      <input
                        aria-label="Mietpreis pro Quadratmeter für Mietpotenzial"
                        inputMode="decimal"
                        type="text"
                        placeholder="€/m²"
                        value={rev.zielMietpreisQm}
                        onChange={(e) => updateRev("zielMietpreisQm", e.target.value)}
                      />
                      <span style={{ fontSize: '0.8rem' }}>=</span>
                      <output aria-label="Monatliche Kaltmiete" style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 800 }}>{formatAcc(quickRentPotential)} € / Monat</output>
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
                      <label htmlFor="target-rent-sqm">Miete / m² (Ziel)</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zielMietpreisQm ? 'input-synced' : ''}`} style={{ border: '1px solid var(--accent-color)', borderRadius: '8px' }}>
                        <input id="target-rent-sqm" inputMode="decimal" type="text" value={rev.zielMietpreisQm} onChange={(e) => updateRev("zielMietpreisQm", e.target.value)} onBlur={() => handleBlurRev("zielMietpreisQm")} onKeyDown={handleEnterKey} style={{ fontWeight: 700, color: syncedFields.zielMietpreisQm ? 'var(--success-color)' : 'var(--accent-color)' }} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                    <div className="input-group input-required">
                      <label htmlFor="target-annual-rent">Kaltmiete / p.a. (Ziel)</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zielMietePA ? 'input-synced' : ''}`}>
                        <input id="target-annual-rent" inputMode="decimal" type="text" value={rev.zielMietePA} onChange={(e) => updateRev("zielMietePA", e.target.value)} onBlur={() => handleBlurRev("zielMietePA")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                  </div>
                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label>Erforderliche Miete für Angebot</label>
                      <div className="input-wrapper" style={{ background: 'var(--output-calc-bg)' }}>
                        <output style={{ padding: '0.75rem', fontWeight: 800, color: 'var(--accent-color)' }}>{formatAcc(revAngebot.requiredMonthlyRentPerSqm)} €/m²</output>
                      </div>
                    </div>
                  </div>

                  <h3 className="cluster-title">2. Konditionen & Steuern</h3>
                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label htmlFor="reverse-federal-state">Bundesland (Grunderwerbsteuer)</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.bundesland ? 'input-synced' : ''}`}>
                        <select
                          id="reverse-federal-state"
                          value={rev.bundesland}
                          onChange={(e) => updateFederalState(e.target.value)}
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
                      <label htmlFor="reverse-acquisition-percent">Gesamte NK <span style={{ fontWeight: 'bold' }}>- {formatAcc(revGesamtNkProzent)}%</span></label>
                      <div className="input-wrapper">
                        <input id="reverse-acquisition-percent" type="text" readOnly value={formatAcc(revGesamtNkProzent)} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>
                  </div>

                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label htmlFor="reverse-notary-percent">Notar (Fixiert)</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.notarProzent ? 'input-synced' : ''}`}>
                        <input id="reverse-notary-percent" type="text" value={rev.notarProzent} readOnly style={{ opacity: 0.7, background: 'var(--bg-color)' }} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input id="reverse-has-broker" type="checkbox" checked={rev.hasMakler} onChange={(e) => updateRev("hasMakler", e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)' }} />
                        Maklerprovision
                      </label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.maklerProzent ? 'input-synced' : ''}`} style={{ opacity: rev.hasMakler ? 1 : 0.5, pointerEvents: rev.hasMakler ? 'auto' : 'none' }}>
                        <input id="reverse-broker-percent" aria-label="Maklerprovision in Prozent" inputMode="decimal" type="text" value={rev.maklerProzent} onChange={(e) => updateRev("maklerProzent", e.target.value)} onBlur={() => handleBlurRev("maklerProzent")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>

                    <div className="input-group output-calc">
                      <label htmlFor="reverse-broker-amount">Maklerprovision (€)</label>
                      <div className="input-wrapper" style={{ opacity: rev.hasMakler ? 1 : 0.5 }}>
                        <input id="reverse-broker-amount" type="text" readOnly value={formatAcc(revMaklerEuro)} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                  </div>

                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label htmlFor="reverse-maintenance">Instandhaltung / m² / Monat</label>
                      <div className="input-wrapper">
                        <input id="reverse-maintenance" inputMode="decimal" type="text" value={rev.instandhaltungQm} onChange={(e) => updateRev("instandhaltungQm", e.target.value)} onBlur={() => handleBlurRev("instandhaltungQm")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label htmlFor="reverse-management">Hausverwaltung / Monat</label>
                      <div className="input-wrapper">
                        <input id="reverse-management" inputMode="decimal" type="text" value={rev.verwaltungPm} onChange={(e) => updateRev("verwaltungPm", e.target.value)} onBlur={() => handleBlurRev("verwaltungPm")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label htmlFor="reverse-reserve">Rücklage / Monat</label>
                      <div className="input-wrapper">
                        <input id="reverse-reserve" inputMode="decimal" type="text" value={rev.ruecklagePm} onChange={(e) => updateRev("ruecklagePm", e.target.value)} onBlur={() => handleBlurRev("ruecklagePm")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                  </div>

                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label htmlFor="reverse-interest">Zins</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zins ? 'input-synced' : ''}`}>
                        <input id="reverse-interest" inputMode="decimal" type="text" value={rev.zins} onChange={(e) => updateRev("zins", e.target.value)} onBlur={() => handleBlurRev("zins")} onKeyDown={handleEnterKey} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label htmlFor="reverse-repayment">Tilgung</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.tilgung ? 'input-synced' : ''}`}>
                        <input id="reverse-repayment" inputMode="decimal" type="text" value={rev.tilgung} onChange={(e) => updateRev("tilgung", e.target.value)} onBlur={() => handleBlurRev("tilgung")} onKeyDown={handleEnterKey} />
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

                    {revAngebot.offeredPurchasePrice > 0 && (
                      <div className="result-card" style={{ padding: '1rem', border: `2px solid ${revAngebot.isAffordableAtTargetRent ? 'var(--success-color)' : 'var(--danger-color)'}` }}>
                        <span className="label">Angebotspreis-Prüfung</span>
                        <span className="value" style={{ fontSize: '1.35rem', color: revAngebot.isAffordableAtTargetRent ? 'var(--success-color)' : 'var(--danger-color)' }}>
                          {revAngebot.isAffordableAtTargetRent ? 'Tragfähig' : 'Zielmiete reicht nicht'}
                        </span>
                        <small style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          Für {formatAcc(revAngebot.offeredPurchasePrice)} € Kaufpreis sind mindestens {formatAcc(revAngebot.requiredMonthlyRentPerSqm)} €/m² bzw. {formatAcc(revAngebot.requiredMonthlyRent)} € Kaltmiete pro Monat erforderlich.
                        </small>
                        <small style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          Gesamtinvestition inklusive Kaufnebenkosten: {formatAcc(revAngebot.totalInvestment)} €.
                        </small>
                      </div>
                    )}
                  </div> {/* End Hero Vertical */}

                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    <span>Anteil NK: <strong>{formatAcc(revNkEuro)} €</strong></span>
                  </div>
                  <div className="reverse-assumption">
                    <span>Laufende Kosten p.a.</span>
                    <strong>-{formatAcc(revLaufendeKostenPA)} €</strong>
                    <small>werden vor der tragfähigen Annuität von der Zielmiete abgezogen</small>
                  </div>

                  {/* Szenario Regler in der Rückwärtsrechnung */}
                  <div style={{ marginTop: '2rem', borderTop: '1px solid var(--success-color)', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600 }}>Szenario Analyse</span>
                      <button
                        type="button"
                        onClick={() => setRentIncrease(15)}
                        style={{ background: 'var(--success-strong)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.35rem 0.65rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        +15% Fix
                      </button>
                    </div>
                    <label htmlFor="rent-increase" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>
                      <span>Mietsteigerung (+{rentIncrease}%)</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Max Kaufpreis neu: <span className="positive" style={{ fontWeight: 700 }}>{formatAcc(revKaufpreisNeu)} €</span></span>
                      <div className="scenario-note">
                        <span>Bei {rentIncrease}% Steigerung: <strong>{formatAcc(revKaufpreisNeu)} €</strong></span>
                      </div>
                    </label>
                    <input
                      id="rent-increase"
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
        <div className="dialog-backdrop">
          <div
            ref={scanDialogRef}
            className="glass-panel scan-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scan-result-title"
            tabIndex={-1}
          >
            <h2 id="scan-result-title" style={{ color: 'var(--success-strong)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              Erkannte Werte prüfen
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Diese Werte wurden aus dem Bild erkannt. Sie werden erst nach deiner Bestätigung übernommen.</p>

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

            <div className="dialog-actions">
              <button type="button" className="dialog-button dialog-button--secondary" onClick={() => setScanResult(null)}>
                Abbrechen
              </button>
              <button type="button" className="dialog-button dialog-button--primary" onClick={applyScanResult}>
                Werte übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
