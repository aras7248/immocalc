import { extractBuyerCommission, extractPropertyState } from './exposeAcquisition.ts';

export type ExposeImportResult = {
  objektname?: string;
  address?: string;
  bundesland?: string;
  maklerProzent?: string;
  hasMakler?: boolean;
  commissionWarning?: string;
  kaufpreis?: string;
  wohnflaeche?: string;
  mietePM?: string;
  mietePA?: string;
  anzahlEinheiten?: string;
  baujahr?: string;
};

export type ExposeFact = {
  key: string;
  label: string;
  value: string;
};

export type ExposeFacts = {
  sourceName?: string;
  facts: ExposeFact[];
  warnings: string[];
};

const decodeHtml = (value: string) => value
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/&auml;/gi, "ä")
  .replace(/&ouml;/gi, "ö")
  .replace(/&uuml;/gi, "ü")
  .replace(/&szlig;/gi, "ß")
  .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(parseInt(decimal, 10)));

const stripHtml = (html: string) => decodeHtml(html
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
).trim();

const parseGermanNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const compact = value.replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!compact) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;

  if (lastComma !== -1 && lastDot !== -1) {
    normalized = lastComma > lastDot
      ? compact.replace(/\./g, "").replace(",", ".")
      : compact.replace(/,/g, "");
  } else if (lastComma !== -1) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if ((compact.match(/\./g) ?? []).length > 1 || /\.\d{3}(?:$|\.)/.test(compact)) {
    normalized = compact.replace(/\./g, "");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
};

const formatGermanNumber = (value: number, maximumFractionDigits = 2) => value.toLocaleString("de-DE", {
  minimumFractionDigits: 0,
  maximumFractionDigits,
});

const getByPath = (value: unknown, paths: string[][]): unknown => {
  for (const path of paths) {
    let current: unknown = value;
    for (const key of path) {
      if (current && typeof current === "object" && key in current) {
        current = (current as Record<string, unknown>)[key];
      } else {
        current = undefined;
        break;
      }
    }
    if (current !== undefined && current !== null && current !== "") return current;
  }
  return undefined;
};

const collectJsonLd = (html: string): unknown[] => {
  const items: unknown[] = [];
  const matches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of matches) {
    try {
      const parsed: unknown = JSON.parse(decodeHtml(match[1].trim()));
      if (Array.isArray(parsed)) items.push(...parsed);
      else if (parsed && typeof parsed === "object" && "@graph" in parsed && Array.isArray((parsed as { "@graph"?: unknown })["@graph"])) {
        items.push(...(parsed as { "@graph": unknown[] })["@graph"]);
      } else {
        items.push(parsed);
      }
    } catch {
      // Einzelne ungültige Strukturdatensätze dürfen den Import nicht verhindern.
    }
  }

  return items;
};

const firstMatch = (text: string, expressions: RegExp[]) => {
  for (const expression of expressions) {
    const match = expression.exec(text);
    if (match?.[1]) return match[1];
  }
  return undefined;
};

const uniqueValues = (values: Array<string | undefined>) => Array.from(new Set(
  values
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.replace(/\s+/g, " ").trim()),
));

const allMatches = (text: string, expression: RegExp) => Array.from(text.matchAll(expression))
  .map((match) => match[1]?.replace(/\s+/g, " ").trim())
  .filter((value): value is string => Boolean(value));

const valueFromText = (text: string, expressions: RegExp[], maximumFractionDigits = 2) => {
  const raw = firstMatch(text, expressions);
  const value = parseGermanNumber(raw);
  return value === null ? undefined : formatGermanNumber(value, maximumFractionDigits);
};

const metaContent = (html: string, property: string) => {
  const expression = new RegExp(`<meta[^>]+(?:property|name)=["']${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  return expression.exec(html)?.[1];
};

const tagContentByAttribute = (html: string, attribute: string, value: string) => {
  const escapedAttribute = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = new RegExp(`<[^>]+\\b${escapedAttribute}=["']${escapedValue}["'][^>]*>`, "i").exec(html)?.[0];
  return tag?.match(/\bcontent=["']([^"']+)["']/i)?.[1];
};

/** Only labelled property addresses or property structured data are used;
 * an unlabelled broker/contact address must never become the object address. */
export const extractExposeAddress = (content: string): string | undefined => {
  const street = /(?:[A-ZÄÖÜ][\p{L}.'’ -]{1,65}(?:straße|strasse|str\.|weg|platz|allee|gasse|ring|damm|ufer|chaussee)|(?:Am|An der|Im|Auf der|Unter den) [\p{L}.'’ -]{2,65})\s+\d{1,5}\s?[a-z]?(?:\s*[-/+&]\s*\d{1,5}\s?[a-z]?)*/iu;
  const text = decodeHtml(content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, "\n"));
  const candidates = uniqueValues(Array.from(text.matchAll(/(?:^|\n)\s*(?:Objektadresse|Objektanschrift|Anschrift(?: des Objekts)?|Adresse(?: des Objekts)?|Straße(?:\s*\/\s*Hausnummer)?|Strasse(?:\s*\/\s*Hausnummer)?)\s*:?\s*([^\n]+)(?:\n\s*(\d{5}[^\n]+))?/gimu)).map(match => {
    const before = text.slice(0, match.index);
    const lastContact = Math.max(before.toLowerCase().lastIndexOf("kontakt"), before.toLowerCase().lastIndexOf("ansprechpartner"), before.toLowerCase().lastIndexOf("impressum"), before.toLowerCase().lastIndexOf("makleradresse"), before.toLowerCase().lastIndexOf("so erreichen sie uns"), before.toLowerCase().lastIndexOf("aussteller"));
    const lastObject = Math.max(before.toLowerCase().lastIndexOf("objektadresse"), before.toLowerCase().lastIndexOf("objektdaten"), before.toLowerCase().lastIndexOf("objektlage"), before.toLowerCase().lastIndexOf("lage des objekts"));
    if (!/Objektadresse|Objektanschrift|Adresse des Objekts|Anschrift des Objekts/i.test(match[0]) && lastContact > lastObject) return undefined;
    const value = match[1].trim();
    return street.test(value) ? [value, match[2]].filter(Boolean).join(", ") : undefined;
  }));
  for (const item of collectJsonLd(content)) {
    const address = getByPath(item, [["address"], ["mainEntity", "address"], ["itemOffered", "address"], ["about", "address"]]);
    // Organization / agent addresses describe the seller, not the property.
    const type = getByPath(item, [["@type"]]);
    if (/Organization|Agent|Person|Business/i.test(String(type))) continue;
    if (address && typeof address === "object") {
      const record = address as Record<string, unknown>;
      if (typeof record.streetAddress === "string" && street.test(record.streetAddress)) {
        const locality = [record.postalCode, record.addressLocality].filter(v => typeof v === "string").join(" ");
        candidates.push([record.streetAddress, locality].filter(Boolean).join(", "));
      }
    }
  }
  const unique = uniqueValues(candidates).filter(value => !candidates.some(other => other !== value && other?.startsWith(`${value},`)));
  return unique.length === 1 ? unique[0] : undefined;
};

// Some embedded PDF fonts map the euro glyph to a standalone "e".
// Normalize only directly beside a labelled monetary amount.
const normalizeDocumentText = (text: string) => text
  .replace(/(Kaufpreis\s*(?::|ca\.?)?\s*[\d.]+(?:,\d{1,2})?)\s+e\b/gi, '$1 €')
  .replace(/\be\s+(?=\d[\d.]*,(?:\d{2}|[–—-]))/g, '€ ');

export const extractExposeTextData = (text: string, sourceName = "") => {
  const escapedText = normalizeDocumentText(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const cleanName = sourceName.replace(/\.[a-z0-9]{1,8}$/i, "").trim();
  const escapedName = cleanName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return extractExposeData(`<title>${escapedName}</title><main>${escapedText}</main>`);
};

const extractUnitCount = (text: string): string | undefined => {
  const explicit = /(?:Anzahl\s+(?:Wohn)?einheiten|Wohneinheiten(?:\s+gesamt)?|Anzahl Wohnungen)\s*:?\s*(\d+)\b/i.exec(text)?.[1]
    ?? /\b(\d+)\s+(?:Wohneinheiten|Wohnungen|Mietverträge)\b/i.exec(text)?.[1]
    ?? /\b(?:der|von)\s+(\d+)\s+Mietvertr(?:äge|ägen)\b/i.exec(text)?.[1];
  return explicit && Number(explicit) > 0 ? explicit : undefined;
};

const extractAnnualRent = (text: string) => {
  const match = /(?:Jahresnettokaltmiete|Jahreskaltmiete|Jahresmiete|Mieteinnahmen\s*(?:p\.?\s*a\.?|pro Jahr|jährlich))\b[^€\d]{0,120}(?:€|EUR)?\s*([\d.]+(?:,\d{1,2})?)(?:,?[–—-])?\s*(?:€|EUR)?/i.exec(text);
  return match ? parseGermanNumber(match[1]) : null;
};

/**
 * Extracts evidence-like facts from an exposé without turning inferred values
 * into calculation inputs. The Premium chat can therefore distinguish between
 * a documented fact and a modelling assumption.
 */
export const extractExposeFacts = (content: string, sourceName = ""): ExposeFacts => {
  const text = content.includes("<")
    ? decodeHtml(content
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n"))
    : content;
  const normalizedText = normalizeDocumentText(text)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n");
  const facts: ExposeFact[] = [];
  const warnings: string[] = [];
  const add = (key: string, label: string, value: string | undefined) => {
    if (value) facts.push({ key, label, value: value.replace(/\s+/g, " ").trim() });
  };

  const addresses = uniqueValues([
    ...allMatches(normalizedText, /(?:^|\n)Adresse\s*:?\s*([^\n]{8,100})/gim),
    ...allMatches(normalizedText, /(?:^|\n)Objektadresse\s*:?\s*([^\n]{8,100})/gim),
  ]);
  const livingAreas = uniqueValues(allMatches(
    normalizedText,
    /(?:Wohnfläche|Wohnflaeche)\s*(?:ca\.?|rund)?\s*:?\s*([\d.,]+\s*(?:m²|m2|qm))/gi,
  ));
  const rawPurchasePrices = uniqueValues(allMatches(
    normalizedText,
    /(?:Kaufpreis|Preisvorstellung|Angebotspreis)\s*(?:ca\.?|ab)?\s*:?\s*([\d.\s]+(?:,\d{1,2})?\s*(?:€|EUR))/gi,
  ));
  const purchasePrices = Array.from(new Map(
    rawPurchasePrices.map((value) => [String(parseGermanNumber(value) ?? value), value]),
  ).values());

  add("objectType", "Objektart", firstMatch(normalizedText, [
    /(?:Objektart)\s*:?\s*([^\n]{3,100})/i,
    /((?:Einfamilienhaus|Mehrfamilienhaus|Doppelhaushälfte|Reihenhaus|Wohnung)(?:\s+mit\s+[^\n]{1,60})?)/i,
  ]));
  add("address", "Adresse", extractExposeAddress(content));
  add("location", "Lage / Ortsteil", firstMatch(normalizedText, [
    /(?:Stadt-?\/?.*Ortsteil.*Gemeinde)\s*:?\s*([^\n]{3,100})/i,
    /(?:Wohngegend von)\s*([^,.\n]{3,100})/i,
  ]));
  add("purchasePrice", "Kaufpreis", purchasePrices[0]);
  const annualRent = extractAnnualRent(normalizedText.replace(/\s+/g, " "));
  if (annualRent !== null) add("annualRent", "Jahreskaltmiete laut Exposé", `${formatGermanNumber(annualRent)} €`);
  add("broker", "Maklercourtage", firstMatch(normalizedText, [
    /(?:Provision|Maklercourtage)[^\n]{0,60}?([\d]+(?:[,.]\d+)?\s*%[^\n]{0,35})/i,
  ]));
  add("livingArea", "Wohnfläche", livingAreas[0]);
  add("usableArea", "Nutzfläche", firstMatch(normalizedText, [
    /(?:Nutzfläche)\s*(?:ca\.?|rund)?\s*:?\s*([\d.,]+\s*(?:m²|m2|qm))/i,
  ]));
  add("plotArea", "Grundstück", firstMatch(normalizedText, [
    /(?:Grundstücksgröße|Grundstück)\s*(?:ca\.?|rund)?\s*:?\s*([\d.,]+\s*(?:m²|m2|qm))/i,
  ]));
  add("units", "Wohneinheiten", extractUnitCount(normalizedText));
  add("rooms", "Zimmer", firstMatch(normalizedText, [
    /(?:Anzahl Zimmer|Zimmer gesamt|Gesamtzimmer|(?<!Schlaf)\bZimmer)\s*:?\s*([\d.,]+)/i,
  ]));
  add("yearBuilt", "Baujahr", firstMatch(normalizedText, [
    /(?:Baujahr)\s*:?\s*((?:18|19|20)\d{2})\b/i,
  ]));
  add("heating", "Heizung", firstMatch(normalizedText, [
    /(?:Heizungsart)\s*:?\s*([^\n]{2,80})/i,
  ]));
  add("energySource", "Befeuerung", firstMatch(normalizedText, [
    /(?:Befeuerung)\s*:?\s*([^\n]{2,80})/i,
  ]));
  add("availability", "Übergabe", firstMatch(normalizedText, [
    /(?:Verfügbar ab|Nutzung bei Übergabe)\s*:?\s*([^\n]{2,100})/i,
  ]));
  add("specialFeature", "Besonderheit", firstMatch(normalizedText, [
    /(?:separate\s+Einliegerwohnung[^\n]{0,100}?(?:[\d.,]+\s*(?:m²|m2|qm)))/i,
    /(?:Einliegerwohnung)\s*(?:ca\.?|mit)?\s*:?\s*([\d.,]+\s*(?:m²|m2|qm))/i,
  ]));

  const buildingYears = uniqueValues([
    ...allMatches(normalizedText, /Baujahr\s*:?\s*((?:18|19|20)\d{2})\b/gi),
    ...allMatches(normalizedText, /(?:im Jahre|Baujahr)\s+((?:18|19|20)\d{2})(?=\s+(?:errichtet|erbaut))/gi),
  ]);
  if (buildingYears.length > 1) warnings.push(`Mehrere Gebäude-Baujahre im Exposé: ${buildingYears.join(" / ")}. Bitte je Gebäude prüfen.`);
  if (annualRent !== null) warnings.push("Monatsmiete aus der angegebenen Jahreskaltmiete durch 12 berechnet. Enthaltene Stellplatzmieten bitte nicht zusätzlich erfassen.");
  if (addresses.length > 1) {
    warnings.push(`Abweichende Adressangaben im Exposé: ${addresses.join(" | ")}. Bitte vor jeder Markt- oder Finanzierungsprüfung klären.`);
  }
  if (livingAreas.length > 1) {
    warnings.push(`Mehrere Wohnflächenangaben im Exposé: ${livingAreas.join(" | ")}. Bitte Flächenaufstellung und Wohnflächenberechnung anfordern.`);
  }
  if (purchasePrices.length > 1) {
    warnings.push(`Mehrere Kaufpreisangaben im Exposé: ${purchasePrices.join(" | ")}. Bitte den verbindlichen Kaufpreis bestätigen lassen.`);
  }
  if (!facts.some((fact) => fact.key === "yearBuilt")) {
    warnings.push("Baujahr nicht eindeutig im Exposé gefunden.");
  }
  if (!facts.some((fact) => fact.key === "heating")) {
    warnings.push("Heizungsart oder Heizungsalter nicht eindeutig im Exposé gefunden.");
  }

  return {
    sourceName: sourceName.replace(/\.[a-z0-9]{1,8}$/i, "").trim() || undefined,
    facts,
    warnings,
  };
};

export const extractExposeData = (html: string): ExposeImportResult => {
  const text = stripHtml(html);
  const jsonLd = collectJsonLd(html);
  const result: ExposeImportResult = {};
  result.address = extractExposeAddress(html);

  const title = metaContent(html, "og:title")
    ?? firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
  if (title) result.objektname = decodeHtml(title).replace(/\s+/g, " ").trim().slice(0, 120);

  for (const item of jsonLd) {
    if (!result.kaufpreis) {
      const price = parseGermanNumber(getByPath(item, [["offers", "price"], ["price"]]));
      if (price !== null && price >= 10_000) result.kaufpreis = formatGermanNumber(price);
    }
    if (!result.wohnflaeche) {
      const area = parseGermanNumber(getByPath(item, [["floorSize", "value"], ["livingArea", "value"], ["floorSize"]]));
      if (area !== null && area > 10) result.wohnflaeche = formatGermanNumber(area);
    }
    if (!result.baujahr) {
      const year = getByPath(item, [["dateCreated"], ["yearBuilt"], ["constructionYear"]]);
      const yearMatch = typeof year === "string" ? year.match(/\b(18|19|20)\d{2}\b/) : null;
      if (yearMatch) result.baujahr = yearMatch[0];
    }
  }

  // Einige Portale, darunter Kleinanzeigen, liefern den Angebotspreis als
  // schema.org-Metadatum statt als sichtbares Label im Fließtext.
  result.kaufpreis ??= (() => {
    const price = parseGermanNumber(tagContentByAttribute(html, "itemprop", "price"));
    return price !== null && price >= 10_000 ? formatGermanNumber(price) : undefined;
  })();

  result.kaufpreis ??= valueFromText(text, [
    /(?:Kaufpreis|Preisvorstellung|Angebotspreis|Kaufpreis\s+pro\s+Einheit)\s*(?:ab|ca\.?|von)?\s*[:\-]?\s*([\d.\s]+(?:,\d{1,2})?)\s*(?:€|EUR)/i,
  ]);
  result.wohnflaeche ??= valueFromText(text, [
    /(?:Wohnfläche|Wohnflaeche|Wohnfläche\s+ca\.?)\s*(?:ab|ca\.?|von)?\s*[:\-]?\s*([\d.\s]+(?:,\d{1,2})?)\s*(?:m²|m2|qm)/i,
  ]);
  const monthlyRent = valueFromText(text, [
    /\b(?:Kaltmiete|monatliche\s+Miete|Mieteinnahmen\s*(?:pro\s+Monat|monatlich)?)\s*(?:ab|ca\.?|von)?\s*[:\-]?\s*([\d.\s]+(?:,\d{1,2})?)\s*(?:€|EUR)/i,
  ]);
  // Empfehlungsanzeigen enthalten oft "Mieteinnahmen" und einen fremden
  // Kaufpreis. Solche sechsstelligen Werte sind keine Monatsmiete.
  if (monthlyRent && (parseGermanNumber(monthlyRent) ?? 0) <= 50_000) {
    result.mietePM = monthlyRent;
  }
  if (!result.mietePM) {
    const annualRent = extractAnnualRent(text);
    if (annualRent !== null && annualRent > 0) {
      result.mietePA = formatGermanNumber(annualRent);
      result.mietePM = formatGermanNumber(annualRent / 12);
    }
  }
  result.anzahlEinheiten = extractUnitCount(text);
  result.baujahr ??= firstMatch(text, [
    /(?:Baujahr|Baujahr\s+ca\.?)\s*[:\-]?\s*((?:18|19|20)\d{2})\b/i,
  ]);

  if (result.address) result.objektname = result.address;
  const labelledText = decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, '\n'));
  result.bundesland = extractPropertyState(result.address, labelledText);
  Object.assign(result, extractBuyerCommission(labelledText));

  return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined && value !== "")) as ExposeImportResult;
};
