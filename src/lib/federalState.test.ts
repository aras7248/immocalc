import assert from "node:assert/strict";
import test from "node:test";

import { mapGeoRegionToFederalState } from "./federalState.ts";

test("maps German Vercel region codes to calculator state abbreviations", () => {
  assert.equal(mapGeoRegionToFederalState("DE", "NW"), "NRW");
  assert.equal(mapGeoRegionToFederalState("de", "by"), "BY");
  assert.equal(mapGeoRegionToFederalState("DE", "BE"), "BE");
});

test("ignores unknown and non-German regions", () => {
  assert.equal(mapGeoRegionToFederalState("AT", "9"), null);
  assert.equal(mapGeoRegionToFederalState("DE", "XX"), null);
  assert.equal(mapGeoRegionToFederalState(null, null), null);
});
