export const PREMIUM_ANALYSIS_SCHEMA_VERSION = 1 as const;
export const PREMIUM_CALCULATION_VERSION = "2026.2" as const;

export type PremiumPlanId = "investor" | "professional";
export type ImmocalcAccessLevel = "free" | PremiumPlanId;

export interface PremiumPlanDefinition {
  id: PremiumPlanId;
  name: string;
  description: string;
  projectLimit: number | null;
}

export const PREMIUM_PLAN_DEFINITIONS: Record<PremiumPlanId, PremiumPlanDefinition> = {
  investor: {
    id: "investor",
    name: "Investor",
    description: "Für private Investoren und Einsteiger.",
    projectLimit: 3,
  },
  professional: {
    id: "professional",
    name: "Professional",
    description: "Für Profis mit wachsendem Portfolio.",
    projectLimit: null,
  },
};

export interface PremiumAnalysisEnvelope<TInput = unknown, TResult = unknown> {
  schemaVersion: typeof PREMIUM_ANALYSIS_SCHEMA_VERSION;
  calculationVersion: typeof PREMIUM_CALCULATION_VERSION;
  input: TInput;
  result: TResult | null;
}

export function hasPremiumAccess(level: ImmocalcAccessLevel) {
  return level !== "free";
}

export function getPremiumProjectLimit(level: ImmocalcAccessLevel) {
  if (level === "free") return 0;
  if (level === "professional") return null;
  return PREMIUM_PLAN_DEFINITIONS[level].projectLimit;
}

export function canCreatePremiumProject(level: ImmocalcAccessLevel, currentProjectCount: number) {
  const limit = getPremiumProjectLimit(level);
  if (limit === null) return true;
  return Math.max(0, currentProjectCount) < limit;
}

export function createPremiumAnalysisEnvelope<TInput>(input: TInput): PremiumAnalysisEnvelope<TInput> {
  return {
    schemaVersion: PREMIUM_ANALYSIS_SCHEMA_VERSION,
    calculationVersion: PREMIUM_CALCULATION_VERSION,
    input,
    result: null,
  };
}


export function resolveAccessLevel(value:unknown,now=Date.now()):ImmocalcAccessLevel {
 if(typeof value!=='object'||value===null)return 'free';
 const row=value as Record<string,unknown>;
 if(row.valid_until!=null&&(typeof row.valid_until!=='string'||!Number.isFinite(Date.parse(row.valid_until))||Date.parse(row.valid_until)<=now))return 'free';
 return row.level==='investor'||row.level==='professional'?row.level:'free';
}
