import { mapGeoRegionToFederalState } from "@/lib/federalState";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const federalState = mapGeoRegionToFederalState(
    request.headers.get("x-vercel-ip-country"),
    request.headers.get("x-vercel-ip-country-region"),
  );

  return Response.json(
    { federalState },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
