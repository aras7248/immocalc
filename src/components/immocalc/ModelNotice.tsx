import { LAND_TRANSFER_TAX_REVIEW } from "@/lib/calculations";
export function ModelNotice() {
  return <p className="model-notice">Modellrechnung, keine Anlage-, Steuer- oder Rechtsberatung. Angaben ohne Gewähr.</p>;
}

export function TaxSourceNotice() {
 return <p className="model-notice">Grunderwerbsteuer: Stand 2026, Quelle: Landesgesetze. Geprüft am {LAND_TRANSFER_TAX_REVIEW.checkedOn}. <a href={LAND_TRANSFER_TAX_REVIEW.overviewUrl}>Länderübersicht</a> · <a href={LAND_TRANSFER_TAX_REVIEW.bremenUrl}>Aktuelles Gesetz Bremen</a></p>;
}
