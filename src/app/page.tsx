"use client";

import { MAX_EXPOSE_FILE_BYTES, EXPOSE_FILE_SIZE_ERROR } from '@/lib/exposeFileLimits';
import { importBrowserExposeFile } from '@/lib/browserExposeFileImport';
import { editExposeReview, validateExposeReview, syncReviewedPremium } from '@/lib/exposeReview';
import { FEDERAL_STATE_NAMES } from '@/lib/exposeAcquisition';
import { ExposeFolderImport } from '@/components/immocalc/ExposeFolderImport';
import { extractOcrTextData } from "@/lib/exposeOcr";
import { parseNumber } from "@/lib/numbers";

import Image from "next/image";
import { useState, useEffect, useId, useRef } from "react";
import {
  IconThumbDown,
  IconThumbUp,
} from "@tabler/icons-react";
import { ActivePropertyBar } from '@/components/immocalc/ActivePropertyBar';
import { CalculatorModeTabs, type CalculatorMode } from '@/components/immocalc/CalculatorModeTabs';
import { InvestmentReportButton } from '@/components/immocalc/InvestmentReportButton';
import { PremiumAccessPanel } from '@/components/immocalc/PremiumAccessPanel';
import { PremiumAnalysisPanel } from '@/components/immocalc/PremiumAnalysisPanel';
import { useAuth } from '@/context/AuthContext';
import { ThemeToggle } from '@/context/ThemeContext';
import {
  normalizePremiumLoans,
  type PremiumInvestmentInput,
  type PremiumPlanId,
} from '@/domain/immocalc/premium';
import {
  calculateCashFlowMarginTarget,
  calculateCashFlowTarget,
  calculateReverse,
  calculateStandard,
  LAND_TRANSFER_TAX_RATES_2026,
} from '@/lib/calculations';
import type {
  InvestmentReportData,
  InvestmentTone,
} from '@/lib/investmentReport';
import {
  extractExposeFacts,
  extractExposeTextData,
  type ExposeFacts,
  type ExposeImportResult,
} from '@/lib/exposeImport';
import { decodeBrowserExposeHandoff } from '@/lib/browserExposeHandoff';
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
  premium: SavedPremiumState | null;
  exposeFacts: ExposeFacts | null;
}

interface SavedPremiumState {
  plan: PremiumPlanId;
  input: PremiumInvestmentInput;
}

type ExposeImportNotice = {
  tone: "success" | "error";
  text: string;
};

type PendingExposeImport = ExposeImportResult & {
  facts?: ExposeFacts;
};

// Helper für Zahlen-Parsing und Formatierung

const formatAcc = (val: number) => {
  if (isNaN(val) || !isFinite(val)) return "0,00";
  return val.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatRounded = (val: number) => {
  if (isNaN(val) || !isFinite(val)) return "0";
  return Math.round(val).toLocaleString("de-DE", { maximumFractionDigits: 0 });
};

const normalizeExposeUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
};

const COMFORT_CASH_FLOW_MARGIN_PERCENT = 10;
const REPORT_BREAK_EVEN_BUFFER_PERCENT = 10;

// Interface for standard calculation
interface CalcState {
  objektname: string;
  exposeUrl: string;
  anzahlEinheiten: string;
  kaufpreis: string;
  bundesland: string;
  notarProzent: string;
  hasMakler: boolean;
  maklerProzent: string;
  eigenkapital: string;
  zins: string;
  tilgung: string;
  mietePM: string;
  mietePA: string;
  potenzialMietsteigerung: string;
  potenzialLeerstandPm: string;
  potenzialStellplaetzePm: string;
  potenzialSolarPm: string;
  potenzialSonstigePm: string;
  wohnflaeche: string;
  baujahr: string;
  instandhaltungQm: string;
  verwaltungPm: string;
  ruecklagePm: string;
  hausgeldNichtUmlagefaehigPm: string;
  sonstigeEigentuemerKostenPm: string;
}

// Interface for reverse calculation
interface ReverseState {
  wohnflaeche: string;
  angebotspreis: string;
  bundesland: string;
  notarProzent: string;
  hasMakler: boolean;
  maklerProzent: string;
  eigenkapital: string;
  zins: string;
  tilgung: string;
  zielMietePA: string;
  zielMietePM: string;
  zielMietpreisQm: string;
  instandhaltungQm: string;
  verwaltungPm: string;
  ruecklagePm: string;
  hausgeldNichtUmlagefaehigPm: string;
  sonstigeEigentuemerKostenPm: string;
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
  exposeUrl: "",
  anzahlEinheiten: "3",
  kaufpreis: "350.000,00",
  bundesland: "NRW",
  notarProzent: "2,00",
  hasMakler: true,
  maklerProzent: "3,57",
  eigenkapital: "",
  zins: "4,00",
  tilgung: "1,50",
  mietePM: "0,00",
  mietePA: "0,00",
  potenzialMietsteigerung: "15,00",
  potenzialLeerstandPm: "0,00",
  potenzialStellplaetzePm: "0,00",
  potenzialSolarPm: "0,00",
  potenzialSonstigePm: "0,00",
  wohnflaeche: "268,00",
  baujahr: "1980",
  instandhaltungQm: "0,00",
  verwaltungPm: "0,00",
  ruecklagePm: "0,00",
  hausgeldNichtUmlagefaehigPm: "",
  sonstigeEigentuemerKostenPm: ""
};

const initialRevState: ReverseState = {
  wohnflaeche: "268,00",
  angebotspreis: "350.000,00",
  bundesland: "NRW",
  notarProzent: "2,00",
  hasMakler: true,
  maklerProzent: "3,57",
  eigenkapital: "",
  zins: "4,00",
  tilgung: "1,50",
  zielMietePA: "32.160,00",
  zielMietePM: "2.680,00",
  zielMietpreisQm: "10,00",
  instandhaltungQm: "1,00",
  verwaltungPm: "30,00",
  ruecklagePm: "50,00",
  hausgeldNichtUmlagefaehigPm: "",
  sonstigeEigentuemerKostenPm: ""
};

const emptyCalcState: CalcState = {
  objektname: "",
  exposeUrl: "",
  anzahlEinheiten: "",
  kaufpreis: "",
  bundesland: "NRW",
  notarProzent: "",
  hasMakler: false,
  maklerProzent: "",
  eigenkapital: "",
  zins: "",
  tilgung: "",
  mietePM: "0,00",
  mietePA: "0,00",
  potenzialMietsteigerung: "15,00",
  potenzialLeerstandPm: "",
  potenzialStellplaetzePm: "",
  potenzialSolarPm: "",
  potenzialSonstigePm: "",
  wohnflaeche: "",
  baujahr: "",
  instandhaltungQm: "",
  verwaltungPm: "",
  ruecklagePm: "",
  hausgeldNichtUmlagefaehigPm: "",
  sonstigeEigentuemerKostenPm: ""
};

const emptyRevState: ReverseState = {
  wohnflaeche: "",
  angebotspreis: "",
  bundesland: "NRW",
  notarProzent: "",
  hasMakler: false,
  maklerProzent: "",
  eigenkapital: "",
  zins: "",
  tilgung: "",
  zielMietePA: "",
  zielMietePM: "",
  zielMietpreisQm: "",
  instandhaltungQm: "",
  verwaltungPm: "",
  ruecklagePm: "",
  hausgeldNichtUmlagefaehigPm: "",
  sonstigeEigentuemerKostenPm: ""
};

const SAVED_OBJECT_SCHEMA_VERSION = 8;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => areValuesEqual(value, right[index]));
  }

  if (!isRecord(left) || !isRecord(right)) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key) => (
      Object.prototype.hasOwnProperty.call(right, key)
      && areValuesEqual(left[key], right[key])
    ));
}

function mergeState<T extends object>(defaults: T, value: unknown): T {
  if (!isRecord(value)) return defaults;

  return Object.fromEntries(
    Object.entries(defaults as Record<string, unknown>).map(([key, fallback]) => {
      const candidate = value[key];
      return [key, typeof candidate === typeof fallback ? candidate : fallback];
    }),
  ) as T;
}

const PREMIUM_NUMERIC_FIELDS = [
  "purchasePrice",
  "livingArea",
  "monthlyRent",
  "notaryPercent",
  "brokerPercent",
  "maintenancePerSqmMonthly",
  "managementMonthly",
  "reserveMonthly",
  "vacancyPercent",
  "renovationCosts",
  "otherInitialCosts",
  "costBufferPercent",
  "equityAmount",
  "interestPercent",
  "repaymentPercent",
  "fixedInterestYears",
  "followUpInterestPercent",
  "specialRepaymentAnnual",
  "rentGrowthPercent",
  "costGrowthPercent",
  "valueGrowthPercent",
  "exitCostPercent",
  "forecastYears",
] as const satisfies ReadonlyArray<keyof PremiumInvestmentInput>;

function parseSavedPremiumState(value: unknown): SavedPremiumState | null {
  if (!isRecord(value) || !isRecord(value.input)) return null;
  if (value.plan !== "investor" && value.plan !== "professional") return null;

  const rawInput = value.input;
  if (typeof rawInput.federalState !== "string" || typeof rawInput.hasBroker !== "boolean") {
    return null;
  }

  const numericValues: Record<string, number> = {};
  for (const field of PREMIUM_NUMERIC_FIELDS) {
    const candidate = rawInput[field];
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) return null;
    numericValues[field] = candidate;
  }

  for (const field of ["nonRecoverableHoaMonthly", "otherOwnerCostsMonthly", "rentDefaultPercent", "interestOnlyYears"] as const) {
    const candidate = rawInput[field];
    numericValues[field] = typeof candidate === "number" && Number.isFinite(candidate) ? candidate : 0;
  }

  return {
    plan: value.plan,
    input: {
      ...numericValues,
      additionalLoans: normalizePremiumLoans(rawInput.additionalLoans),
      federalState: rawInput.federalState,
      hasBroker: rawInput.hasBroker,
    } as unknown as PremiumInvestmentInput,
  };
}

function parseExposeFacts(value: unknown): ExposeFacts | null {
  if (!isRecord(value) || !Array.isArray(value.facts) || !Array.isArray(value.warnings)) return null;
  const facts = value.facts.flatMap((fact) => (
    isRecord(fact)
      && typeof fact.key === "string"
      && typeof fact.label === "string"
      && typeof fact.value === "string"
      ? [{ key: fact.key, label: fact.label, value: fact.value }]
      : []
  ));
  const warnings = value.warnings.filter((warning): warning is string => typeof warning === "string");
  if (!facts.length && !warnings.length) return null;
  return {
    sourceName: typeof value.sourceName === "string" ? value.sourceName : undefined,
    facts: facts.slice(0, 40),
    warnings: warnings.slice(0, 12),
  };
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
  if (!isRecord(payload.rev) || typeof payload.rev.zielMietePM !== "string") {
    parsedRev.zielMietePM = formatAcc(parseNumber(parsedRev.zielMietePA) / 12);
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
    premium: parseSavedPremiumState(payload.premium),
    exposeFacts: parseExposeFacts(payload.exposeFacts),
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
  const [isExposeLinkDialogOpen, setIsExposeLinkDialogOpen] = useState(false);
  const [exposeLinkDraft, setExposeLinkDraft] = useState("");
  const [isExposeLinkImporting, setIsExposeLinkImporting] = useState(false);
  const [exposeImportNotice, setExposeImportNotice] = useState<ExposeImportNotice | null>(null);

  // OCR States
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<PendingExposeImport | null>(null);
  const isScanReviewOpen = Boolean(scanResult);
  const [exposeFacts, setExposeFacts] = useState<ExposeFacts | null>(null);
  const [isFlashActive, setIsFlashActive] = useState(false); // NEU: Flash-Effekt State
  const [isSaving, setIsSaving] = useState(false);
  const [syncedFields, setSyncedFields] = useState<Record<string, boolean>>({}); // NEU: Tracking synchronisierter Felder
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanButtonRef = useRef<HTMLButtonElement>(null);
  const scanDialogRef = useRef<HTMLDivElement>(null);
  const exposeLinkButtonRef = useRef<HTMLButtonElement>(null);
  const exposeLinkInputRef = useRef<HTMLInputElement>(null);
  const exposeLinkDialogRef = useRef<HTMLFormElement>(null);
  const exposeImportNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [isPremiumUnlocked, setIsPremiumUnlocked] = useState(false);
  const [premiumInput, setPremiumInput] = useState<PremiumInvestmentInput | null>(null);
  const [premiumDraftRevision, setPremiumDraftRevision] = useState(0);

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
      if (exposeImportNoticeTimerRef.current) {
        clearTimeout(exposeImportNoticeTimerRef.current);
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
    if (!isScanReviewOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : scanButtonRef.current;
    scanDialogRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setScanResult(null);
      if (event.key === "Tab") {
        const controls = scanDialogRef.current?.querySelectorAll<HTMLElement>('input, select, button:not([disabled]), a[href]');
        if (!controls?.length) return;
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === scanDialogRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === scanDialogRef.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      previouslyFocused?.focus();
    };
  }, [isScanReviewOpen]);

  useEffect(() => {
    if (!isExposeLinkDialogOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : exposeLinkButtonRef.current;
    exposeLinkDialogRef.current?.focus();
    exposeLinkInputRef.current?.focus();

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExposeLinkDialogOpen(false);
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      previouslyFocused?.focus();
    };
  }, [isExposeLinkDialogOpen]);


  // Helper zum Aktualisieren des States (Standard & Synchronisation nach unten)
  const updateCalc = (field: keyof CalcState, value: string | boolean) => {
    if (field === "wohnflaeche" && typeof value === "string") {
      setRev(prev => {
        const next = { ...prev, wohnflaeche: value };
        const area = parseNumber(value);
        if (area > 0) {
          const monthlyRent = parseNumber(next.zielMietpreisQm) * area;
          next.zielMietePM = formatAcc(monthlyRent);
          next.zielMietePA = formatAcc(monthlyRent * 12);
        }
        return next;
      });
    }

    if (field === "kaufpreis" && typeof value === "string") {
      setRev(prev => ({ ...prev, angebotspreis: value }));
    }

    if (field === "eigenkapital" && typeof value === "string") {
      setRev(prev => ({ ...prev, eigenkapital: value }));
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

  // === Exposé-Import: Bilder und Dokumente werden lokal ausgelesen. ===
  const scanImageFile = async (file: File) => {

    if (file.size > MAX_EXPOSE_FILE_BYTES) {
      alert(EXPOSE_FILE_SIZE_ERROR);
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

  const handleExposeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith("image/")) {
      await scanImageFile(file);
      return;
    }

    if (file.size > MAX_EXPOSE_FILE_BYTES) {
      alert(EXPOSE_FILE_SIZE_ERROR);
      return;
    }

    setIsScanning(true);
    try {
      const payload = await importBrowserExposeFile(file);
      setScanResult({ ...payload.data, facts: payload.facts });
    } catch (error) {
      console.error("Exposé-Dateiimport fehlgeschlagen:", error);
      const message = error instanceof Error ? error.message : "Die Datei konnte nicht ausgewertet werden.";
      showExposeImportNotice({ tone: "error", text: message });
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const processOcrText = (text: string) => {
    const results = extractOcrTextData(text);

    if (Object.keys(results).length > 0) {
      setScanResult({ ...results, facts: extractExposeFacts(text, "Bildscan") });
    } else {
      alert("Es konnten keine eindeutigen Daten erkannt werden. Bitte stelle sicher, dass Kaufpreis, Fläche oder Miete im Text sichtbar sind.");
    }
  };

  const applyScanResult = () => {
    if (!scanResult || validateExposeReview(scanResult)) return;
    const reviewed = Object.fromEntries(Object.entries(scanResult).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || undefined : value])) as PendingExposeImport;
    if (reviewed.bundesland) {
      setCalc(prev => ({ ...prev, bundesland: reviewed.bundesland! }));
      setRev(prev => ({ ...prev, bundesland: reviewed.bundesland! }));
    }
    if (reviewed.maklerProzent !== undefined) {
      setCalc(prev => ({ ...prev, maklerProzent: reviewed.maklerProzent!, hasMakler: reviewed.hasMakler ?? prev.hasMakler }));
      setRev(prev => ({ ...prev, maklerProzent: reviewed.maklerProzent!, hasMakler: reviewed.hasMakler ?? prev.hasMakler }));
    }
    if (reviewed.address) updateCalc("objektname", reviewed.address);
    else if (reviewed.objektname && !calc.objektname.trim()) updateCalc("objektname", reviewed.objektname);
    if (reviewed.kaufpreis) updateCalc("kaufpreis", reviewed.kaufpreis);
    if (reviewed.wohnflaeche) updateCalc("wohnflaeche", reviewed.wohnflaeche);
    if (reviewed.mietePM) updateCalc("mietePM", reviewed.mietePM);
    if (reviewed.baujahr) updateCalc("baujahr", reviewed.baujahr);
    setPremiumInput(current => current ? syncReviewedPremium(current, reviewed) : null);
    setPremiumDraftRevision(current => current + 1);
    if (reviewed.facts) setExposeFacts(reviewed.facts);
    setScanResult(null);
  };

  const openExposeLinkDialog = () => {
    setExposeLinkDraft(calc.exposeUrl);
    setIsExposeLinkDialogOpen(true);
  };

  const showExposeImportNotice = (notice: ExposeImportNotice) => {
    if (exposeImportNoticeTimerRef.current) clearTimeout(exposeImportNoticeTimerRef.current);
    setExposeImportNotice(notice);
    exposeImportNoticeTimerRef.current = setTimeout(() => setExposeImportNotice(null), 6_000);
  };

  const applyImportedExpose = (
    data: ExposeImportResult,
    exposeUrl: string,
    facts?: ExposeFacts,
  ) => {
    setPremiumInput(current => current ? syncReviewedPremium(current, data) : null);
    setPremiumDraftRevision(current => current + 1);
    const importedArea = data.wohnflaeche ? parseNumber(data.wohnflaeche) : 0;
    const importedPrice = data.kaufpreis ? parseNumber(data.kaufpreis) : 0;
    const importedRent = data.mietePM ? parseNumber(data.mietePM) : 0;

    setCalc(prev => ({
      ...prev,
      bundesland: data.bundesland ?? prev.bundesland,
      maklerProzent: data.maklerProzent ?? prev.maklerProzent,
      hasMakler: data.hasMakler ?? prev.hasMakler,
      exposeUrl,
      objektname: data.address || (!prev.objektname.trim() && data.objektname ? data.objektname : prev.objektname),
      kaufpreis: importedPrice > 0 ? formatAcc(importedPrice) : prev.kaufpreis,
      wohnflaeche: importedArea > 0 ? formatAcc(importedArea) : prev.wohnflaeche,
      mietePM: importedRent > 0 ? formatAcc(importedRent) : prev.mietePM,
      mietePA: importedRent > 0 ? formatAcc(importedRent * 12) : prev.mietePA,
      baujahr: data.baujahr ?? prev.baujahr,
    }));

    setRev(prev => {
      const next = { ...prev, bundesland: data.bundesland ?? prev.bundesland, maklerProzent: data.maklerProzent ?? prev.maklerProzent, hasMakler: data.hasMakler ?? prev.hasMakler };
      if (importedPrice > 0) next.angebotspreis = formatAcc(importedPrice);
      if (importedArea > 0) {
        next.wohnflaeche = formatAcc(importedArea);
        const targetRent = parseNumber(next.zielMietpreisQm) * importedArea;
        next.zielMietePM = formatAcc(targetRent);
        next.zielMietePA = formatAcc(targetRent * 12);
      }
      return next;
    });

    if (facts) setExposeFacts(facts);
  };

  useEffect(() => {
    const handoff = decodeBrowserExposeHandoff(window.location.hash);
    if (!handoff) return;

    // Die Nutzdaten stehen ausschließlich im Fragment und werden deshalb weder
    // an den Server noch als Referrer an das Exposé-Portal übertragen.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    // Der Ablauf bleibt absichtlich bestehen, wenn React die Effect-Initialisierung
    // im Entwicklungsmodus einmal testweise beendet und neu startet.
    window.requestAnimationFrame(() => {
      const data = extractExposeTextData(handoff.bodyText, handoff.title);
      const hasCalculationData = Boolean(data.kaufpreis || data.wohnflaeche || data.mietePM);

      if (!hasCalculationData) {
        showExposeImportNotice({
          tone: "error",
          text: "Aus dem geöffneten Exposé konnten keine eindeutigen Rechendaten übernommen werden.",
        });
        return;
      }

      applyImportedExpose(
        data,
        handoff.sourceUrl,
        extractExposeFacts(handoff.bodyText, handoff.title),
      );
      const importedFields = [
        data.kaufpreis && "Kaufpreis",
        data.wohnflaeche && "Wohnfläche",
        data.mietePM && "Kaltmiete",
        data.baujahr && "Baujahr",
      ].filter(Boolean);
      showExposeImportNotice({
        tone: "success",
        text: `Aus ImmoScout24 übernommen: ${importedFields.join(", ") || "Exposé-Daten"}.`,
      });
      setIsFlashActive(true);
      window.setTimeout(() => setIsFlashActive(false), 800);
    });
  }, []);

  const applyExposeLink = async () => {
    const normalizedUrl = normalizeExposeUrl(exposeLinkDraft);
    if (normalizedUrl === null) {
      alert("Bitte füge einen gültigen http- oder https-Link ein.");
      return;
    }

    if (!normalizedUrl) {
      updateCalc("exposeUrl", "");
      setIsExposeLinkDialogOpen(false);
      return;
    }

    setIsExposeLinkImporting(true);
    setIsExposeLinkDialogOpen(false);
    updateCalc("exposeUrl", normalizedUrl);

    try {
      const response = await fetch("/api/expose-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const payload = await response.json() as {
        data?: ExposeImportResult;
        facts?: ExposeFacts;
        sourceUrl?: string;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Die Rechendaten konnten nicht aus dem Exposé gelesen werden.");
      }

      applyImportedExpose(payload.data, payload.sourceUrl ?? normalizedUrl, payload.facts);
      const importedFields = [
        payload.data.kaufpreis && "Kaufpreis",
        payload.data.wohnflaeche && "Wohnfläche",
        payload.data.mietePM && "Kaltmiete",
        payload.data.baujahr && "Baujahr",
      ].filter(Boolean);
      showExposeImportNotice({
        tone: "success",
        text: `Übernommen: ${importedFields.join(", ") || "Exposé-Daten"}. Die Berechnung wurde aktualisiert.`,
      });
      setIsFlashActive(true);
      window.setTimeout(() => setIsFlashActive(false), 800);
    } catch (error) {
      console.error("Exposé-Import fehlgeschlagen:", error);
      const message = error instanceof Error ? error.message : "Das Exposé konnte nicht importiert werden.";
      showExposeImportNotice({
        tone: "error",
        text: `${message} Der Link wurde gespeichert. Wenn die Seite den Abruf blockiert, nutze bitte den Foto-Scan.`,
      });
    } finally {
      setIsExposeLinkImporting(false);
    }
  };

  // Berechnungen Standard
  const kaufpreis = parseNumber(calc.kaufpreis) || 0;
  const wohnflaeche = parseNumber(calc.wohnflaeche) || 0;
  const mietePA = parseNumber(calc.mietePA) || 0;
  const eigenkapital = parseNumber(calc.eigenkapital) || 0;
  const zins = parseNumber(calc.zins) || 0;
  const tilgung = parseNumber(calc.tilgung) || 0;
  const [rentIncrease, setRentIncrease] = useState<number>(0);
  const activeSavedObject = savedObjects.find((object) => (
    object.calc.objektname.trim() === calc.objektname.trim()
    && parseNumber(object.calc.wohnflaeche) === parseNumber(calc.wohnflaeche)
    && parseNumber(object.calc.kaufpreis) === parseNumber(calc.kaufpreis)
  ));
  const ownerCosts = {
    nonRecoverableHoaMonthly: parseNumber(calc.hausgeldNichtUmlagefaehigPm),
    otherOwnerCostsMonthly: parseNumber(calc.sonstigeEigentuemerKostenPm),
  };
  const currentPremiumState = premiumInput
    ? {
        plan: selectedPremiumPlan,
        input: { ...premiumInput, ...ownerCosts, interestOnlyYears: premiumInput.interestOnlyYears ?? 0, additionalLoans: normalizePremiumLoans(premiumInput.additionalLoans) },
      }
    : null;
  const activePropertyIsSaved = Boolean(
    activeSavedObject
    && areValuesEqual(activeSavedObject.calc, calc)
    && areValuesEqual(activeSavedObject.rev, rev)
    && areValuesEqual(activeSavedObject.mieten, mieten)
    && activeSavedObject.rentIncrease === rentIncrease
    && areValuesEqual(activeSavedObject.exposeFacts, exposeFacts)
    && areValuesEqual(activeSavedObject.premium, currentPremiumState),
  );
  const grunderwerbsteuer: Record<string, number> = LAND_TRANSFER_TAX_RATES_2026;
  const standardCalculationInput = {
    federalState: calc.bundesland,
    notaryPercent: parseNumber(calc.notarProzent),
    brokerPercent: parseNumber(calc.maklerProzent),
    hasBroker: calc.hasMakler,
    purchasePrice: kaufpreis,
    annualRent: mietePA,
    equityAmount: eigenkapital,
    livingArea: wohnflaeche,
    maintenancePerSqmMonthly: parseNumber(calc.instandhaltungQm),
    managementMonthly: parseNumber(calc.verwaltungPm),
    reserveMonthly: parseNumber(calc.ruecklagePm),
    ...ownerCosts,
    interestPercent: zins,
    repaymentPercent: tilgung,
    scenarioRentIncreasePercent: 0,
  };
  const standardResult = calculateStandard(standardCalculationInput);
  const standardCase = standardResult.base;

  const potenzialMietsteigerung = Math.max(
    0,
    parseNumber(calc.potenzialMietsteigerung),
  );
  const potenzialLeerstandPm = Math.max(0, parseNumber(calc.potenzialLeerstandPm));
  const potenzialStellplaetzePm = Math.max(0, parseNumber(calc.potenzialStellplaetzePm));
  const potenzialSolarPm = Math.max(0, parseNumber(calc.potenzialSolarPm));
  const potenzialSonstigePm = Math.max(0, parseNumber(calc.potenzialSonstigePm));
  const potenzialBasisMietePm = standardCase.monthlyRent * (1 + potenzialMietsteigerung / 100);
  const potenzialZusatzErtraegePm =
    potenzialLeerstandPm +
    potenzialStellplaetzePm +
    potenzialSolarPm +
    potenzialSonstigePm;
  const potenzialMietePm = potenzialBasisMietePm + potenzialZusatzErtraegePm;
  const potenzialMietePa = potenzialMietePm * 12;
  const potenzialResult = calculateStandard({
    ...standardCalculationInput,
    annualRent: potenzialMietePa,
  });

  const gesamtNkProzent = standardResult.acquisitionCosts.totalPercent;
  const maklerEuro = standardResult.acquisitionCosts.brokerAmount;
  const nkEuro = standardResult.acquisitionCosts.totalAmount;
  const summeGesamt = standardResult.totalInvestment;
  const eingesetztesEigenkapital = standardResult.equityUsed;
  const darlehensbetrag = standardResult.financing.principal;
  const finanzierungsquote = standardResult.financingRatioPercent;
  const mietePmSzenario = standardCase.monthlyRent;
  const cashFlowPA = standardCase.cashFlowAnnual;
  const cashFlowPM = standardCase.cashFlowMonthly;
  const mietpreisQm = standardCase.monthlyRentPerSqm;
  const kaufpreisQm = standardResult.squareMeterValues.purchasePricePerSqm;
  const zinsEuroPA = standardResult.financing.interestAnnual;
  const tilgungEuroPA = standardResult.financing.repaymentAnnual;
  const tilgungPM = standardResult.financing.repaymentMonthly;
  const bruttoRendite = standardCase.grossRentalYieldPercent;
  const nettoRendite = standardCase.netRentalYieldPercent;
  const kaufpreisFaktor = standardCase.purchasePriceFactor;
  const roe = standardCase.returnOnEquityPercent;
  const hasEquity = eingesetztesEigenkapital > 0;
  const laufendeKostenPM = standardResult.operatingCosts.totalMonthly;
  const defaultPremiumInput: PremiumInvestmentInput = {
    purchasePrice: kaufpreis,
    livingArea: wohnflaeche,
    monthlyRent: parseNumber(calc.mietePM),
    federalState: calc.bundesland,
    notaryPercent: parseNumber(calc.notarProzent),
    brokerPercent: parseNumber(calc.maklerProzent),
    hasBroker: calc.hasMakler,
    maintenancePerSqmMonthly: parseNumber(calc.instandhaltungQm),
    managementMonthly: parseNumber(calc.verwaltungPm),
    reserveMonthly: parseNumber(calc.ruecklagePm),
    ...ownerCosts,
    vacancyPercent: 0,
    rentDefaultPercent: 0,
    renovationCosts: 0,
    otherInitialCosts: 0,
    costBufferPercent: 10,
    equityAmount: eigenkapital,
    interestPercent: zins,
    repaymentPercent: tilgung,
    fixedInterestYears: 10,
    interestOnlyYears: 0,
    followUpInterestPercent: 5.5,
    specialRepaymentAnnual: 0,
    rentGrowthPercent: 1.5,
    costGrowthPercent: 2,
    valueGrowthPercent: 1.5,
    exitCostPercent: 3,
    forecastYears: 10,
  };

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

      // Fläche und Ziel-m²-Miete bestimmen gemeinsam die Ziel-Monats- und Jahresmiete.
      if ((field === "zielMietpreisQm" || field === "wohnflaeche") && typeof value === "string") {
        const qm = parseNumber(next.zielMietpreisQm);
        const fl = parseNumber(next.wohnflaeche);
        if (fl > 0) {
          const monthlyRent = qm * fl;
          next.zielMietePM = formatAcc(monthlyRent);
          next.zielMietePA = formatAcc(monthlyRent * 12);
        }
      }

      if (field === "zielMietePM" && typeof value === "string") {
        const monthlyRent = parseNumber(value);
        const fl = parseNumber(next.wohnflaeche);
        next.zielMietePA = formatAcc(monthlyRent * 12);
        if (fl > 0) next.zielMietpreisQm = formatAcc(monthlyRent / fl);
      }

      // Synchronisation: Wenn Ziel-Jahresmiete geändert wird, berechne Monats- und m²-Miete.
      if (field === "zielMietePA" && typeof value === "string") {
        const pa = parseNumber(value);
        const fl = parseNumber(next.wohnflaeche);
        next.zielMietePM = formatAcc(pa / 12);
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
    equityAmount: parseNumber(rev.eigenkapital),
    livingArea: parseNumber(calc.wohnflaeche),
    maintenancePerSqmMonthly: parseNumber(rev.instandhaltungQm),
    managementMonthly: parseNumber(rev.verwaltungPm),
    reserveMonthly: parseNumber(rev.ruecklagePm),
    nonRecoverableHoaMonthly: parseNumber(rev.hausgeldNichtUmlagefaehigPm),
    otherOwnerCostsMonthly: parseNumber(rev.sonstigeEigentuemerKostenPm),
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
  const revBasisMietePM = reverseResult.base.monthlyRent;
  const revBasisMietePA = reverseResult.base.annualRent;
  const revBasisMietpreisQm = reverseResult.base.monthlyRentPerSqm;
  const revSzenarioMietePM = reverseResult.scenario.monthlyRent;
  const revSzenarioMietePA = reverseResult.scenario.annualRent;
  const revSzenarioMietpreisQm = reverseResult.scenario.monthlyRentPerSqm;
  const revLaufendeKostenPA = reverseResult.operatingCosts.totalAnnual;
  const revAngebot = reverseResult.offerAnalysis;
  const revFinanzierungsquoteAngebot = kaufpreis > 0
    ? revAngebot.financedAmount / kaufpreis * 100
    : 0;
  const reportReverseInput = {
    federalState: calc.bundesland,
    notaryPercent: parseNumber(calc.notarProzent),
    brokerPercent: parseNumber(calc.maklerProzent),
    hasBroker: calc.hasMakler,
    targetAnnualRent: standardResult.base.annualRent,
    offeredPurchasePrice: kaufpreis,
    equityAmount: eigenkapital,
    livingArea: wohnflaeche,
    maintenancePerSqmMonthly: parseNumber(calc.instandhaltungQm),
    managementMonthly: parseNumber(calc.verwaltungPm),
    reserveMonthly: parseNumber(calc.ruecklagePm),
    ...ownerCosts,
    interestPercent: zins,
    repaymentPercent: tilgung,
    scenarioRentIncreasePercent: 0,
  };
  const reportBreakEven = calculateCashFlowTarget(reportReverseInput, 0);
  const reportComfort = calculateCashFlowMarginTarget(
    reportReverseInput,
    COMFORT_CASH_FLOW_MARGIN_PERCENT,
  );
  const reportCurrentRentValue = calculateReverse(reportReverseInput);
  const reportTargetRentPerSqm = 10;
  const reportTargetRentAnnual = wohnflaeche * reportTargetRentPerSqm * 12;
  const reportTargetRentReverse = calculateReverse({
    ...reportReverseInput,
    targetAnnualRent: reportTargetRentAnnual,
  });
  const reportTargetRentAtOffer = calculateStandard({
    ...standardCalculationInput,
    annualRent: reportTargetRentAnnual,
  });
  const reportTargetRentOfferGap =
    kaufpreis - reportTargetRentReverse.base.maxPurchasePrice;
  const reportBreakEvenBufferMonthlyRent =
    reportBreakEven.requiredMonthlyRentAtOffer *
    (1 + REPORT_BREAK_EVEN_BUFFER_PERCENT / 100);
  const reportBreakEvenBufferMonthlyRentGap =
    reportBreakEvenBufferMonthlyRent - standardResult.base.monthlyRent;
  const reportOfferValueGap = kaufpreis - reportCurrentRentValue.base.maxPurchasePrice;
  const reportOfferValueGapPercent = reportCurrentRentValue.base.maxPurchasePrice > 0
    ? reportOfferValueGap / reportCurrentRentValue.base.maxPurchasePrice * 100
    : 0;
  const dealTone: InvestmentTone = hasEquity
    ? roe > 12
      ? 'positive'
      : roe >= 5
        ? 'neutral'
        : 'negative'
    : cashFlowPM >= 500
      ? 'positive'
      : cashFlowPM >= 0
        ? 'neutral'
        : 'negative';
  const dealLabel = dealTone === 'positive'
    ? 'Positives Szenario'
    : dealTone === 'neutral'
      ? 'Neutrales Szenario'
      : 'Negatives Szenario';
  const DealStatusIcon = dealTone === 'negative' ? IconThumbDown : IconThumbUp;
  const comfortRentChange = standardResult.base.monthlyRent > 0
    ? reportBreakEvenBufferMonthlyRentGap / standardResult.base.monthlyRent * 100
    : 0;
  const plausibility: InvestmentReportData['plausibility'] = comfortRentChange <= 0
    ? {
        tone: 'positive',
        label: 'Sicherheitsziel bereits erreicht',
        explanation: `Die aktuelle Miete erreicht unter den eingegebenen Annahmen bereits die Break-even-Miete zuzüglich ${formatAcc(REPORT_BREAK_EVEN_BUFFER_PERCENT)} % Sicherheitspuffer. Markt- und Vertragsdaten sind dennoch separat zu prüfen.`,
      }
    : comfortRentChange <= 10
      ? {
          tone: 'positive',
          label: 'moderat, aber zu belegen',
          explanation: `Für die Break-even-Miete zuzüglich ${formatAcc(REPORT_BREAK_EVEN_BUFFER_PERCENT)} % Sicherheitspuffer wären rechnerisch ${formatAcc(comfortRentChange)} % mehr Kaltmiete erforderlich. Das kann marktseitig erreichbar sein, muss aber mit Mietspiegel, Verträgen und Mietrecht belegt werden.`,
        }
      : comfortRentChange <= 20
        ? {
            tone: 'neutral',
            label: 'deutlich prüfbedürftig',
            explanation: `Für die Break-even-Miete zuzüglich ${formatAcc(REPORT_BREAK_EVEN_BUFFER_PERCENT)} % Sicherheitspuffer wären rechnerisch ${formatAcc(comfortRentChange)} % mehr Kaltmiete erforderlich. Ohne belastbare Neuvermietungs- oder Mietspiegeldaten sollte dieser Aufschlag nicht als gesichert angesetzt werden.`,
          }
        : {
            tone: 'negative',
            label: 'anspruchsvoll',
            explanation: `Für die Break-even-Miete zuzüglich ${formatAcc(REPORT_BREAK_EVEN_BUFFER_PERCENT)} % Sicherheitspuffer wären rechnerisch ${formatAcc(comfortRentChange)} % mehr Kaltmiete erforderlich. Das ist eine hohe Abweichung vom Ist-Stand und erfordert eine zwingende Markt- und Mietrechtsprüfung.`,
          };
  const investmentReportData: InvestmentReportData = {
    generatedAt: new Date(),
    object: {
      name: calc.objektname.trim() || 'Unbenannte Immobilie',
      livingArea: wohnflaeche,
      unitCount: parseNumber(calc.anzahlEinheiten),
      yearBuilt: parseNumber(calc.baujahr),
      federalState: calc.bundesland,
    },
    status: {
      tone: dealTone,
      label: dealLabel,
      summary: dealTone === 'positive'
        ? `Das aktuelle Szenario liefert ${formatAcc(cashFlowPM)} EUR Cashflow pro Monat und erreicht damit einen komfortablen positiven Bereich.`
        : dealTone === 'neutral'
          ? `Das aktuelle Szenario ist rechnerisch tragfähig, bietet mit ${formatAcc(cashFlowPM)} EUR Cashflow pro Monat aber nur einen begrenzten Sicherheitspuffer.`
          : `Das aktuelle Szenario erzeugt ${formatAcc(cashFlowPM)} EUR Cashflow pro Monat. Kaufpreis, Miete und Finanzierung sollten vor einer Entscheidung angepasst werden.`,
    },
    acquisition: {
      purchasePrice: kaufpreis,
      totalInvestment: standardResult.totalInvestment,
      acquisitionCostPercent: standardResult.acquisitionCosts.totalPercent,
      landTransferTaxPercent: standardResult.acquisitionCosts.landTransferTaxPercent,
      landTransferTaxAmount: standardResult.acquisitionCosts.landTransferTaxAmount,
      notaryPercent: standardResult.acquisitionCosts.notaryPercent,
      notaryAmount: standardResult.acquisitionCosts.notaryAmount,
      brokerPercent: standardResult.acquisitionCosts.brokerPercent,
      brokerAmount: standardResult.acquisitionCosts.brokerAmount,
      equityAmount: standardResult.equityUsed,
      loanAmount: standardResult.financing.principal,
      financingRatioPercent: standardResult.financingRatioPercent,
    },
    rent: {
      monthly: standardResult.base.monthlyRent,
      annual: standardResult.base.annualRent,
      perSqm: standardResult.base.monthlyRentPerSqm,
      operatingCostsMonthly: standardResult.operatingCosts.totalMonthly,
      operatingCostsAnnual: standardResult.operatingCosts.totalAnnual,
      noiMonthly: standardResult.base.noiMonthly,
      noiAnnual: standardResult.base.noiAnnual,
    },
    financing: {
      interestPercent: standardResult.financing.interestPercent,
      repaymentPercent: standardResult.financing.repaymentPercent,
      annuityPercent: standardResult.financing.annuityPercent,
      interestMonthly: standardResult.financing.interestMonthly,
      repaymentMonthly: standardResult.financing.repaymentMonthly,
      debtServiceMonthly: standardResult.financing.annuityMonthly,
    },
    performance: {
      cashFlowMonthly: standardResult.base.cashFlowMonthly,
      cashFlowAnnual: standardResult.base.cashFlowAnnual,
      grossYieldPercent: standardResult.base.grossRentalYieldPercent,
      netYieldPercent: standardResult.base.netRentalYieldPercent,
      purchasePriceFactor: standardResult.base.purchasePriceFactor,
      returnOnEquityPercent: hasEquity
        ? standardResult.base.returnOnEquityPercent
        : null,
    },
    potential: {
      rentIncreasePercent: potenzialMietsteigerung,
      baseRentAfterIncreaseMonthly: potenzialBasisMietePm,
      vacancyReactivationMonthly: potenzialLeerstandPm,
      parkingMonthly: potenzialStellplaetzePm,
      solarMonthly: potenzialSolarPm,
      otherMonthly: potenzialSonstigePm,
      monthly: potenzialResult.base.monthlyRent,
      annual: potenzialResult.base.annualRent,
      perSqm: potenzialResult.base.monthlyRentPerSqm,
      cashFlowMonthly: potenzialResult.base.cashFlowMonthly,
      totalInvestmentPerSqm: potenzialResult.squareMeterValues.totalInvestmentPerSqm,
    },
    targetRent: {
      rentPerSqm: reportTargetRentPerSqm,
      monthly: reportTargetRentReverse.base.monthlyRent,
      annual: reportTargetRentReverse.base.annualRent,
      maxPurchasePrice: reportTargetRentReverse.base.maxPurchasePrice,
      totalInvestment: reportTargetRentReverse.base.totalInvestment,
      purchasePricePerSqm: reportTargetRentReverse.base.purchasePricePerSqm,
      totalInvestmentPerSqm: reportTargetRentReverse.base.totalInvestmentPerSqm,
      acquisitionCosts: reportTargetRentReverse.base.acquisitionCosts.totalAmount,
      loanAmount: reportTargetRentReverse.base.financedAmount,
      cashFlowAtOfferMonthly: reportTargetRentAtOffer.base.cashFlowMonthly,
      offerGap: reportTargetRentOfferGap,
    },
    reverse: {
      valueAtCurrentRent: reportCurrentRentValue.base.maxPurchasePrice,
      totalInvestmentAtCurrentRent: reportCurrentRentValue.base.totalInvestment,
      offerValueGap: reportOfferValueGap,
      offerValueGapPercent: reportOfferValueGapPercent,
      breakEvenBuffer: {
        bufferPercent: REPORT_BREAK_EVEN_BUFFER_PERCENT,
        requiredMonthlyRent: reportBreakEvenBufferMonthlyRent,
        requiredAnnualRent: reportBreakEvenBufferMonthlyRent * 12,
        requiredRentPerSqm: wohnflaeche > 0
          ? reportBreakEvenBufferMonthlyRent / wohnflaeche
          : 0,
        monthlyRentGapToCurrent: reportBreakEvenBufferMonthlyRentGap,
        rentChangePercentToCurrent: standardResult.base.monthlyRent > 0
          ? reportBreakEvenBufferMonthlyRentGap /
            standardResult.base.monthlyRent * 100
          : 0,
        cashFlowMonthly:
          reportBreakEvenBufferMonthlyRent -
          reportBreakEven.requiredMonthlyRentAtOffer,
      },
      breakEven: {
        requiredMonthlyRent: reportBreakEven.requiredMonthlyRentAtOffer,
        requiredAnnualRent: reportBreakEven.requiredAnnualRentAtOffer,
        requiredRentPerSqm: reportBreakEven.requiredMonthlyRentPerSqmAtOffer,
        monthlyRentGap: reportBreakEven.monthlyRentGapAtOffer,
        rentChangePercent: reportBreakEven.requiredRentChangePercentAtOffer,
      },
      comfort: {
        targetCashFlowPercent: reportComfort.targetCashFlowMarginPercent,
        targetCashFlowMonthlyAtOffer: reportComfort.targetCashFlowMonthlyAtOffer,
        targetCashFlowMonthlyAtCurrentRent:
          reportComfort.targetCashFlowMonthlyAtCurrentRent,
        requiredMonthlyRent: reportComfort.requiredMonthlyRentAtOffer,
        requiredAnnualRent: reportComfort.requiredAnnualRentAtOffer,
        requiredRentPerSqm: reportComfort.requiredMonthlyRentPerSqmAtOffer,
        monthlyRentGap: reportComfort.monthlyRentGapAtOffer,
        rentChangePercent: reportComfort.requiredRentChangePercentAtOffer,
        maxPurchasePriceAtCurrentRent: reportComfort.maxPurchasePriceAtCurrentRent,
        totalInvestmentAtCurrentRent: reportComfort.totalInvestmentAtCurrentRent,
      },
    },
    plausibility,
  };

  // Manuelle Synchronisation
  const syncFromCalcToRev = () => {
    const syncedArea = parseNumber(calc.wohnflaeche);
    const syncedTargetPrice = formatAcc(syncedArea > 0 ? parseNumber(calc.mietePA) / syncedArea / 12 : 0);
    setRev(prev => ({
      ...prev,
      bundesland: calc.bundesland,
      notarProzent: calc.notarProzent,
      hasMakler: calc.hasMakler,
      maklerProzent: calc.maklerProzent,
      eigenkapital: calc.eigenkapital,
      zins: calc.zins,
      tilgung: calc.tilgung,
      instandhaltungQm: calc.instandhaltungQm,
      verwaltungPm: calc.verwaltungPm,
      ruecklagePm: calc.ruecklagePm,
      hausgeldNichtUmlagefaehigPm: calc.hausgeldNichtUmlagefaehigPm,
      sonstigeEigentuemerKostenPm: calc.sonstigeEigentuemerKostenPm,
      wohnflaeche: calc.wohnflaeche,
      angebotspreis: calc.kaufpreis,
      zielMietePA: calc.mietePA,
      zielMietePM: calc.mietePM,
      zielMietpreisQm: syncedTargetPrice
    }));
    // Alle synchronisierten Felder markieren
    setSyncedFields({
      bundesland: true,
      notarProzent: true,
      hasMakler: true,
      maklerProzent: true,
      eigenkapital: true,
      zins: true,
      tilgung: true,
      instandhaltungQm: true,
      verwaltungPm: true,
      ruecklagePm: true,
      wohnflaeche: true,
      angebotspreis: true,
      zielMietePA: true,
      zielMietePM: true,
      zielMietpreisQm: true
    });

    // Trigger Flash Effekt
    setIsFlashActive(true);
    setTimeout(() => setIsFlashActive(false), 800);
  };

  const handlePremiumUnlock = () => {
    setPremiumInput((current) => current ?? defaultPremiumInput);
    setIsPremiumUnlocked(true);
    setPremiumNotice(null);
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
      const persistedPremiumInput = premiumInput
        ? {
            ...premiumInput,
            additionalLoans: normalizePremiumLoans(premiumInput.additionalLoans),
            ...ownerCosts,
            purchasePrice: kaufpreis,
            livingArea: wohnflaeche,
            federalState: calc.bundesland,
            notaryPercent: parseNumber(calc.notarProzent),
            brokerPercent: parseNumber(calc.maklerProzent),
            hasBroker: calc.hasMakler,
          }
        : null;
      const payload = {
        user_id: user.id,
        calc_data: {
          schemaVersion: SAVED_OBJECT_SCHEMA_VERSION,
          calc: { ...calc, objektname: nameToSave },
          rev,
          mieten,
          rentIncrease,
          exposeFacts,
          premium: persistedPremiumInput
            ? {
                plan: selectedPremiumPlan,
                input: persistedPremiumInput,
              }
            : null,
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
      const details = isRecord(e)
        ? JSON.stringify({
            message: e.message,
            code: e.code,
            details: e.details,
            hint: e.hint,
          })
        : String(e);
      console.error(`Speichern fehlgeschlagen: ${details}`);
      alert("Das Objekt konnte nicht gespeichert werden. Bitte prüfe deine Verbindung und versuche es erneut.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadObject = (obj: SavedObject) => {
    setCalc(obj.calc);
    setRev({
      ...(obj.rev || rev),
      wohnflaeche: obj.calc.wohnflaeche,
      angebotspreis: obj.calc.kaufpreis,
    });
    setMieten(obj.mieten || [""]);
    setRentIncrease(obj.rentIncrease || 0);
    setExposeFacts(obj.exposeFacts);
    setPremiumInput(obj.premium?.input ?? null);
    setSelectedPremiumPlan(obj.premium?.plan ?? "investor");
    setIsPremiumUnlocked(obj.premium !== null);
    setPremiumNotice(null);
    setPremiumDraftRevision((current) => current + 1);
  };

  const handleClearData = () => {
    if (window.confirm("Möchtest du wirklich alle eingegebenen Werte löschen?")) {
      setCalc(emptyCalcState);
      setRev(emptyRevState);
      setSyncedFields({});
      setMieten([""]);
      setRentIncrease(0);
      setExposeFacts(null);
      setPremiumInput(null);
      setSelectedPremiumPlan("investor");
      setIsPremiumUnlocked(false);
      setPremiumNotice(null);
      setPremiumDraftRevision((current) => current + 1);
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
            title="Exposé hochladen"
            aria-label={isScanning ? "Exposé wird ausgewertet" : "Exposé hochladen"}
          >
            {isScanning ? (
              <div className="spinner-small" aria-hidden="true" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            )}
          </button>
          <input type="file" ref={fileInputRef} onChange={handleExposeUpload} accept="image/*,.pdf,.docx,.txt,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/html" className="sr-only" tabIndex={-1} />

          <button
            ref={exposeLinkButtonRef}
            type="button"
            className={`icon-button expose-link-action${calc.exposeUrl ? ' icon-button--active' : ''}`} 
            onClick={openExposeLinkDialog}
            disabled={isExposeLinkImporting}
            title={isExposeLinkImporting ? "Exposé wird importiert" : calc.exposeUrl ? "Exposé-Link bearbeiten" : "Exposé-Link hinzufügen"}
            aria-label={isExposeLinkImporting ? "Exposé wird importiert" : calc.exposeUrl ? "Exposé-Link bearbeiten" : "Exposé-Link hinzufügen"}
            aria-pressed={isExposeLinkDialogOpen}
          >
            {isExposeLinkImporting ? (
              <div className="spinner-small" aria-hidden="true" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"></path>
                <path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"></path>
              </svg>
            )}
            <span>Exposé-Link</span>
          </button>

          <ExposeFolderImport busy={Boolean(scanResult) || isScanning} onImport={setScanResult} />

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

      <CalculatorModeTabs
        activeMode={activeTab}
        onModeChange={(mode) => {
          setActiveTab(mode);
          setPremiumNotice(null);
        }}
      />

      <ActivePropertyBar
        metrics={[
          { label: "Kaufpreis / m²", value: wohnflaeche > 0 ? `${formatAcc(kaufpreisQm)} €` : "–" },
          { label: "Miete / m²", value: wohnflaeche > 0 && standardCase.monthlyRent > 0 ? `${formatAcc(standardCase.monthlyRentPerSqm)} €` : "–" },
          { label: "Cashflow / Monat", value: `${standardCase.cashFlowMonthly > 0 ? "+" : ""}${formatAcc(standardCase.cashFlowMonthly)} €`, tone: standardCase.cashFlowMonthly < 0 ? "negative" : standardCase.cashFlowMonthly > 0 ? "positive" : undefined },
          { label: "Bankrate / Monat", value: `${formatAcc(standardResult.financing.annuityMonthly)} €` },
        ]}
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

      {exposeImportNotice && (
        <div
          role={exposeImportNotice.tone === "error" ? "alert" : "status"}
          aria-live="polite"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'fit-content', maxWidth: '100%',
            margin: '0.7rem 0 0 auto', padding: '0.5rem 0.75rem', borderRadius: '10px',
            fontSize: '0.78rem', fontWeight: 600,
            color: exposeImportNotice.tone === "success" ? 'var(--success-color)' : 'var(--danger-color)',
            background: exposeImportNotice.tone === "success" ? 'rgba(16, 185, 129, 0.10)' : 'rgba(239, 68, 68, 0.10)',
            border: `1px solid ${exposeImportNotice.tone === "success" ? 'rgba(16, 185, 129, 0.30)' : 'rgba(239, 68, 68, 0.30)'}`,
          }}
        >
          <span aria-hidden="true">{exposeImportNotice.tone === "success" ? '✓' : '!'}</span>
          <span>{exposeImportNotice.text}</span>
        </div>
      )}

      {activeTab === 'premium' && !isPremiumUnlocked && (
        <PremiumAccessPanel
          selectedPlan={selectedPremiumPlan}
          notice={premiumNotice}
          onPlanChange={(plan) => {
            setSelectedPremiumPlan(plan);
            setPremiumNotice(null);
          }}
          onUnlock={handlePremiumUnlock}
        />
      )}

      {activeTab === 'premium' && isPremiumUnlocked && (
        <PremiumAnalysisPanel
          key={`${calc.objektname}-${calc.kaufpreis}-${calc.wohnflaeche}-${premiumDraftRevision}`}
          plan={selectedPremiumPlan}
          seed={{
            objectName: calc.objektname,
            purchasePrice: kaufpreis,
            livingArea: wohnflaeche,
            yearBuilt: parseNumber(calc.baujahr),
            monthlyRent: parseNumber(calc.mietePM),
            federalState: calc.bundesland,
            notaryPercent: parseNumber(calc.notarProzent),
            brokerPercent: parseNumber(calc.maklerProzent),
            hasBroker: calc.hasMakler,
            maintenancePerSqmMonthly: parseNumber(calc.instandhaltungQm),
            managementMonthly: parseNumber(calc.verwaltungPm),
            reserveMonthly: parseNumber(calc.ruecklagePm),
            ...ownerCosts,
            equityAmount: eigenkapital,
            interestPercent: zins,
            repaymentPercent: tilgung,
          }}
          initialInput={premiumInput ?? defaultPremiumInput}
          exposeFacts={exposeFacts}
          onInputChange={setPremiumInput}
          onBackToPlans={() => setIsPremiumUnlocked(false)}
        />
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

                <div className="calculation-row financing-basis-row">
                  <div className="input-group input-optional">
                    <label htmlFor="equity-amount">Eigenkapital</label>
                    <div className="input-wrapper">
                      <input
                        id="equity-amount"
                        inputMode="decimal"
                        type="text"
                        value={calc.eigenkapital}
                        onChange={(e) => updateCalc("eigenkapital", e.target.value)}
                        onBlur={() => handleBlurCalc("eigenkapital")}
                        onKeyDown={handleEnterKey}
                        aria-describedby="equity-amount-help"
                        placeholder="0,00"
                      />
                      <span className="input-suffix">€</span>
                    </div>
                    <small id="equity-amount-help" className="input-helper">
                      Leer oder 0 € bedeutet: Kaufpreis und Nebenkosten werden vollständig finanziert.
                    </small>
                  </div>

                  <div className="input-group output-calc">
                    <label htmlFor="loan-amount">Darlehensbetrag</label>
                    <div className="input-wrapper">
                      <input id="loan-amount" type="text" readOnly value={formatAcc(darlehensbetrag)} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>

                  <div className="input-group output-calc">
                    <label htmlFor="financing-ratio">Finanzierungsquote</label>
                    <div className="input-wrapper">
                      <input id="financing-ratio" type="text" readOnly value={formatAcc(finanzierungsquote)} />
                      <span className="input-suffix">%</span>
                    </div>
                    <small className="input-helper">Darlehen im Verhältnis zum reinen Kaufpreis.</small>
                  </div>
                </div>

                <div className="financing-basis-note" role="status" aria-live="polite">
                  <strong>
                    {eingesetztesEigenkapital > 0 ? "Finanzierung mit Eigenkapital" : "Vollfinanzierung inklusive Nebenkosten"}
                  </strong>
                  <span>
                    {formatAcc(eingesetztesEigenkapital)} € Eigenkapital · {formatAcc(darlehensbetrag)} € Darlehen
                  </span>
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

                <h3 className="cluster-title">4. Mietpotenzial (ohne Renovierungskosten)</h3>
                <p style={{
                  gridColumn: '1 / -1', margin: '-0.4rem 0 0.7rem', color: 'var(--text-muted)',
                  fontSize: '0.78rem', lineHeight: 1.45
                }}>
                  Diese Werte werden ausschließlich im Mietpotenzial der PDF-Auswertung verwendet. Sie verändern weder die Ist-Miete noch enthalten sie Renovierungskosten.
                </p>
                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="potential-rent-increase">Mietsteigerung Bestand</label>
                    <div className="input-wrapper">
                      <input id="potential-rent-increase" inputMode="decimal" type="text" value={calc.potenzialMietsteigerung} onChange={(e) => updateCalc("potenzialMietsteigerung", e.target.value)} onBlur={() => handleBlurCalc("potenzialMietsteigerung")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">%</span>
                    </div>
                    <small className="input-helper">Voreinstellung: 15 %, jederzeit anpassbar.</small>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="potential-vacancy">Leerstand reaktiviert / Monat</label>
                    <div className="input-wrapper">
                      <input id="potential-vacancy" inputMode="decimal" type="text" value={calc.potenzialLeerstandPm} onChange={(e) => updateCalc("potenzialLeerstandPm", e.target.value)} onBlur={() => handleBlurCalc("potenzialLeerstandPm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="potential-parking">Stellplätze / Monat</label>
                    <div className="input-wrapper">
                      <input id="potential-parking" inputMode="decimal" type="text" value={calc.potenzialStellplaetzePm} onChange={(e) => updateCalc("potenzialStellplaetzePm", e.target.value)} onBlur={() => handleBlurCalc("potenzialStellplaetzePm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                </div>
                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="potential-solar">PV / Solar / Monat</label>
                    <div className="input-wrapper">
                      <input id="potential-solar" inputMode="decimal" type="text" value={calc.potenzialSolarPm} onChange={(e) => updateCalc("potenzialSolarPm", e.target.value)} onBlur={() => handleBlurCalc("potenzialSolarPm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="potential-other">Sonstige Einnahmen / Monat</label>
                    <div className="input-wrapper">
                      <input id="potential-other" inputMode="decimal" type="text" value={calc.potenzialSonstigePm} onChange={(e) => updateCalc("potenzialSonstigePm", e.target.value)} onBlur={() => handleBlurCalc("potenzialSonstigePm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                  <div className="input-group output-calc">
                    <label htmlFor="potential-total">Potenzial-Miete / Monat</label>
                    <div className="input-wrapper">
                      <input id="potential-total" type="text" readOnly value={formatAcc(potenzialMietePm)} />
                      <span className="input-suffix">€</span>
                    </div>
                  </div>
                </div>

                <h3 className="cluster-title">5. Laufende, nicht umlagefähige Kosten</h3>
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

                <div className="calculation-row">
                  <div className="input-group input-optional">
                    <label htmlFor="calc-owner-hoa">Nicht umlagefähiges Hausgeld / Monat</label>
                    <div className="input-wrapper">
                      <input id="calc-owner-hoa" inputMode="decimal" type="text" value={calc.hausgeldNichtUmlagefaehigPm} onChange={(e) => updateCalc("hausgeldNichtUmlagefaehigPm", e.target.value)} onBlur={() => handleBlurCalc("hausgeldNichtUmlagefaehigPm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                    <small>Nur den Restbetrag nach Abzug bereits separat erfasster Verwaltung, Rücklage und Instandhaltung eintragen.</small>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="calc-owner-other">Sonstige Eigentümerkosten / Monat</label>
                    <div className="input-wrapper">
                      <input id="calc-owner-other" inputMode="decimal" type="text" value={calc.sonstigeEigentuemerKostenPm} onChange={(e) => updateCalc("sonstigeEigentuemerKostenPm", e.target.value)} onBlur={() => handleBlurCalc("sonstigeEigentuemerKostenPm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                    <small>Nur zusätzliche laufende Kosten erfassen, die in keinem anderen Feld enthalten sind.</small>
                  </div>
                </div>

                <h3 className="cluster-title">6. Finanzierung</h3>
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
                  <div className="input-group output-calc">
                    <label htmlFor="bank-rate-monthly">Rate an die Bank / Monat</label>
                    <div className="input-wrapper">
                      <input id="bank-rate-monthly" type="text" readOnly value={formatAcc(standardResult.financing.annuityMonthly)} />
                      <span className="input-suffix">€</span>
                    </div>
                    <small className="input-helper">Zins + Tilgung, ohne Sondertilgungen.</small>
                  </div>
                </div>

              </div>
            </section>
          </CollapsibleSection>



          <CollapsibleSection
            title="Ergebnisse & Rendite"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>}
            badge={hasEquity ? `${formatAcc(roe)}% CoC` : undefined}
          >
            <section className="results-sticky">
              <div className="glass-panel" style={{ padding: '1rem', background: 'var(--output-calc-bg)', border: 'none', borderRadius: 0, boxShadow: 'none' }}>
                <div className="investment-summary">
                  <div className="investment-summary__primary">
                    <div>
                      <div className="investment-summary__title">
                        <span className="label">Gesamt-Investition</span>
                        <InfoTooltip
                          id="gesamt"
                          title="Gesamt-Investition"
                          text="Kaufpreis + alle Kaufnebenkosten (Grunderwerbsteuer, Notar, Makler). Dies ist der Betrag, den du insgesamt finanzieren oder aufbringen musst."
                          activeId={activeTooltip}
                          onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                        />
                      </div>
                      <span className="investment-summary__value">
                        {formatAcc(summeGesamt)} €
                      </span>
                    </div>

                    <div className="investment-summary__actions">
                      <button
                        type="button"
                        className={`deal-indicator deal-indicator--${dealTone} tooltip-container tooltip-trigger`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveTooltip(activeTooltip === 'dealcheck' ? null : 'dealcheck');
                        }}
                        aria-label={`${dealLabel}: Szenario-Einordnung anzeigen`}
                        aria-expanded={activeTooltip === 'dealcheck'}
                        aria-controls="dealcheck-tooltip"
                      >
                        <span className="deal-indicator__icon-shell" aria-hidden="true">
                          <DealStatusIcon
                            size={28}
                            stroke={1.8}
                            className={dealTone === 'neutral' ? 'deal-indicator__icon--neutral' : undefined}
                          />
                        </span>

                        <span
                          id="dealcheck-tooltip"
                          role="tooltip"
                          className={`tooltip-text deal-indicator__tooltip ${activeTooltip === 'dealcheck' ? 'is-active' : ''}`}
                        >
                          <strong>Einordnung des Szenarios</strong><br /><br />
                          <span className="deal-indicator__tooltip-status">{dealLabel}</span><br />
                          {!hasEquity
                            ? `Ohne Eigenkapital ist die Cash-on-Cash-Rendite nicht berechenbar. Der aktuelle Cashflow beträgt ${formatAcc(cashFlowPM)} € pro Monat.`
                            : `Die Cash-on-Cash-Rendite beträgt ${formatAcc(roe)} %. Der aktuelle Cashflow liegt bei ${formatAcc(cashFlowPM)} € pro Monat.`}
                        </span>
                      </button>
                      <InvestmentReportButton data={investmentReportData} />
                    </div>
                  </div>
                </div>

                {/* Rendite-Analyse Inline */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
                  {hasEquity && (
                    <div className="result-card" style={{ padding: '0.75rem', border: '1px solid var(--accent-color)', background: 'rgba(255,255,255,0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span className="label" style={{ color: 'var(--accent-color)', fontWeight: 700, fontSize: '0.85rem', margin: 0 }}>
                          Cash-on-Cash-Rendite
                        </span>
                        <InfoTooltip
                          id="roe"
                          title="Cash-on-Cash-Rendite"
                          text="Berechnung: Jahrescashflow nach laufenden Kosten und Annuität geteilt durch das tatsächlich eingetragene Eigenkapital."
                          activeId={activeTooltip}
                          onToggle={(id) => setActiveTooltip(activeTooltip === id ? null : id)}
                        />
                      </div>
                      <span className={`value ${roe >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '1.5rem' }}>
                        {formatAcc(roe)} %
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        auf {formatAcc(eingesetztesEigenkapital)} € Eigenkapital
                      </span>
                    </div>
                  )}

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
                      <span className="label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Kaufpreis / m²</span>
                      <InfoTooltip
                        id="preisqm"
                        title="Kaufpreis pro m²"
                        text="Reiner Kaufpreis dividiert durch die Wohnfläche. Kaufnebenkosten und zusätzliche Investitionen sind hier nicht enthalten."
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
                        {formatRounded(mietePmSzenario)} €
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
                <div className="grid-layout">
                  <div className="reverse-target-header">
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

                  <div className="rent-comparison" aria-label="Vergleich zwischen Zielvorgabe und aktuellem Ist-Stand">
                    <div className="rent-comparison__heading">
                      <strong>Zielvorgabe</strong>
                      <span>frei anpassbar</span>
                    </div>
                    <div className="calculation-row rent-target-grid">
                      <div className="input-group input-required">
                        <label htmlFor="target-living-area">Wohnfläche</label>
                        <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.wohnflaeche ? 'input-synced' : ''}`}>
                          <input id="target-living-area" inputMode="decimal" type="text" value={calc.wohnflaeche} onChange={(e) => updateCalc("wohnflaeche", e.target.value)} onBlur={() => handleBlurCalc("wohnflaeche")} onKeyDown={handleEnterKey} />
                          <span className="input-suffix">m²</span>
                        </div>
                      </div>
                      <div className="input-group input-required">
                        <label htmlFor="target-rent-sqm">Miete / m² (Ziel)</label>
                        <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zielMietpreisQm ? 'input-synced' : ''}`} style={{ border: '1px solid var(--accent-color)', borderRadius: '8px' }}>
                          <input id="target-rent-sqm" inputMode="decimal" type="text" value={rev.zielMietpreisQm} onChange={(e) => updateRev("zielMietpreisQm", e.target.value)} onBlur={() => handleBlurRev("zielMietpreisQm")} onKeyDown={handleEnterKey} style={{ fontWeight: 700, color: syncedFields.zielMietpreisQm ? 'var(--success-color)' : 'var(--accent-color)' }} />
                          <span className="input-suffix">€</span>
                        </div>
                      </div>
                      <div className="input-group input-required">
                        <label htmlFor="target-monthly-rent">Kaltmiete / Monat (Ziel)</label>
                        <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.zielMietePM ? 'input-synced' : ''}`}>
                          <input id="target-monthly-rent" inputMode="decimal" type="text" value={rev.zielMietePM} onChange={(e) => updateRev("zielMietePM", e.target.value)} onBlur={() => handleBlurRev("zielMietePM")} onKeyDown={handleEnterKey} />
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

                    <div className="rent-comparison__heading rent-comparison__heading--actual">
                      <strong>Ist-Stand</strong>
                      <span>feste Exposé-Daten aus dem Standard-Rechner</span>
                    </div>
                    <dl className="actual-rent-metrics">
                      <div>
                        <dt>Wohnfläche</dt>
                        <dd>{formatAcc(wohnflaeche)} <span>m²</span></dd>
                      </div>
                      <div>
                        <dt>Aktuelle Miete / m²</dt>
                        <dd>{formatAcc(standardResult.base.monthlyRentPerSqm)} <span>€</span></dd>
                      </div>
                      <div>
                        <dt>Aktuelle Kaltmiete / Monat</dt>
                        <dd>{formatAcc(standardResult.base.monthlyRent)} <span>€</span></dd>
                      </div>
                      <div>
                        <dt>Aktuelle Kaltmiete / p.a.</dt>
                        <dd>{formatAcc(standardResult.base.annualRent)} <span>€</span></dd>
                      </div>
                    </dl>
                  </div>

                  <div className="break-even-rent" role="status" aria-live="polite">
                    <div className="break-even-rent__values">
                      <span>Break-even-Miete für den Angebotspreis</span>
                      <strong>{formatAcc(revAngebot.requiredMonthlyRentPerSqm)} €/m²</strong>
                      <output>{formatAcc(revAngebot.requiredMonthlyRent)} € / Monat</output>
                    </div>
                    <p>
                      Bei dieser Kaltmiete deckt die Immobilie unter den aktuellen Annahmen laufende Kosten,
                      Zins und Tilgung exakt. Der Cashflow vor Steuern beträgt dann 0 € pro Monat.
                    </p>
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

                  <div className="calculation-row financing-basis-row">
                    <div className="input-group input-optional">
                      <label htmlFor="reverse-equity-amount">Eigenkapital</label>
                      <div className={`input-wrapper ${isFlashActive ? 'flash-update' : ''} ${syncedFields.eigenkapital ? 'input-synced' : ''}`}>
                        <input
                          id="reverse-equity-amount"
                          inputMode="decimal"
                          type="text"
                          value={rev.eigenkapital}
                          onChange={(e) => updateRev("eigenkapital", e.target.value)}
                          onBlur={() => handleBlurRev("eigenkapital")}
                          onKeyDown={handleEnterKey}
                          aria-describedby="reverse-equity-amount-help"
                          placeholder="0,00"
                        />
                        <span className="input-suffix">€</span>
                      </div>
                      <small id="reverse-equity-amount-help" className="input-helper">
                        Leer oder 0 € bedeutet vollständige Finanzierung inklusive Nebenkosten.
                      </small>
                    </div>

                    <div className="input-group output-calc">
                      <label htmlFor="reverse-loan-amount">Darlehen für Angebot</label>
                      <div className="input-wrapper">
                        <input id="reverse-loan-amount" type="text" readOnly value={formatAcc(revAngebot.financedAmount)} />
                        <span className="input-suffix">€</span>
                      </div>
                    </div>

                    <div className="input-group output-calc">
                      <label htmlFor="reverse-financing-ratio">Finanzierungsquote</label>
                      <div className="input-wrapper">
                        <input id="reverse-financing-ratio" type="text" readOnly value={formatAcc(revFinanzierungsquoteAngebot)} />
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
                    <label htmlFor="rev-owner-hoa">Nicht umlagefähiges Hausgeld / Monat</label>
                    <div className="input-wrapper">
                      <input id="rev-owner-hoa" inputMode="decimal" type="text" value={rev.hausgeldNichtUmlagefaehigPm} onChange={(e) => updateRev("hausgeldNichtUmlagefaehigPm", e.target.value)} onBlur={() => handleBlurRev("hausgeldNichtUmlagefaehigPm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                    <small>Nur den Restbetrag nach Abzug bereits separat erfasster Verwaltung, Rücklage und Instandhaltung eintragen.</small>
                  </div>
                  <div className="input-group input-optional">
                    <label htmlFor="rev-owner-other">Sonstige Eigentümerkosten / Monat</label>
                    <div className="input-wrapper">
                      <input id="rev-owner-other" inputMode="decimal" type="text" value={rev.sonstigeEigentuemerKostenPm} onChange={(e) => updateRev("sonstigeEigentuemerKostenPm", e.target.value)} onBlur={() => handleBlurRev("sonstigeEigentuemerKostenPm")} onKeyDown={handleEnterKey} />
                      <span className="input-suffix">€</span>
                    </div>
                    <small>Nur zusätzliche laufende Kosten erfassen, die in keinem anderen Feld enthalten sind.</small>
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
                          Gesamtinvestition: {formatAcc(revAngebot.totalInvestment)} € · Eigenkapital: {formatAcc(revAngebot.equityUsed)} € · Darlehen: {formatAcc(revAngebot.financedAmount)} €.
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

                  <div className="reverse-scenario">
                    <div className="reverse-scenario__header">
                      <span>Szenario-Analyse</span>
                      <button
                        type="button"
                        onClick={() => setRentIncrease(15)}
                        style={{ background: 'var(--success-strong)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', padding: '0.35rem 0.65rem', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 700 }}
                      >
                        +15% Fix
                      </button>
                    </div>

                    <label htmlFor="rent-increase" className="reverse-scenario__label">
                      Mietsteigerung (+{rentIncrease}%)
                    </label>

                    <div id="rent-increase-basis" className="reverse-scenario__rent-comparison">
                      <div>
                        <span>Basis-Zielmiete</span>
                        <strong>{formatAcc(revBasisMietePM)} € / Monat</strong>
                        <small>{formatAcc(revBasisMietePA)} € / Jahr</small>
                        <small>{formatAcc(revBasisMietpreisQm)} €/m²</small>
                      </div>
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                        <polyline points="12 5 19 12 12 19"></polyline>
                      </svg>
                      <div>
                        <span>Zielmiete nach +{rentIncrease}%</span>
                        <strong>{formatAcc(revSzenarioMietePM)} € / Monat</strong>
                        <small>{formatAcc(revSzenarioMietePA)} € / Jahr</small>
                        <small>{formatAcc(revSzenarioMietpreisQm)} €/m²</small>
                      </div>
                    </div>

                    <div className="reverse-scenario__price-comparison">
                      <div>
                        <span>Max. Kaufpreis Basis</span>
                        <strong>{formatAcc(revKaufpreis)} €</strong>
                      </div>
                      <div>
                        <span>Max. Kaufpreis bei +{rentIncrease}%</span>
                        <strong className="positive">{formatAcc(revKaufpreisNeu)} €</strong>
                      </div>
                    </div>

                    <input
                      id="rent-increase"
                      type="range"
                      min="0" max="50" step="1"
                      value={rentIncrease}
                      onChange={(e) => setRentIncrease(parseInt(e.target.value))}
                      aria-describedby="rent-increase-basis"
                      style={{ width: '100%', marginTop: '0.5rem', accentColor: 'var(--success-color)', height: '6px', cursor: 'pointer' }}
                    />
                  </div>
                </section>
              </CollapsibleSection>
            </section>
          </div>
        </div>
      )}

      {isExposeLinkDialogOpen && (
        <div className="dialog-backdrop">
          <form
            ref={exposeLinkDialogRef}
            className="glass-panel scan-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="expose-link-title"
            tabIndex={-1}
            onSubmit={(event) => {
              event.preventDefault();
              applyExposeLink();
            }}
          >
            <h2 id="expose-link-title" style={{ color: 'var(--accent-color)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"></path>
                <path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"></path>
              </svg>
              Exposé-Link hinterlegen
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Füge den Link zum Inserat oder Exposé ein. Die öffentlich sichtbaren Objektdaten werden direkt übernommen und die Berechnung startet automatisch.
            </p>
            <label htmlFor="expose-link-input" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.45rem' }}>
              Link zum Exposé
            </label>
            <input
              ref={exposeLinkInputRef}
              id="expose-link-input"
        type="text"
              inputMode="url"
              placeholder="https://…"
              value={exposeLinkDraft}
              onChange={(event) => setExposeLinkDraft(event.target.value)}
              style={{ width: '100%', marginBottom: '1.5rem' }}
            />
            <div className="dialog-actions">
              <button type="button" className="dialog-button dialog-button--secondary" onClick={() => setIsExposeLinkDialogOpen(false)} disabled={isExposeLinkImporting}>
                Abbrechen
              </button>
              <button type="submit" className="dialog-button dialog-button--primary" disabled={isExposeLinkImporting}>
                Link einfügen & berechnen
              </button>
            </div>
          </form>
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
            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>Prüfe und korrigiere die erkannten Werte direkt hier. Erst mit „Werte übernehmen“ ändert sich die Rechnung. Leere Felder lassen den bisherigen Rechenwert unverändert.</p>
            <div className="expose-review-fields">
              <label htmlFor="import-address">Straße / Objekt
                <input id="import-address" type="text" value={scanResult.address ?? ''} placeholder="Adresse ergänzen" onChange={event => setScanResult(previous => previous && editExposeReview(previous, 'address', event.target.value))} />
              </label>
              <label htmlFor="import-state">Bundesland
                <select id="import-state" value={scanResult.bundesland ?? ''} onChange={event => setScanResult(previous => previous && editExposeReview(previous, 'bundesland', event.target.value))}>
                  <option value="">Bisherige Auswahl beibehalten</option>
                  {Object.entries(FEDERAL_STATE_NAMES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
              <small>Bei einer geänderten Adresse bitte auch das Bundesland prüfen. PLZ-Zuordnung: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> (CC BY 4.0).</small>
              {([
                ['maklerProzent', 'Käuferprovision inkl. MwSt.', '%'],
                ['kaufpreis', 'Kaufpreis', '€'],
                ['wohnflaeche', 'Wohnfläche', 'm²'],
                ['mietePM', 'Kaltmiete / Monat', '€'],
                ['baujahr', 'Baujahr', ''],
              ] as const).map(([field, label, unit]) => <label key={field} htmlFor={`import-${field}`}>{label}
                <span className="expose-review-input"><input id={`import-${field}`} type="text" inputMode={field === 'baujahr' ? 'numeric' : 'decimal'} value={scanResult[field] ?? ''} placeholder="Bisherigen Wert beibehalten" onChange={event => setScanResult(previous => previous && editExposeReview(previous, field, event.target.value))} /><span>{unit}</span></span>
              </label>)}
              <small>Für eine provisionsfreie Immobilie 0 % eintragen. Manuelle Änderungen werden in den importierten Angaben als Nutzerkorrektur gekennzeichnet.</small>
              {scanResult.commissionWarning && <p role="alert">{scanResult.commissionWarning}</p>}
              {validateExposeReview(scanResult) && <p role="alert" className="expose-review-error">{validateExposeReview(scanResult)}</p>}
            </div>

            <div className="dialog-actions">
              <button type="button" className="dialog-button dialog-button--secondary" onClick={() => setScanResult(null)}>
                Abbrechen
              </button>
              <button type="button" className="dialog-button dialog-button--primary" onClick={applyScanResult} disabled={Boolean(validateExposeReview(scanResult))}>
                Werte übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
