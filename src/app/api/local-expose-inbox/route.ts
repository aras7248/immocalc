import { EXPOSE_FILE_SIZE_ERROR } from "@/lib/exposeFileLimits";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  importExposeFile,
  isSupportedExposeFile,
  MAX_EXPOSE_FILE_BYTES,
} from "@/lib/exposeFileImport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INBOX_DIRECTORY = join(homedir(), "Downloads", "ImmoCalc-Exposes");

const mimeTypeFor = (name: string) => {
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";
  if (extension === "pdf") return "application/pdf";
  if (extension === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (extension === "html" || extension === "htm") return "text/html";
  return "text/plain";
};

const responseHeaders = { "Cache-Control": "no-store" };

function isLocalRequest(request: Request) {
  const host = request.headers.get("host") ?? "";
  const origin = request.headers.get("origin");
  const hasLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host);
  const hasLocalOrigin = origin === null || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
  return hasLocalHost && hasLocalOrigin;
}

async function ensureInboxDirectory() {
  await mkdir(INBOX_DIRECTORY, { recursive: true });
  return INBOX_DIRECTORY;
}

async function newestCandidate(after: number) {
  const directory = await ensureInboxDirectory();
  const entries = await readdir(directory, { withFileTypes: true });
  const candidates = await Promise.all(entries
    .filter((entry) => entry.isFile() && isSupportedExposeFile(entry.name, mimeTypeFor(entry.name)))
    .map(async (entry) => {
      const fullPath = join(directory, entry.name);
      const fileStats = await stat(fullPath);
      return {
        name: entry.name,
        fullPath,
        size: fileStats.size,
        modifiedAtMs: Math.floor(fileStats.mtimeMs),
      };
    }));

  return candidates
    .filter((candidate) => candidate.modifiedAtMs > after)
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs)[0] ?? null;
}

export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return Response.json({ error: "Die lokale PDF-Ablage ist nur auf diesem Computer verfügbar." }, {
      status: 403,
      headers: responseHeaders,
    });
  }

  try {
    const url = new URL(request.url);
    const receivedAfter = Number(url.searchParams.get("after") ?? 0);
    const after = Number.isFinite(receivedAfter) && receivedAfter >= 0 ? receivedAfter : 0;
    const directory = await ensureInboxDirectory();
    const candidate = await newestCandidate(after);

    if (!candidate) {
      return Response.json({ directory, item: null }, { headers: responseHeaders });
    }
    const item = {
      name: candidate.name,
      size: candidate.size,
      modifiedAt: new Date(candidate.modifiedAtMs).toISOString(),
      modifiedAtMs: candidate.modifiedAtMs,
    };
    if (candidate.size === 0 || candidate.size > MAX_EXPOSE_FILE_BYTES) {
      return Response.json({
        directory,
        item,
        error: EXPOSE_FILE_SIZE_ERROR,
      }, { status: 422, headers: responseHeaders });
    }

    const binary = new Uint8Array(await readFile(candidate.fullPath));
    const imported = await importExposeFile({
      name: candidate.name,
      mimeType: mimeTypeFor(candidate.name),
      binary,
    });
    return Response.json({ directory, item, ...imported }, { headers: responseHeaders });
  } catch (error) {
    console.error("Lokaler Exposé-Ordner konnte nicht gelesen werden:", error);
    const message = error instanceof Error
      ? error.message
      : "Der lokale Exposé-Ordner konnte nicht gelesen werden. Prüfe, ob ImmoCalc lokal auf deinem Computer läuft.";
    return Response.json({
      error: message,
    }, { status: 500, headers: responseHeaders });
  }
}
