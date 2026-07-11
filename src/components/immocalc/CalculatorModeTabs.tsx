import { IconCalculator, IconCrown, IconTargetArrow } from "@tabler/icons-react";

export type CalculatorMode = "standard" | "reverse" | "premium";

interface CalculatorModeTabsProps {
  activeMode: CalculatorMode;
  onModeChange: (mode: CalculatorMode) => void;
}

const MODES = [
  {
    id: "standard" as const,
    label: "Standard-Rechner",
    shortLabel: "Standard",
    icon: IconCalculator,
  },
  {
    id: "reverse" as const,
    label: "Rückwärts-Rechner",
    shortLabel: "Rückwärts",
    icon: IconTargetArrow,
  },
  {
    id: "premium" as const,
    label: "Premium-Analyse",
    shortLabel: "Premium",
    icon: IconCrown,
  },
];

export function CalculatorModeTabs({ activeMode, onModeChange }: CalculatorModeTabsProps) {
  return (
    <div className="tabs-container" role="tablist" aria-label="Rechenmodus">
      {MODES.map(({ id, label, shortLabel, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`${id}-tab`}
          aria-selected={activeMode === id}
          aria-controls={`${id}-panel`}
          className={`tab-button ${activeMode === id ? "active" : ""}`}
          onClick={() => onModeChange(id)}
        >
          <Icon aria-hidden="true" stroke={2} />
          <span className="tab-button__label tab-button__label--full">{label}</span>
          <span className="tab-button__label tab-button__label--short">{shortLabel}</span>
        </button>
      ))}
    </div>
  );
}
