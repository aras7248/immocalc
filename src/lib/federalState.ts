export const FEDERAL_STATE_BY_GEO_REGION: Record<string, string> = {
  BB: "BB",
  BE: "BE",
  BW: "BW",
  BY: "BY",
  HB: "HB",
  HE: "HE",
  HH: "HH",
  MV: "MV",
  NI: "NI",
  NW: "NRW",
  RP: "RP",
  SH: "SH",
  SL: "SL",
  SN: "SN",
  ST: "ST",
  TH: "TH",
};

export function mapGeoRegionToFederalState(country: string | null, region: string | null) {
  if (country?.toUpperCase() !== "DE" || !region) return null;

  return FEDERAL_STATE_BY_GEO_REGION[region.toUpperCase()] ?? null;
}
