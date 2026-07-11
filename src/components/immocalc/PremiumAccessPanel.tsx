import {
  IconBriefcase,
  IconCircleCheck,
  IconCrown,
  IconLock,
  IconUser,
} from "@tabler/icons-react";
import {
  PREMIUM_PLAN_DEFINITIONS,
  type PremiumPlanId,
} from "@/domain/immocalc/premium";

interface PremiumAccessPanelProps {
  selectedPlan: PremiumPlanId;
  notice: string | null;
  onPlanChange: (plan: PremiumPlanId) => void;
  onUnlock: () => void;
}

const PREMIUM_BENEFITS = [
  "Tilgungsplan",
  "Anschlussfinanzierung",
  "Stressszenarien",
  "Mehrjahresanalyse",
  "PDF-Bericht",
];

export function PremiumAccessPanel({
  selectedPlan,
  notice,
  onPlanChange,
  onUnlock,
}: PremiumAccessPanelProps) {
  return (
    <div id="premium-panel" role="tabpanel" aria-labelledby="premium-tab" className="premium-access">
      <div className="premium-access__main">
        <span className="premium-access__badge">
          <IconCrown size={16} aria-hidden="true" />
          Premium
        </span>

        <div className="premium-access__intro">
          <span className="premium-access__lock" aria-hidden="true">
            <IconLock size={26} />
          </span>
          <div>
            <h2>Investitionsanalyse</h2>
            <p>Finanzierung, Risiken und langfristige Planung in einer umfassenden Analyse.</p>
          </div>
        </div>

        <div className="premium-access__plans" aria-label="ImmoCalc-Tarif auswählen">
          {(Object.keys(PREMIUM_PLAN_DEFINITIONS) as PremiumPlanId[]).map((planId) => {
            const plan = PREMIUM_PLAN_DEFINITIONS[planId];
            const Icon = planId === "investor" ? IconUser : IconBriefcase;
            const isSelected = selectedPlan === planId;
            const limitLabel = plan.projectLimit === null ? "unbegrenzt" : `bis ${plan.projectLimit} Immobilien`;

            return (
              <button
                key={plan.id}
                type="button"
                className={`premium-plan${isSelected ? " premium-plan--selected" : ""}`}
                onClick={() => onPlanChange(plan.id)}
                aria-pressed={isSelected}
              >
                <span className="premium-plan__icon" aria-hidden="true">
                  <Icon size={22} />
                </span>
                <span>
                  <strong>{plan.name} · {limitLabel}</strong>
                  <small>{plan.description}</small>
                </span>
              </button>
            );
          })}
        </div>

        <button type="button" className="premium-access__cta" onClick={onUnlock}>
          <IconLock size={19} aria-hidden="true" />
          Premium freischalten
        </button>

        {notice && <p className="premium-access__notice" role="status">{notice}</p>}
      </div>

      <aside className="premium-access__benefits" aria-label="Premium-Vorteile">
        <h3>Dein Mehrwert auf einen Blick</h3>
        <ul>
          {PREMIUM_BENEFITS.map((benefit) => (
            <li key={benefit}>
              <IconCircleCheck size={18} aria-hidden="true" />
              {benefit}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
