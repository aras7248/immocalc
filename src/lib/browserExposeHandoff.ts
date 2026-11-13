export const BROWSER_EXPOSE_HANDOFF_HASH_KEY = "immocalc-import";
const MAX_TITLE_LENGTH = 180;
const MAX_BODY_TEXT_LENGTH = 12_000;

export type BrowserExposeHandoff = {
  sourceUrl: string;
  title: string;
  bodyText: string;
  capturedAt: string;
};

const normalizeText = (value: unknown, maximumLength: number) => (
  typeof value === "string"
    ? value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, maximumLength)
    : ""
);

const isImmoScoutExposeUrl = (value: string) => {
  try {
    const url = new URL(value);
    const isImmoScoutHost = url.hostname === "immobilienscout24.de"
      || url.hostname.endsWith(".immobilienscout24.de");
    return url.protocol === "https:" && isImmoScoutHost && url.pathname.includes("/expose/");
  } catch {
    return false;
  }
};

export const decodeBrowserExposeHandoff = (hash: string): BrowserExposeHandoff | null => {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const encodedPayload = params.get(BROWSER_EXPOSE_HANDOFF_HASH_KEY);
  if (!encodedPayload) return null;

  try {
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const payload: unknown = JSON.parse(decoded);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const record = payload as Record<string, unknown>;
    const sourceUrl = normalizeText(record.sourceUrl, 2_000);
    const title = normalizeText(record.title, MAX_TITLE_LENGTH);
    const bodyText = normalizeText(record.bodyText, MAX_BODY_TEXT_LENGTH);
    const capturedAt = normalizeText(record.capturedAt, 60);

    if (!isImmoScoutExposeUrl(sourceUrl) || !bodyText) return null;
    return {
      sourceUrl,
      title: title || "ImmoScout24-Exposé",
      bodyText,
      capturedAt: capturedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
};
