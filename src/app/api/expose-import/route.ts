import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { extractExposeData, extractExposeFacts } from "@/lib/exposeImport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_REDIRECTS = 4;
const MAX_RESPONSE_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 8_000;

const isForbiddenAddress = (address: string) => {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("::ffff:")) return isForbiddenAddress(normalized.slice(7));
  if (isIP(normalized) !== 4) return false;

  const [first, second] = normalized.split(".").map(Number);
  return first === 0
    || first === 10
    || first === 127
    || first === 169 && second === 254
    || first === 172 && second >= 16 && second <= 31
    || first === 192 && second === 168;
};

const assertSafeUrl = async (url: URL) => {
  if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("Ungültige Exposé-URL");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Diese URL kann nicht importiert werden");
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address))) {
    throw new Error("Diese URL kann nicht importiert werden");
  }
};

const fetchExpose = async (initialUrl: URL) => {
  let url = initialUrl;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertSafeUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "ImmoCalc-Expose-Import/1.0",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("Zu viele Weiterleitungen beim Exposé-Link");
      url = new URL(location, url);
      continue;
    }

    if (!response.ok) throw new Error(`Das Exposé konnte nicht geladen werden (${response.status})`);
    if (!response.headers.get("content-type")?.includes("text/html")) throw new Error("Der Link verweist nicht auf eine HTML-Exposéseite");

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_RESPONSE_BYTES) throw new Error("Die Exposéseite ist zu groß für den Import");

    const html = await response.text();
    if (html.length > MAX_RESPONSE_BYTES) throw new Error("Die Exposéseite ist zu groß für den Import");
    return { html, sourceUrl: url.href };
  }

  throw new Error("Das Exposé konnte nicht geladen werden");
};

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const rawUrl = body && typeof body === "object" ? (body as { url?: unknown }).url : undefined;
    if (typeof rawUrl !== "string") return Response.json({ error: "Bitte gib einen gültigen Exposé-Link ein." }, { status: 400 });

    const url = new URL(rawUrl);
    const { html, sourceUrl } = await fetchExpose(url);
    const data = extractExposeData(html);

    if (!Object.keys(data).some((key) => key !== "objektname")) {
      return Response.json({ error: "Es konnten keine Rechendaten im Exposé erkannt werden." }, { status: 422 });
    }

    return Response.json({
      data,
      facts: extractExposeFacts(html, sourceUrl),
      sourceUrl,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Das Exposé konnte nicht importiert werden.";
    return Response.json({ error: message }, { status: 400 });
  }
}
