import { NextResponse } from "next/server";
import {
  buildFinancingResearch,
  defaultPublicRateBenchmark,
  parseBundesbankRateCsv,
  type EnergyPlan,
  type FinancingResearchInput,
  type FinancingUse,
  type HouseholdProfile,
  type PublicRateBenchmark,
} from "@/lib/financingResearch";

const BUNDESBANK_SERIES_URL = "https://api.statistiken.bundesbank.de/rest/data/BBIM1/M.DE.B.A2C.P.R.A.2250.EUR.N?format=bbk_csv&lang=de&lastNObservations=1";

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : fallback;
}

function inputFromBody(value: unknown): FinancingResearchInput {
  const body = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    federalState: typeof body.federalState === "string" ? body.federalState.slice(0, 120) : "",
    objectLocation: typeof body.objectLocation === "string" ? body.objectLocation.slice(0, 180) : undefined,
    residenceLocation: typeof body.residenceLocation === "string" ? body.residenceLocation.slice(0, 120) : undefined,
    financingUse: oneOf<FinancingUse>(body.financingUse, ["unknown", "owner-occupied", "investment"], "unknown"),
    energyPlan: oneOf<EnergyPlan>(body.energyPlan, ["unknown", "none", "efficiency-house"], "unknown"),
    householdProfile: oneOf<HouseholdProfile>(body.householdProfile, ["unknown", "family-with-children", "not-applicable"], "unknown"),
  };
}


async function loadPublicRateBenchmark(): Promise<PublicRateBenchmark> {
  const fallback = defaultPublicRateBenchmark();
  try {
    const response = await fetch(BUNDESBANK_SERIES_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(7_500),
    });
    if (!response.ok) return fallback;
    const parsed = parseBundesbankRateCsv(await response.text());
    if (!parsed) return fallback;
    return {
      ...fallback,
      ...parsed,
      note: "Volumengewichteter Effektivzinssatz für neu vereinbarte Wohnungsbaukredite in Deutschland mit anfänglicher Zinsbindung über 10 Jahre. Orientierung, kein persönliches Bankangebot.",
    };
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  const input = inputFromBody(await request.json().catch(() => null));
  const benchmark = await loadPublicRateBenchmark();
  return NextResponse.json(buildFinancingResearch(input, benchmark), {
    headers: { "Cache-Control": "no-store" },
  });
}
