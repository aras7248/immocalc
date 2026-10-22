"use client";

import Image from "next/image";
import { saveObjectVersioned, ObjectSaveConflict } from "@/lib/saveObject";
import { extractOcrFields } from "@/lib/ocr";
import { parseNumber, formatAcc } from "@/lib/numberFormat";
import { AppDialog } from "@/components/immocalc/AppDialog";
import { useAppDialog } from "@/hooks/useAppDialog";
import { validateFields } from "@/lib/validation";
import { ProjectionPanel } from "@/components/immocalc/ProjectionPanel";
import { useState, useEffect, useId, useRef } from "react";
import { ActivePropertyBar } from '@/components/immocalc/ActivePropertyBar';
import { CalculatorModeTabs, type CalculatorMode } from '@/components/immocalc/CalculatorModeTabs';
import { PremiumAccessPanel } from '@/components/immocalc/PremiumAccessPanel';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/context/ThemeContext';
import type { PremiumPlanId } from '@/domain/immocalc/premium';
import {
  calculateReverse,
  calculateStandard,
  LAND_TRANSFER_TAX_RATES_2026,
  DEFAULT_VACANCY_PERCENT,
  normalizeEquityPercent,
  normalizeFixedInterestYears,
  type ReverseCaseResult,
} from '@/lib/calculations';
import { supabase } from '@/lib/supabase';
import { normalizeScenarioPercent, SCENARIO_PERCENT_MIN, SCENARIO_PERCENT_MAX } from '@/lib/scenario';
import { isRecord, mergeState, readSavedScenarioCostIncrease, SAVED_OBJECT_SCHEMA_VERSION } from '@/lib/savedState';

// Interface for saved objects
interface SavedObject {
  id: string;
  db_id?: string;
  updatedAt: string | null;
  date: string;
  calc: CalcState;
  rev: ReverseState;
  mieten: string[];
  rentIncrease: number;
  scenarioCostIncreasePercent: number;
}

// Interface for standard calculation
interface CalcState {
  objektname: string;
  anzahlEinheiten: string;
  kaufpreis: string;
  bundesland: string;
  notarProzent: string;
  movableItemsAmount: string;
  hasMakler: boolean;
  maklerProzent: string;
  zins: string;
  tilgung: string;
  equityPercentOfPrice: string;
  fixedInterestYears: string;
  mietePM: string;
  mietePA: string;
  wohnflaeche: string;
  baujahr: string;
  instandhaltungQm: string;
  verwaltungPm: string;
  ruecklagePm: string;
  vacancyPercent: string;
}

// Interface for reverse calculation
interface ReverseState {
  wohnflaeche: string;
  targetMode: string;
  targetCashFlowAnnual: string;
  targetNetYieldPercent: string;
  angebotspreis: string;
  bundesland: string;
  notarProzent: string;
  movableItemsAmount: string;
  hasMakler: boolean;
  maklerProzent: string;
  zins: string;
  tilgung: string;
  equityPercentOfPrice: string;
  fixedInterestYears: string;
  zielMietePA: string;
  zielMietpreisQm: string; // NEU
  instandhaltungQm: string;
  verwaltungPm: string;
  ruecklagePm: string;
  vacancyPercent: string;
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
  movableItemsAmount: "0,00",
  hasMakler: true,
  maklerProzent: "3,57",
  zins: "4,00",
  tilgung: "1,50",
  equityPercentOfPrice: "0,00",
  fixedInterestYears: "",
  mietePM: "1.825,00",
  mietePA: "21.900,00",
  wohnflaeche: "268,00",
  baujahr: "1980",
  instandhaltungQm: "1,00",
  verwaltungPm: "30,00",
  vacancyPercent: DEFAULT_VACANCY_PERCENT.toFixed(2).replace(".", ","),
  ruecklagePm: "50,00"
};

const initialRevState: ReverseState = {
  targetMode: "cashflow",
  targetCashFlowAnnual: "0,00",
  targetNetYieldPercent: "",
  wohnflaeche: "268,00",
  angebotspreis: "350.000,00",
  bundesland: "NRW",
  notarProzent: "2,00",
  movableItemsAmount: "0,00",
  hasMakler: true,
  maklerProzent: "3,57",
  zins: "4,00",
  tilgung: "1,50",
  equityPercentOfPrice: "0,00",
  fixedInterestYears: "",
  zielMietePA: "32.160,00",
  zielMietpreisQm: "10,00",
  instandhaltungQm: "1,00",
  verwaltungPm: "30,00",
  vacancyPercent: DEFAULT_VACANCY_PERCENT.toFixed(2).replace(".", ","),
  ruecklagePm: "50,00"
};

const emptyCalcState: CalcState = {
  objektname: "",
  anzahlEinheiten: "",
  kaufpreis: "",
  bundesland: "NRW",
  notarProzent: "",
  movableItemsAmount: "0,00",
  hasMakler: false,
  maklerProzent: "",
  zins: "",
  tilgung: "",
  equityPercentOfPrice: "0,00",
  fixedInterestYears: "",
  mietePM: "",
  mietePA: "",
  wohnflaeche: "",
  baujahr: "",
  instandhaltungQm: "",
  verwaltungPm: "",
  vacancyPercent: DEFAULT_VACANCY_PERCENT.toFixed(2).replace(".", ","),
  ruecklagePm: ""
};

const emptyRevState: ReverseState = {
  targetMode: "cashflow",
  targetCashFlowAnnual: "0,00",
  targetNetYieldPercent: "",
  wohnflaeche: "",
  angebotspreis: "",
  bundesland: "NRW",
  notarProzent: "",
  movableItemsAmount: "0,00",
  hasMakler: false,
  maklerProzent: "",
  zins: "",
  tilgung: "",
  equityPercentOfPrice: "0,00",
  fixedInterestYears: "",
  zielMietePA: "",
  zielMietpreisQm: "",
  instandhaltungQm: "",
  verwaltungPm: "",
  vacancyPercent: DEFAULT_VACANCY_PERCENT.toFixed(2).replace(".", ","),
  ruecklagePm: ""
};

function parseSavedObjectRow(row: unknown): SavedObject | null {
  if (!isRecord(row) || typeof row.id !== "string" || !isRecord(row.calc_data)) return null;

  const payload = row.calc_data;
  const createdAt = typeof row.created_at === "string" ? new Date(row.created_at) : new Date();
  const parsedRentIncrease = normalizeScenarioPercent(payload.rentIncrease);

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
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    date: Number.isNaN(createdAt.getTime())
      ? new Date().toISOString().split("T")[0]
      : createdAt.toISOString().split("T")[0],
    calc: parsedCalc,
    rev: parsedRev,
    mieten: Array.isArray(payload.mieten)
      ? payload.mieten.filter((entry): entry is string => typeof entry === "string").slice(0, 10)
      : [""],
    rentIncrease: parsedRentIncrease,
    scenarioCostIncreasePercent: readSavedScenarioCostIncrease(payload.scenarioCostIncreasePercent),
  };
}

function describePriceLimit(result: ReverseCaseResult): string {
  if (result.priceLimitStatus === "unbounded") return "Keine Kaufpreisgrenze ableitbar";
  if (result.priceLimitStatus === "unaffordable") return "Miete deckt laufende Kosten nicht";
  return `${formatAcc(result.maxPurchasePrice)} €`;
}

export default function Home() {
  const { request: dialogRequest, close: closeDialog, ask, notify, confirmAction, promptValue } = useAppDialog();
  // === STANDARD KALKULATION STATE ===
  const [calc, setCalc] = useState<CalcState>(initialCalcState);
  const [rev, setRev] = useState<ReverseState>(initialRevState);

  const calcIssues = validateFields({...calc, maklerProzent:calc.hasMakler?calc.maklerProzent:'0'}, parseNumber);
  const revIssues = validateFields({...rev, maklerProzent:rev.hasMakler?rev.maklerProzent:'0'}, parseNumber);
  const criticalInputError = Boolean(calcIssues.wohnflaeche || calcIssues.kaufpreis || revIssues.wohnflaeche);
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
  const [locationSuggestion, setLocationSuggestion] = useState<string | null>(null);

  // UX-Hilfen für Einheiten-Rechner
  const mietenRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rechnerRef = useRef<HTMLDivElement>(null);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);
  const mietenFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingFocusIndex, setPendingFocusIndex] = useState<number | null>(null);
  const [mietenFeedbackActive, setMietenFeedbackActive] = useState(false);
  const [mietenFeedbackSeen, setMietenFeedbackSeen] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState<CalculatorMode>('standard');
  const [selectedPremiumPlan, setSelectedPremiumPlan] = useState<PremiumPlanId>('investor');
  const [premiumNotice, setPremiumNotice] = useState<string | null>(null);
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

        setLocationSuggestion(federalState);
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
      if (!calcIssues[field]) updateCalc(field, formatAcc(val));
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
      void notify("Bitte wähle eine Bilddatei aus.");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      void notify("Das Bild ist größer als 12 MB. Bitte verkleinere es vor dem Scan.");
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
      void notify("Fehler bei der Texterkennung. Bitte versuche es mit einem klareren Bild.");
    } finally {
      if (worker) await worker.terminate();
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const processOcrText = (text: string) => {
    const results = extractOcrFields(text);

    if (Object.keys(results).length > 0) {
      setScanResult(results);
    } else {
      void notify("Es konnten keine eindeutigen Daten erkannt werden. Bitte stelle sicher, dass Kaufpreis, Fläche oder Miete im Text sichtbar sind.");
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
  // Preserve intermediate edits such as "-" so negative values can be typed naturally.
  const [rentIncreaseInput, setRentIncreaseInput] = useState("0");
  const [scenarioCostInput, setScenarioCostInput] = useState("0");
  const rentIncrease = normalizeScenarioPercent(parseNumber(rentIncreaseInput));
  const scenarioCostIncreasePercent = normalizeScenarioPercent(parseNumber(scenarioCostInput));
  const isScenarioActive = rentIncrease !== 0 || scenarioCostIncreasePercent !== 0;
  const grunderwerbsteuer: Record<string, number> = LAND_TRANSFER_TAX_RATES_2026;
  const standardResult = calculateStandard({
    federalState: calc.bundesland,
    notaryPercent: parseNumber(calc.notarProzent),
    movableItemsAmount: parseNumber(calc.movableItemsAmount),
    brokerPercent: parseNumber(calc.maklerProzent),
    hasBroker: calc.hasMakler,
    purchasePrice: kaufpreis,
    annualRent: mietePA,
    vacancyPercent: parseNumber(calc.vacancyPercent),
    livingArea: wohnflaeche,
    maintenancePerSqmMonthly: parseNumber(calc.instandhaltungQm),
    managementMonthly: parseNumber(calc.verwaltungPm),
    reserveMonthly: parseNumber(calc.ruecklagePm),
    interestPercent: zins,
    repaymentPercent: tilgung,
    equityPercentOfPrice: parseNumber(calc.equityPercentOfPrice),
    fixedInterestYears: calc.fixedInterestYears ? parseNumber(calc.fixedInterestYears) : undefined,
    scenarioRentIncreasePercent: rentIncrease,
    scenarioCostIncreasePercent,
  });
  const standardCase = isScenarioActive ? standardResult.scenario : standardResult.base;

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
  const laufendeKostenPM = (isScenarioActive ? standardResult.scenarioOperatingCosts : standardResult.operatingCosts).totalMonthly;

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
      if (!revIssues[field]) updateRev(field, formatAcc(val));
    }
  };

  const reverseResult = calculateReverse({
    federalState: rev.bundesland,
    notaryPercent: parseNumber(rev.notarProzent),
    movableItemsAmount: parseNumber(rev.movableItemsAmount),
    brokerPercent: parseNumber(rev.maklerProzent),
    hasBroker: rev.hasMakler,
    targetAnnualRent: parseNumber(rev.zielMietePA),
    targetCashFlowAnnual: rev.targetMode === "yield" ? 0 : parseNumber(rev.targetCashFlowAnnual),
    targetNetYieldPercent: rev.targetMode === "yield" ? parseNumber(rev.targetNetYieldPercent) : undefined,
    vacancyPercent: parseNumber(rev.vacancyPercent),
    offeredPurchasePrice: parseNumber(calc.kaufpreis),
    livingArea: parseNumber(calc.wohnflaeche),
    maintenancePerSqmMonthly: parseNumber(rev.instandhaltungQm),
    managementMonthly: parseNumber(rev.verwaltungPm),
    reserveMonthly: parseNumber(rev.ruecklagePm),
    interestPercent: parseNumber(rev.zins),
    repaymentPercent: parseNumber(rev.tilgung),
    equityPercentOfPrice: parseNumber(rev.equityPercentOfPrice),
    fixedInterestYears: rev.fixedInterestYears ? parseNumber(rev.fixedInterestYears) : undefined,
    scenarioRentIncreasePercent: rentIncrease,
    scenarioCostIncreasePercent,
  });
  const revGesamtNkProzent = reverseResult.base.acquisitionCosts.totalPercent;
  const revPriceHasLimit = reverseResult.base.priceLimitStatus === "bounded";
  const revMaxGesamtKaufpreis = reverseResult.base.totalInvestment;
  const revNkEuro = reverseResult.base.acquisitionCosts.totalAmount;
  const revMaklerEuro = reverseResult.base.acquisitionCosts.brokerAmount;

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
      movableItemsAmount: calc.movableItemsAmount,
      hasMakler: calc.hasMakler,
      maklerProzent: calc.maklerProzent,
      zins: calc.zins,
      tilgung: calc.tilgung,
      equityPercentOfPrice: calc.equityPercentOfPrice,
      fixedInterestYears: calc.fixedInterestYears,
      instandhaltungQm: calc.instandhaltungQm,
      verwaltungPm: calc.verwaltungPm,
      ruecklagePm: calc.ruecklagePm,
      vacancyPercent: calc.vacancyPercent,
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
      equityPercentOfPrice: true,
      fixedInterestYears: true,
      vacancyPercent: true,
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

  const handlePremiumUnlock = () => {
    const planName = selectedPremiumPlan === 'investor' ? 'Investor' : 'Professional';
    setPremiumNotice(
      `Der ${planName}-Tarif ist für die nächste Phase vorbereitet. Die Buchung wird später direkt in ImmoCalc aktiviert.`,
    );
  };

  const handleSaveObject = async () => {
    if (isSaving) return;
    if (!user) {
      void notify("Du musst eingeloggt sein, um Objekte speichern zu können.");
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
      const wantOverwrite = await confirmAction(`Ein Objekt mit dem Namen "${trimmedName}" existiert bereits.\n\nMöchtest du es überschreiben?\n(Klicke "Abbrechen", um eine Kopie unter neuem Namen zu speichern)`);
      if (wantOverwrite) {
        existingDbId = savedObjects[existingIndex].db_id;
      } else {
        const newName = await promptValue("Bitte gib einen neuen Namen für dieses Objekt ein:", trimmedName + " (Kopie)");
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
          scenarioCostIncreasePercent,
        }
      };

      await saveObjectVersioned(supabase, payload, existingDbId ? {id:existingDbId,updatedAt:savedObjects[existingIndex].updatedAt} : undefined);

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
      if (e instanceof ObjectSaveConflict) {
        const choice=await ask({kind:'confirm',message:'Das gespeicherte Objekt wurde zwischenzeitlich geändert. Wie möchtest du fortfahren?',choices:[{label:'Neu laden',value:'reload'},{label:'Als Kopie speichern',value:'copy'}]});
        try {
          if(choice==='reload'&&existingDbId){
            const {data,error}=await supabase.from('immocalc_saved_objects').select('*').eq('id',existingDbId).eq('user_id',user.id).single();
            if(error)throw error;const loaded=parseSavedObjectRow(data);if(loaded){handleLoadObject(loaded);setSavedObjects(prev=>prev.map(o=>o.id===loaded.id?loaded:o));}
          } else if(choice==='copy'){
            const copyName=nameToSave+' (Kopie)';
            const saved=await saveObjectVersioned(supabase,{user_id:user.id,calc_data:{schemaVersion:SAVED_OBJECT_SCHEMA_VERSION,calc:{...calc,objektname:copyName},rev,mieten,rentIncrease,scenarioCostIncreasePercent}});
            setSavedObjects(prev=>[{id:saved.id,db_id:saved.id,updatedAt:saved.updated_at,date:new Date().toISOString().split('T')[0],calc:{...calc,objektname:copyName},rev,mieten,rentIncrease,scenarioCostIncreasePercent},...prev]);
            updateCalc('objektname',copyName);void notify('Die aktuellen Eingaben wurden als separates Objekt gespeichert.');
          }
        }catch{void notify('Die Konfliktlösung ist fehlgeschlagen. Deine aktuellen Eingaben bleiben erhalten.');}
        return;
      }
      console.error("Speichern fehlgeschlagen:", e);
      void notify("Das Objekt konnte nicht gespeichert werden. Bitte prüfe deine Verbindung und versuche es erneut.");
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
    setRentIncreaseInput(String(normalizeScenarioPercent(obj.rentIncrease)));
    setScenarioCostInput(String(normalizeScenarioPercent(obj.scenarioCostIncreasePercent)));
  };

  const handleClearData = async () => {
    if (await confirmAction("Möchtest du wirklich alle eingegebenen Werte löschen?")) {
      setCalc(emptyCalcState);
      setRev(emptyRevState);
      setSyncedFields({});
      setMieten([""]);
      setRentIncreaseInput("0");
      setScenarioCostInput("0");
      setScanResult(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsFlashActive(true);
      setTimeout(() => setIsFlashActive(false), 800);
    }
  };

  const handleDeleteObject = async (id: string) => {
    const obj = savedObjects.find(o => o.id === id);
    if (obj?.db_id && user) {
      const shouldDelete = await confirmAction(`Möchtest du „${obj.calc.objektname || "Unbenanntes Objekt"}“ wirklich löschen?`);
      if (!shouldDelete) return;

      const { error } = await supabase
        .from('immocalc_saved_objects')
        .delete()
        .eq('id', obj.db_id)
        .eq('user_id', user.id);

      if (error) {
        console.error("Löschen fehlgeschlagen:", error);
        void notify("Das Objekt konnte nicht gelöscht werden. Bitte versuche es erneut.");
        return;
      }
    }
    setSavedObjects(savedObjects.filter(o => o.id !== id));
  };

  return (
    <div className="app-container">
      {dialogRequest && <AppDialog request={dialogRequest} onClose={closeDialog} />}
      {criticalInputError && <p role="alert" className="validation-message">Bitte korrigiere Kaufpreis und Wohnfläche. Die Ergebnisanzeige ist bis dahin ausgeblendet.</p>}
      {/* ═══ TOP BAR — eigenständige ImmoCalc-App im gemeinsamen Designsystem ═══ */}
      <header className="app-topbar">
        <div className="app-brand">
          <Image
            className="app-brand__mark brand-logo brand-logo--light"
            src="/brand/logo-icon.png"
            alt="ImmoCalc"
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
            <span className="app-brand__eyebrow">Eigenständige Immobilienanalyse</span>
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
                <input id="unit-count" inputMode="numeric" type="text" value={calc.anzahlEinheiten} onChange={(e) => updateCalc("anzahlEinheiten", e.target.value)} placeholder="z.B. 3" onKeyDown={handleEnterKey}  aria-invalid={Boolean(calcIssues.anzahlEinheiten)} />
{calcIssues.anzahlEinheiten && <small role="alert" className="validation-message">{calcIssues.anzahlEinheiten}</small>}
              </div>
            </div>
            <div className="input-group input-optional">
              <label htmlFor="construction-year">Baujahr</label>
              <div className="input-wrapper">
                <input id="construction-year" inputMode="numeric" type="text" value={calc.baujahr} onChange={(e) => updateCalc("baujahr", e.target.value)} onKeyDown={handleEnterKey}  aria-invalid={Boolean(calcIssues.baujahr)} />
{calcIssues.baujahr && <small role="alert" className="validation-message">{calcIssues.baujahr}</small>}
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

      <CalculatorModeTabs
        activeMode={activeTab}
        onModeChange={(mode) => {
          setActiveTab(mode);
          setPremiumNotice(null);
        }}
      />

      {locationSuggestion && <div className="glass-panel" role="status">
        <p>Dein erkannter Standort: {locationSuggestion}. Liegt auch dein Objekt dort?</p>
        <button type="button" onClick={()=>{updateFederalState(locationSuggestion);setLocationSuggestion(null);}}>Für mein Objekt übernehmen</button>
        <button type="button" onClick={()=>setLocationSuggestion(null)}>Verwerfen</button>
      </div>}
      <ActivePropertyBar
        errors={{livingArea:calcIssues.wohnflaeche,purchasePrice:calcIssues.kaufpreis}}
        objectName={calc.objektname}
        livingArea={calc.wohnflaeche}
        purchasePrice={calc.kaufpreis}
        isSaved={activePropertyIsSaved}
        isSaving={isSaving}
        isFlashActive={isFlashActive}
        onObjectNameChange={(value) => updateCalc("objektname", value)}
        onLivingAreaChange={(value) => updateCalc("wohnflaeche", value)}
        onPurchasePriceChange={(value) => updateCalc("kaufpreis", value)}
        onLivingAreaBlur={() => handleBlurCalc("wohnflaeche")}
        onPurchasePriceBlur={() => handleBlurCalc("kaufpreis")}
        onEnterKey={handleEnterKey}
        onSync={syncFromCalcToRev}
        onSave={handleSaveObject}
      />

      {(standardResult.acquisitionCosts.warnings.length > 0 || reverseResult.base.acquisitionCosts.warnings.length > 0) && <p role="alert" className="validation-message">Unbekanntes Bundesland: Bitte wähle den Objektstandort aus. Die Grunderwerbsteuer ist noch nicht zuverlässig berücksichtigt.</p>}
      {activeTab === 'premium' && (
        <>
        <PremiumAccessPanel
          selectedPlan={selectedPremiumPlan}
          notice={premiumNotice}
          onPlanChange={(plan) => {
            setSelectedPremiumPlan(plan);
            setPremiumNotice(null);
          }}
          onUnlock={handlePremiumUnlock}
        />
        {!criticalInputError && <ProjectionPanel input={standardResult.input} />}
        </>
      )}

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
                      <input id="purchase-price" inputMode="decimal" type="text" value={calc.kaufpreis} onChange={(e) => updateCalc("kaufpreis", e.target.value)} onBlur={() => handleBlurCalc("kaufpreis")} onKeyDown={handleEnterKey} required aria-required="true"  aria-invalid={Boolean(calcIssues.kaufpreis)} />
{calcIssues.kaufpreis && <small role="alert" className="validation-message">{calcIssues.kaufpreis}</small>}
                      <span className="input-suffix">€</span>
                    </div>
                  </div>

                  <div className="input-group input-required">
                    <label htmlFor="living-area">Wohnfläche</label>
                    <div className="input-wrapper">
                      <input id="living-area" inputMode="decimal" type="text" value={calc.wohnflaeche} onChange={(e) => updateCalc("wohnflaeche", e.target.value)} onBlur={() => handleBlurCalc("wohnflaeche")} onKeyDown={handleEnterKey} required aria-required="true"  aria-invalid={Boolean(calcIssues.wohnflaeche)} />
{calcIssues.wohnflaeche && <small role="alert" className="validation-message">{calcIssues.wohnflaeche}</small>}
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
                    <label htmlFor="notary-percent">Notar und Grundbuch</label>
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
                       aria-invalid={Boolean(calcIssues.notarProzent)} />
{calcIssues.notarProzent && <small role="alert" className="validation-message">{calcIssues.notarProzent}</small>}
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
                      <input id="broker-percent" aria-label="Maklerprovision in Prozent" inputMode="decimal" type="text" value={calc.maklerProzent} onChange={(e) => updateCalc("maklerProzent", e.target.value)} onBlur={() => handleBlurCalc("maklerProzent")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(calcIssues.maklerProzent)} />
{calcIssues.maklerProzent && <small role="alert" className="validation-message">{calcIssues.maklerProzent}</small>}
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
                       aria-invalid={Boolean(calcIssues.mietePM)} />
{calcIssues.mietePM && <small role="alert" className="validation-message">{calcIssues.mietePM}</small>}
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
                       aria-invalid={Boolean(calcIssues.mietePA)} />
{calcIssues.mietePA && <small role="alert" className="validation-message">{calcIssues.mietePA}</small>}
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

<div className="input-group input-optional"><label htmlFor="calc-movable">Mitverkaufte bewegliche Gegenstände (€)</label><input id="calc-movable" type="text" inputMode="decimal" value={calc.movableItemsAmount} onChange={e=>updateCalc('movableItemsAmount',e.target.value)} aria-invalid={Boolean(calcIssues.movableItemsAmount)} />
{calcIssues.movableItemsAmount && <small role="alert" className="validation-message">{calcIssues.movableItemsAmount}</small>}<small>Nur angemessen bewertete, separat ausgewiesene Gegenstände, z. B. eine gebrauchte Küche. Abzug ausschließlich bei der Grunderwerbsteuer. Notar/Grundbuch (Standard 2 %) und Makler werden hier weiter auf den Gesamtpreis berechnet; tatsächliche Vereinbarungen und Gebühren können abweichen.</small></div><p className="field-note">Makler: Trage deinen vereinbarten Käuferanteil ein. §§ 656b–656d BGB enthalten besondere Regeln für Verbraucherkäufe von Wohnungen und Einfamilienhäusern; bei anderen Objektarten kann die Verteilung abweichen.</p>
                <h3 className="cluster-title">4. Laufende, nicht umlagefähige Kosten</h3>
                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="maintenance-monthly">Instandhaltung / m² / Monat</label>
                    <small>Ansatz für laufende Reparaturen. Bereits hier erfasste Beträge nicht nochmals als Rücklage eintragen.</small>
                    <div className="input-wrapper">
                      <input id="maintenance-monthly" inputMode="decimal" type="text" value={calc.instandhaltungQm} onChange={(e) => updateCalc("instandhaltungQm", e.target.value)} onBlur={() => handleBlurCalc("instandhaltungQm")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(calcIssues.instandhaltungQm)} />
{calcIssues.instandhaltungQm && <small role="alert" className="validation-message">{calcIssues.instandhaltungQm}</small>}
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="management-monthly">Verwaltung / Monat</label>
                    <div className="input-wrapper">
                      <input id="management-monthly" inputMode="decimal" type="text" value={calc.verwaltungPm} onChange={(e) => updateCalc("verwaltungPm", e.target.value)} onBlur={() => handleBlurCalc("verwaltungPm")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(calcIssues.verwaltungPm)} />
{calcIssues.verwaltungPm && <small role="alert" className="validation-message">{calcIssues.verwaltungPm}</small>}
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="reserve-monthly">Rücklage / Monat</label>
                    <small>Zusätzliche Liquiditätsreserve für künftige Maßnahmen, ohne die bereits angesetzte Instandhaltung. Mindert den verfügbaren Cashflow.</small>
                    <div className="input-wrapper">
                      <input id="reserve-monthly" inputMode="decimal" type="text" value={calc.ruecklagePm} onChange={(e) => updateCalc("ruecklagePm", e.target.value)} onBlur={() => handleBlurCalc("ruecklagePm")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(calcIssues.ruecklagePm)} />
{calcIssues.ruecklagePm && <small role="alert" className="validation-message">{calcIssues.ruecklagePm}</small>}
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                </div>

                  <div className="input-group input-optional">
                    <label htmlFor="vacancy-percent">Mietausfall / Leerstand</label>
                    <div className="input-wrapper">
                      <input id="vacancy-percent" inputMode="decimal" type="text" value={calc.vacancyPercent} onChange={(e) => updateCalc("vacancyPercent", e.target.value)} aria-describedby="vacancy-percent-help" aria-invalid={parseNumber(calc.vacancyPercent) < 0 || parseNumber(calc.vacancyPercent) > 100} />
{calcIssues.vacancyPercent && <small role="alert" className="validation-message">{calcIssues.vacancyPercent}</small>}
                      <span className="input-suffix">%</span>
                    </div>
                    <small id="vacancy-percent-help">0 bis 100 % der Soll-Jahresmiete. Bruttorendite und Kaufpreisfaktor verwenden weiterhin die Soll-Miete.</small>
                  </div>

                <div className="input-group input-optional">
                    <label htmlFor="standard-scenario-cost-increase">Kostenänderung im Szenario (−50 % bis +100 %)</label>
                    <div className="input-wrapper">
                      <input id="standard-scenario-cost-increase" type="text" inputMode="text" value={scenarioCostInput} onChange={(e) => setScenarioCostInput(e.target.value)} onBlur={() => setScenarioCostInput(formatAcc(scenarioCostIncreasePercent))} onKeyDown={handleEnterKey} aria-describedby="standard-scenario-cost-increase-help" />
                      <span className="input-suffix">%</span>
                    </div>
                    <small id="standard-scenario-cost-increase-help">Negative Werte senken die Kosten. Einmalige Änderung von Instandhaltung, Verwaltung und Rücklage im Szenario. Keine jährliche Steigerung; die Basisrechnung bleibt unverändert. Werte werden auf −50 % bis +100 % begrenzt.</small>
                  </div>

                <h3 className="cluster-title">5. Finanzierung</h3>
                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="standard-equity-percent">Eigenkapital im Kaufpreis</label>
                    <div className="input-wrapper">
                      <input id="standard-equity-percent" type="text" inputMode="decimal" value={calc.equityPercentOfPrice} onChange={(e) => updateCalc("equityPercentOfPrice", e.target.value)} onBlur={() => updateCalc("equityPercentOfPrice", formatAcc(normalizeEquityPercent(parseNumber(calc.equityPercentOfPrice))))} onKeyDown={handleEnterKey} aria-describedby="standard-equity-help" aria-invalid={parseNumber(calc.equityPercentOfPrice) < 0 || parseNumber(calc.equityPercentOfPrice) > 100} />
{calcIssues.equityPercentOfPrice && <small role="alert" className="validation-message">{calcIssues.equityPercentOfPrice}</small>}
                      <span className="input-suffix">%</span>
                    </div>
                    <small id="standard-equity-help">0 bis 100 % des Kaufpreises, zusätzlich zu den vollständig aus Eigenkapital bezahlten Kaufnebenkosten.</small>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="standard-fixed-interest-years">Zinsbindung (optional)</label>
                    <div className="input-wrapper">
                      <input id="standard-fixed-interest-years" type="text" inputMode="numeric" value={calc.fixedInterestYears} onChange={(e) => updateCalc("fixedInterestYears", e.target.value)} onBlur={() => updateCalc("fixedInterestYears", String(normalizeFixedInterestYears(parseNumber(calc.fixedInterestYears)) ?? ""))} onKeyDown={handleEnterKey} aria-describedby="standard-fixed-interest-help"  aria-invalid={Boolean(calcIssues.fixedInterestYears)} />
{calcIssues.fixedInterestYears && <small role="alert" className="validation-message">{calcIssues.fixedInterestYears}</small>}
                      <span className="input-suffix">Jahre</span>
                    </div>
                    <small id="standard-fixed-interest-help">1 bis 30 volle Jahre. Die Zinsbindung wird gespeichert; die angezeigten Kennzahlen beziehen sich auf das erste Jahr.</small>
                  </div>
                </div>

                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="interest-percent">Zins</label>
                    <div className="input-wrapper">
                      <input id="interest-percent" inputMode="decimal" type="text" value={calc.zins} onChange={(e) => updateCalc("zins", e.target.value)} onBlur={() => handleBlurCalc("zins")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(calcIssues.zins)} />
{calcIssues.zins && <small role="alert" className="validation-message">{calcIssues.zins}</small>}
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="repayment-percent">Tilgung</label>
                    <div className="input-wrapper">
                      <input id="repayment-percent" inputMode="decimal" type="text" value={calc.tilgung} onChange={(e) => updateCalc("tilgung", e.target.value)} onBlur={() => handleBlurCalc("tilgung")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(calcIssues.tilgung)} />
{calcIssues.tilgung && <small role="alert" className="validation-message">{calcIssues.tilgung}</small>}
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
            <section className="results-sticky" hidden={criticalInputError}>
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
                          Die laufenden Kosten und die Annuität sind in diesem Szenario gedeckt. Der eingestellte Mietausfall ist berücksichtigt. Prüfe zusätzlich Steuern und den tatsächlichen Darlehensvertrag.
                        </>
                      ) : roe >= 5 ? (
                        <>
                          <span style={{ color: 'var(--warning-color)', fontWeight: 700 }}>Positiver Cash-on-Cash-Wert</span><br />
                          Das Szenario liefert {formatAcc(roe)}% auf dein gesamtes eingesetztes Eigenkapital. Zusätzliche Risiken sind noch nicht enthalten.
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
                        Cash-on-Cash-Rendite (vor Steuern)
                      </span>
                      <InfoTooltip
                        id="roe"
                        title="Cash-on-Cash-Rendite"
                        text="Berechnung vor Steuern: Jahrescashflow nach laufenden Kosten und Annuität geteilt durch Kaufnebenkosten plus Eigenkapital im Kaufpreis. Der Darlehensbetrag sinkt um deinen Eigenkapitalanteil am Kaufpreis."
                        activeId={activeTooltip}
                        onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                      />
                    </div>
                    <span className={`value ${roe >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '1.5rem' }}>
                      {formatAcc(roe)} %
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>auf gesamtes eingesetztes Eigenkapital</span>
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
                        <span className="label" style={{ fontSize: '0.7rem', margin: 0 }}>Netto-Rendite (vor Steuern)</span>
                        <InfoTooltip
                          id="netto"
                          title="Netto-Mietrendite"
                          text="Berechnung: Jahreskaltmiete nach Mietausfall minus Instandhaltung, Verwaltung und Rücklage, geteilt durch die Gesamt-Investition. Der eingestellte Mietausfall ist abgezogen; Steuern sind nicht enthalten."
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

                <div className="metric-summary" aria-label="Finanzierungsstruktur">
                  <div><span>Darlehensbetrag</span><strong>{formatAcc(standardResult.financing.principal)} €</strong></div>
                  <div><span>Eigenkapital im Kaufpreis</span><strong>{formatAcc(standardResult.financing.equityInPrice)} €</strong></div>
                  <div><span>Eigenkapital gesamt (inkl. NK)</span><strong>{formatAcc(standardResult.totalEquityRequired)} €</strong></div>
                  {standardResult.financing.fixedInterestYears !== null && <div><span>Zinsbindung</span><strong>{standardResult.financing.fixedInterestYears} Jahre</strong></div>}
                </div>
                <div className="metric-summary" aria-label="Laufende Kosten und Netto-Mietertrag">
                  <div><span>Mietausfall / Jahr</span><strong>−{formatAcc(standardCase.vacancyAnnual)} €</strong></div>
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
                      <span className="label" style={{ margin: 0 }}>CF / Monat (vor Steuern)</span>
                      <InfoTooltip
                        id="cfpm"
                        title="Cashflow pro Monat"
                        text="Monatliche Kaltmiete nach Mietausfall minus laufende nicht umlagefähige Kosten und Annuität (Zins + Tilgung)."
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
                      <span className="label" style={{ margin: 0 }}>CF / Jahr (vor Steuern)</span>
                      <InfoTooltip
                        id="cfpa"
                        title="Cashflow pro Jahr"
                        text="Jahreskaltmiete nach Mietausfall minus laufende nicht umlagefähige Kosten und jährliche Annuität. Der eingestellte Mietausfall ist abgezogen; Steuern sind nicht enthalten."
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
                        <div style={{ flex: 1 }}>Cashflow (vor Steuern)</div>
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
                       aria-invalid={Boolean(calcIssues.wohnflaeche)} />
{calcIssues.wohnflaeche && <small role="alert" className="validation-message">{calcIssues.wohnflaeche}</small>}
                      <span style={{ fontSize: '0.8rem' }}>m² ×</span>
                      <input
                        aria-label="Mietpreis pro Quadratmeter für Mietpotenzial"
                        inputMode="decimal"
                        type="text"
                        placeholder="€/m²"
                        value={rev.zielMietpreisQm}
                        onChange={(e) => updateRev("zielMietpreisQm", e.target.value)}
                       aria-invalid={Boolean(revIssues.zielMietpreisQm)} />
{revIssues.zielMietpreisQm && <small role="alert" className="validation-message">{revIssues.zielMietpreisQm}</small>}
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
                        <input id="target-rent-sqm" inputMode="decimal" type="text" value={rev.zielMietpreisQm} onChange={(e) => updateRev("zielMietpreisQm", e.target.value)} onBlur={() => handleBlurRev("zielMietpreisQm")} onKeyDown={handleEnterKey} style={{ fontWeight: 700, color: syncedFields.zielMietpreisQm ? 'var(--success-color)' : 'var(--accent-color)' }}  aria-invalid={Boolean(revIssues.zielMietpreisQm)} />
{revIssues.zielMietpreisQm && <small role="alert" className="validation-message">{revIssues.zielMietpreisQm}</small>}
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                    <div className="input-group input-required">
                      <label htmlFor="target-annual-rent">Kaltmiete / p.a. (Ziel)</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zielMietePA ? 'input-synced' : ''}`}>
                        <input id="target-annual-rent" inputMode="decimal" type="text" value={rev.zielMietePA} onChange={(e) => updateRev("zielMietePA", e.target.value)} onBlur={() => handleBlurRev("zielMietePA")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(revIssues.zielMietePA)} />
{revIssues.zielMietePA && <small role="alert" className="validation-message">{revIssues.zielMietePA}</small>}
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
                        <input id="reverse-notary-percent" type="text" value={rev.notarProzent} readOnly style={{ opacity: 0.7, background: 'var(--bg-color)' }}  aria-invalid={Boolean(revIssues.notarProzent)} />
{revIssues.notarProzent && <small role="alert" className="validation-message">{revIssues.notarProzent}</small>}
                      {revIssues.notarProzent && <small role="alert" className="validation-message">{revIssues.notarProzent}</small>}
                        <span className="input-suffix">%</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input id="reverse-has-broker" type="checkbox" checked={rev.hasMakler} onChange={(e) => updateRev("hasMakler", e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color)' }} />
                        Maklerprovision
                      </label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.maklerProzent ? 'input-synced' : ''}`} style={{ opacity: rev.hasMakler ? 1 : 0.5, pointerEvents: rev.hasMakler ? 'auto' : 'none' }}>
                        <input id="reverse-broker-percent" aria-label="Maklerprovision in Prozent" inputMode="decimal" type="text" value={rev.maklerProzent} onChange={(e) => updateRev("maklerProzent", e.target.value)} onBlur={() => handleBlurRev("maklerProzent")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(revIssues.maklerProzent)} />
{revIssues.maklerProzent && <small role="alert" className="validation-message">{revIssues.maklerProzent}</small>}
                        <span className="input-suffix">%</span>
                      </div>
                    </div>

                    <div className="input-group output-calc">
                      <label htmlFor="reverse-broker-amount">Maklerprovision (€)</label>
                      <div className="input-wrapper" style={{ opacity: rev.hasMakler ? 1 : 0.5 }}>
                        <input id="reverse-broker-amount" type="text" readOnly value={reverseResult.base.priceLimitStatus === "bounded" ? formatAcc(revMaklerEuro) : "—"} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                  </div>

<div className="input-group input-optional"><label htmlFor="rev-movable">Mitverkaufte bewegliche Gegenstände (€)</label><input id="rev-movable" type="text" inputMode="decimal" value={rev.movableItemsAmount} onChange={e=>updateRev('movableItemsAmount',e.target.value)} aria-invalid={Boolean(revIssues.movableItemsAmount)} />
{revIssues.movableItemsAmount && <small role="alert" className="validation-message">{revIssues.movableItemsAmount}</small>}<small>Nur angemessen bewertete, separat ausgewiesene Gegenstände, z. B. eine gebrauchte Küche. Abzug ausschließlich bei der Grunderwerbsteuer. Notar/Grundbuch (Standard 2 %) und Makler werden hier weiter auf den Gesamtpreis berechnet; tatsächliche Vereinbarungen und Gebühren können abweichen.</small></div><p className="field-note">Makler: Trage deinen vereinbarten Käuferanteil ein. §§ 656b–656d BGB enthalten besondere Regeln für Verbraucherkäufe von Wohnungen und Einfamilienhäusern; bei anderen Objektarten kann die Verteilung abweichen.</p>
                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label htmlFor="reverse-maintenance">Instandhaltung / m² / Monat</label>
                    <small>Ansatz für laufende Reparaturen. Bereits hier erfasste Beträge nicht nochmals als Rücklage eintragen.</small>
                      <div className="input-wrapper">
                        <input id="reverse-maintenance" inputMode="decimal" type="text" value={rev.instandhaltungQm} onChange={(e) => updateRev("instandhaltungQm", e.target.value)} onBlur={() => handleBlurRev("instandhaltungQm")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(revIssues.instandhaltungQm)} />
{revIssues.instandhaltungQm && <small role="alert" className="validation-message">{revIssues.instandhaltungQm}</small>}
                        <span className="input-suffix">€</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label htmlFor="reverse-management">Hausverwaltung / Monat</label>
                      <div className="input-wrapper">
                        <input id="reverse-management" inputMode="decimal" type="text" value={rev.verwaltungPm} onChange={(e) => updateRev("verwaltungPm", e.target.value)} onBlur={() => handleBlurRev("verwaltungPm")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(revIssues.verwaltungPm)} />
{revIssues.verwaltungPm && <small role="alert" className="validation-message">{revIssues.verwaltungPm}</small>}
                        <span className="input-suffix">€</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label htmlFor="reverse-reserve">Rücklage / Monat</label>
                    <small>Zusätzliche Liquiditätsreserve für künftige Maßnahmen, ohne die bereits angesetzte Instandhaltung. Mindert den verfügbaren Cashflow.</small>
                      <div className="input-wrapper">
                        <input id="reverse-reserve" inputMode="decimal" type="text" value={rev.ruecklagePm} onChange={(e) => updateRev("ruecklagePm", e.target.value)} onBlur={() => handleBlurRev("ruecklagePm")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(revIssues.ruecklagePm)} />
{revIssues.ruecklagePm && <small role="alert" className="validation-message">{revIssues.ruecklagePm}</small>}
                        <span className="input-suffix">€</span>
                      </div>
                    </div>
                  </div>

                  <div className="input-group input-optional">
                    <label htmlFor="reverse-vacancy-percent">Mietausfall / Leerstand</label>
                    <div className="input-wrapper">
                      <input id="reverse-vacancy-percent" inputMode="decimal" type="text" value={rev.vacancyPercent} onChange={(e) => updateRev("vacancyPercent", e.target.value)} aria-describedby="reverse-vacancy-percent-help" aria-invalid={parseNumber(rev.vacancyPercent) < 0 || parseNumber(rev.vacancyPercent) > 100} />
{revIssues.vacancyPercent && <small role="alert" className="validation-message">{revIssues.vacancyPercent}</small>}
                      <span className="input-suffix">%</span>
                    </div>
                    <small id="reverse-vacancy-percent-help">0 bis 100 % der Soll-Jahresmiete. Bruttorendite und Kaufpreisfaktor verwenden weiterhin die Soll-Miete.</small>
                  </div>

                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="reverse-equity-percent">Eigenkapital im Kaufpreis</label>
                    <div className="input-wrapper">
                      <input id="reverse-equity-percent" type="text" inputMode="decimal" value={rev.equityPercentOfPrice} onChange={(e) => updateRev("equityPercentOfPrice", e.target.value)} onBlur={() => updateRev("equityPercentOfPrice", formatAcc(normalizeEquityPercent(parseNumber(rev.equityPercentOfPrice))))} onKeyDown={handleEnterKey} aria-describedby="reverse-equity-help" aria-invalid={parseNumber(rev.equityPercentOfPrice) < 0 || parseNumber(rev.equityPercentOfPrice) > 100} />
{revIssues.equityPercentOfPrice && <small role="alert" className="validation-message">{revIssues.equityPercentOfPrice}</small>}
                      <span className="input-suffix">%</span>
                    </div>
                    <small id="reverse-equity-help">0 bis 100 % des Kaufpreises, zusätzlich zu den vollständig aus Eigenkapital bezahlten Kaufnebenkosten.</small>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="reverse-fixed-interest-years">Zinsbindung (optional)</label>
                    <div className="input-wrapper">
                      <input id="reverse-fixed-interest-years" type="text" inputMode="numeric" value={rev.fixedInterestYears} onChange={(e) => updateRev("fixedInterestYears", e.target.value)} onBlur={() => updateRev("fixedInterestYears", String(normalizeFixedInterestYears(parseNumber(rev.fixedInterestYears)) ?? ""))} onKeyDown={handleEnterKey} aria-describedby="reverse-fixed-interest-help"  aria-invalid={Boolean(revIssues.fixedInterestYears)} />
{revIssues.fixedInterestYears && <small role="alert" className="validation-message">{revIssues.fixedInterestYears}</small>}
                      <span className="input-suffix">Jahre</span>
                    </div>
                    <small id="reverse-fixed-interest-help">1 bis 30 volle Jahre. Die Zinsbindung wird gespeichert; die angezeigten Kennzahlen beziehen sich auf das erste Jahr.</small>
                  </div>
                </div>
                  <div className="calculation-row" aria-label="Ziel der Rückwärtsrechnung">
                    <label>Zielart<select value={rev.targetMode} onChange={e=>updateRev('targetMode',e.target.value)}><option value="cashflow">Cashflow vor Steuern</option><option value="yield">Nettorendite vor Steuern</option></select></label>
                    {rev.targetMode === 'yield' ? <label>Ziel-Nettorendite (%)<input type="text" inputMode="decimal" value={rev.targetNetYieldPercent} onChange={e=>updateRev('targetNetYieldPercent',e.target.value)} aria-invalid={Boolean(revIssues.targetNetYieldPercent)} />
{revIssues.targetNetYieldPercent && <small role="alert" className="validation-message">{revIssues.targetNetYieldPercent}</small>}</label> : <label>Ziel-Cashflow pro Jahr (€)<input type="text" inputMode="decimal" value={rev.targetCashFlowAnnual} onChange={e=>updateRev('targetCashFlowAnnual',e.target.value)} aria-invalid={Boolean(revIssues.targetCashFlowAnnual)} />
{revIssues.targetCashFlowAnnual && <small role="alert" className="validation-message">{revIssues.targetCashFlowAnnual}</small>}</label>}
                  </div>
                  <div className="calculation-row">
                    <div className="input-group input-optional">
                      <label htmlFor="reverse-interest">Zins</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zins ? 'input-synced' : ''}`}>
                        <input id="reverse-interest" inputMode="decimal" type="text" value={rev.zins} onChange={(e) => updateRev("zins", e.target.value)} onBlur={() => handleBlurRev("zins")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(revIssues.zins)} />
{revIssues.zins && <small role="alert" className="validation-message">{revIssues.zins}</small>}
                        <span className="input-suffix">%</span>
                      </div>
                    </div>

                    <div className="input-group input-optional">
                      <label htmlFor="reverse-repayment">Tilgung</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.tilgung ? 'input-synced' : ''}`}>
                        <input id="reverse-repayment" inputMode="decimal" type="text" value={rev.tilgung} onChange={(e) => updateRev("tilgung", e.target.value)} onBlur={() => handleBlurRev("tilgung")} onKeyDown={handleEnterKey}  aria-invalid={Boolean(revIssues.tilgung)} />
{revIssues.tilgung && <small role="alert" className="validation-message">{revIssues.tilgung}</small>}
                        <span className="input-suffix">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </CollapsibleSection>

            <section className="results-sticky" hidden={criticalInputError}>
              <CollapsibleSection
                title="Kaufpreis bei Zielvorgabe"
                icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>}
                badge={describePriceLimit(reverseResult.base)}
              >
                <section style={{ padding: '1rem', background: 'var(--output-calc-bg)', borderRadius: '0 0 12px 12px' }}>
                  <h3 style={{ marginBottom: '1rem', color: 'var(--success-color)' }}>Kaufpreis bei Zielvorgabe</h3>

                  {rev.targetMode !== 'yield' && parseNumber(rev.targetCashFlowAnnual) === 0 && <p>Break-even: Ziel-Cashflow 0 € vor Steuern.</p>}
                  <div className="results-hero-vertical" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="result-card" style={{ padding: '1rem', border: '2px solid var(--success-color)' }}>
                      <span className="label">{rev.targetMode === 'yield' ? 'Kaufpreis bei Ziel-Nettorendite' : 'Kaufpreis bei Ziel-Cashflow'}</span>
                      <span className="value positive" style={{ fontSize: '1.8rem' }}>
                        {describePriceLimit(reverseResult.base)}
                      </span>
                    </div>

                    <div className="result-card" style={{ padding: '1rem' }}>
                      <span className="label">Gesamtkaufpreis (inkl. NK)</span>
                      <span className="value" style={{ fontSize: '1.4rem' }}>
                        {reverseResult.base.priceLimitStatus === "bounded" ? `${formatAcc(revMaxGesamtKaufpreis)} €` : "—"}
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
                          Gesamtinvestition inklusive Kaufnebenkosten: {formatAcc(revAngebot.totalInvestment)} €. Darlehen: {formatAcc(revAngebot.financing.principal)} €. Eigenkapital gesamt: {formatAcc(revAngebot.totalEquityRequired)} €.
                        </small>
                      </div>
                    )}
                  </div> {/* End Hero Vertical */}

                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                    <span>Anteil NK: <strong>{revPriceHasLimit ? `${formatAcc(revNkEuro)} €` : "—"}</strong></span>
                  </div>
                  {revPriceHasLimit && <div className="metric-summary" aria-label="Finanzierung beim errechneten Kaufpreis">
                    <div><span>Darlehen beim errechneten Kaufpreis</span><strong>{formatAcc(reverseResult.base.financing.principal)} €</strong></div>
                    <div><span>Eigenkapital gesamt (inkl. NK)</span><strong>{formatAcc(reverseResult.base.totalEquityRequired)} €</strong></div>
                  </div>}
                  {!revPriceHasLimit && <p role="status">{reverseResult.base.priceLimitStatus === "unbounded" ? "Ohne Darlehensrate lässt sich aus dem Cashflow keine endliche Kaufpreisgrenze bestimmen. Das Modell berücksichtigt hier keine Begrenzung deines verfügbaren Eigenkapitals." : "Die Zielmiete reicht bereits für die laufenden Kosten nicht aus."}</p>}
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
                        onClick={() => setRentIncreaseInput("15")}
                        style={{ background: 'var(--success-strong)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.35rem 0.65rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        +15% Fix
                      </button>
                    </div>
                    <div className="input-group input-optional">
                    <label htmlFor="reverse-scenario-cost-increase">Kostenänderung im Szenario (−50 % bis +100 %)</label>
                    <div className="input-wrapper">
                      <input id="reverse-scenario-cost-increase" type="text" inputMode="text" value={scenarioCostInput} onChange={(e) => setScenarioCostInput(e.target.value)} onBlur={() => setScenarioCostInput(formatAcc(scenarioCostIncreasePercent))} onKeyDown={handleEnterKey} aria-describedby="reverse-scenario-cost-increase-help" />
                      <span className="input-suffix">%</span>
                    </div>
                    <small id="reverse-scenario-cost-increase-help">Negative Werte senken die Kosten. Einmalige Änderung von Instandhaltung, Verwaltung und Rücklage im Szenario. Keine jährliche Steigerung; die Basisrechnung bleibt unverändert. Werte werden auf −50 % bis +100 % begrenzt.</small>
                  </div>
                    <label htmlFor="rent-increase" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 500 }}>
                      <span>Mietänderung ({rentIncrease > 0 ? "+" : ""}{formatAcc(rentIncrease)} %)</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Max Kaufpreis neu: <span className="positive" style={{ fontWeight: 700 }}>{describePriceLimit(reverseResult.scenario)}</span></span>
                      <div className="scenario-note">
                        <span>Bei {formatAcc(rentIncrease)} % Miet- und {formatAcc(scenarioCostIncreasePercent)} % Kostenänderung: <strong>{describePriceLimit(reverseResult.scenario)}</strong></span>
                      </div>
                    </label>
                    <div className="input-group input-optional">
                      <label htmlFor="rent-change-input">Mietänderung eingeben (−50 % bis +100 %)</label>
                      <div className="input-wrapper">
                        <input id="rent-change-input" type="text" inputMode="text" value={rentIncreaseInput} onChange={(e) => setRentIncreaseInput(e.target.value)} onBlur={() => setRentIncreaseInput(formatAcc(rentIncrease))} onKeyDown={handleEnterKey} aria-describedby="rent-change-help" />
                        <span className="input-suffix">%</span>
                      </div>
                      <small id="rent-change-help">Negative Werte senken die Soll-Miete. Werte außerhalb des Bereichs werden auf −50 % beziehungsweise +100 % begrenzt.</small>
                    </div>
                    <input
                      id="rent-increase"
                      type="range"
                      min={SCENARIO_PERCENT_MIN} max={SCENARIO_PERCENT_MAX} step="0.1"
                      value={rentIncrease}
                      onChange={(e) => setRentIncreaseInput(e.target.value)}
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
                  <span style={{ color: 'var(--text-muted)' }}>Kaufpreis: bitte prüfen</span>
                  <strong style={{ color: 'var(--text-main)' }}>{scanResult.kaufpreis} €</strong>
                </div>
              )}
              {scanResult.wohnflaeche && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Wohnfläche: bitte prüfen</span>
                  <strong style={{ color: 'var(--text-main)' }}>{scanResult.wohnflaeche} m²</strong>
                </div>
              )}
              {scanResult.mietePM && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Kaltmiete: bitte prüfen</span>
                  <strong style={{ color: 'var(--text-main)' }}>{scanResult.mietePM} €</strong>
                </div>
              )}
              {scanResult.baujahr && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Baujahr: bitte prüfen</span>
                  <strong style={{ color: 'var(--text-main)' }}>{scanResult.baujahr}</strong>
                </div>
              )}
            </div>

            <p>Jedes erkannte Feld bitte prüfen und bei Bedarf nach der Übernahme korrigieren.</p>
            <div className="dialog-actions">
              <button type="button" className="dialog-button dialog-button--secondary" onClick={() => setScanResult(null)}>
                Abbrechen
              </button>
              <button type="button" className="dialog-button dialog-button--primary" onClick={applyScanResult}>
                Geprüfte Werte übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

