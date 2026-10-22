import {
  IconCheck,
  IconDeviceFloppy,
  IconRefresh,
} from "@tabler/icons-react";
import type { KeyboardEvent } from "react";

interface ActivePropertyBarProps {
  canSave?:boolean;
  errors?: {livingArea?:string;purchasePrice?:string};
  objectName: string;
  livingArea: string;
  purchasePrice: string;
  isSaved: boolean;
  isSaving: boolean;
  isFlashActive: boolean;
  onObjectNameChange: (value: string) => void;
  onLivingAreaChange: (value: string) => void;
  onPurchasePriceChange: (value: string) => void;
  onLivingAreaBlur: () => void;
  onPurchasePriceBlur: () => void;
  onEnterKey: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSync: () => void;
  onSave: () => void;
}

export function ActivePropertyBar({
  errors,
  canSave=true,
  objectName,
  livingArea,
  purchasePrice,
  isSaved,
  isSaving,
  isFlashActive,
  onObjectNameChange,
  onLivingAreaChange,
  onPurchasePriceChange,
  onLivingAreaBlur,
  onPurchasePriceBlur,
  onEnterKey,
  onSync,
  onSave,
}: ActivePropertyBarProps) {
  return (
    <section
      className={`active-property${isFlashActive ? " active-property--flash" : ""}`}
      aria-labelledby="active-property-title"
    >
      <div className="active-property__heading">
        <span id="active-property-title">Aktive Immobilie</span>
        <button type="button" className="active-property__sync" onClick={onSync}>
          <IconRefresh size={14} aria-hidden="true" />
          Standardwerte übernehmen
        </button>
      </div>

      <div className="active-property__fields">
        <label className="active-property__field active-property__field--name">
          <span>Straße / Objekt</span>
          <input
            type="text"
            value={objectName}
            onChange={(event) => onObjectNameChange(event.target.value)}
            placeholder="z. B. Musterstraße 1"
            onKeyDown={onEnterKey}
          />
        </label>
        <label className="active-property__field">
          <span>Wohnfläche</span>{errors?.livingArea && <small role="alert">{errors.livingArea}</small>}
          <span className="active-property__input-wrap">
            <input
              inputMode="decimal"
              type="text"
              aria-invalid={Boolean(errors?.livingArea)}
              value={livingArea}
              onChange={(event) => onLivingAreaChange(event.target.value)}
              onBlur={onLivingAreaBlur}
              onKeyDown={onEnterKey}
            />
            <span aria-hidden="true">m²</span>
          </span>
        </label>
        <label className="active-property__field">
          <span>Kaufpreis</span>{errors?.purchasePrice && <small role="alert">{errors.purchasePrice}</small>}
          <span className="active-property__input-wrap">
            <input
              inputMode="decimal"
              type="text"
              aria-invalid={Boolean(errors?.purchasePrice)}
              value={purchasePrice}
              onChange={(event) => onPurchasePriceChange(event.target.value)}
              onBlur={onPurchasePriceBlur}
              onKeyDown={onEnterKey}
            />
            <span aria-hidden="true">€</span>
          </span>
        </label>
        <button
          type="button"
          className={`active-property__save${isSaved ? " active-property__save--saved" : ""}`}
          onClick={onSave}
          disabled={isSaving || isSaved || !canSave}
          title={isSaved ? "Immobilie ist gespeichert" : "Immobilie speichern"}
          aria-label={isSaving ? "Immobilie wird gespeichert" : isSaved ? "Immobilie ist gespeichert" : "Immobilie speichern"}
        >
          {isSaving ? (
            <span className="spinner-small" aria-hidden="true" />
          ) : (
            <>
              <IconDeviceFloppy size={22} aria-hidden="true" />
              {isSaved && (
                <span className="active-property__saved-check" aria-hidden="true">
                  <IconCheck size={11} stroke={3.5} />
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </section>
  );
}

