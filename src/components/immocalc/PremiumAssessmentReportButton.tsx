"use client";

import { useEffect, useRef, useState } from "react";
import { IconCheck, IconFileTypePdf, IconLoader2, IconRefresh } from "@tabler/icons-react";
import type { PremiumAssessmentReportData } from "@/lib/premiumAssessmentReport";

type ExportState = "idle" | "loading" | "success" | "error";

export function PremiumAssessmentReportButton({ data }: { data: PremiumAssessmentReportData }) {
  const [state, setState] = useState<ExportState>("idle");
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetRef.current) clearTimeout(resetRef.current);
  }, []);

  const exportReport = async () => {
    if (state === "loading") return;
    setState("loading");
    try {
      const { downloadPremiumAssessmentPdf } = await import("@/lib/premiumAssessmentReport");
      downloadPremiumAssessmentPdf({ ...data, generatedAt: new Date() });
      setState("success");
    } catch (error) {
      console.error("Premium PDF export failed", error);
      setState("error");
    } finally {
      if (resetRef.current) clearTimeout(resetRef.current);
      resetRef.current = setTimeout(() => setState("idle"), 2600);
    }
  };

  const Icon = state === "loading" ? IconLoader2 : state === "success" ? IconCheck : state === "error" ? IconRefresh : IconFileTypePdf;
  const label = state === "loading" ? "Erstellt…" : state === "success" ? "Fertig" : state === "error" ? "Erneut" : "Rechenbericht-PDF";

  return (
    <button
      type="button"
      className="premium-analysis__secondary premium-analysis__report"
      onClick={() => void exportReport()}
      disabled={state === "loading"}
      aria-label="Premium-Investitionsanalyse als PDF herunterladen"
    >
      <Icon size={17} className={state === "loading" ? "is-spinning" : undefined} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
