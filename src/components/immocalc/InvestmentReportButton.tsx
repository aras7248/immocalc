import {
  IconCheck,
  IconFileTypePdf,
  IconLoader2,
  IconRefresh,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";

import type { InvestmentReportData } from "@/lib/investmentReport";

interface InvestmentReportButtonProps {
  data: InvestmentReportData;
}

type ExportState = "idle" | "loading" | "success" | "error";

export function InvestmentReportButton({
  data,
}: InvestmentReportButtonProps) {
  const [exportState, setExportState] = useState<ExportState>("idle");
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleExport = async () => {
    if (exportState === "loading") return;

    setExportState("loading");
    try {
      const { downloadInvestmentReportPdf } = await import(
        "@/lib/investmentReport"
      );
      downloadInvestmentReportPdf({
        ...data,
        generatedAt: new Date(),
      });
      setExportState("success");
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setExportState("idle");
      }, 2600);
    } catch (error) {
      console.error("PDF export failed", error);
      setExportState("error");
    }
  };

  const Icon = exportState === "loading"
    ? IconLoader2
    : exportState === "success"
      ? IconCheck
      : exportState === "error"
        ? IconRefresh
        : IconFileTypePdf;

  const label = exportState === "loading"
    ? "Erstellt…"
    : exportState === "success"
      ? "Fertig"
      : exportState === "error"
        ? "Erneut"
        : "PDF";

  const accessibleLabel = exportState === "loading"
    ? "PDF-Auswertung wird erstellt"
    : exportState === "success"
      ? "PDF-Auswertung erstellt"
      : exportState === "error"
        ? "PDF-Auswertung erneut versuchen"
        : "PDF-Auswertung";

  return (
    <div className="investment-report-export">
      <button
        type="button"
        className={`investment-report-export__button investment-report-export__button--${exportState}`}
        onClick={handleExport}
        disabled={exportState === "loading"}
        aria-label={`${accessibleLabel}: Investitionsanalyse für Bank oder Makler herunterladen`}
      >
        <Icon
          size={17}
          stroke={2}
          aria-hidden="true"
          className={exportState === "loading" ? "is-spinning" : undefined}
        />
        <span>{label}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {exportState === "success"
          ? "Die PDF-Auswertung wurde heruntergeladen."
          : exportState === "error"
            ? "Die PDF-Auswertung konnte nicht erstellt werden."
            : ""}
      </span>
    </div>
  );
}
