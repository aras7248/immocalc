import { importExposeFile } from "@/lib/exposeFileImport";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Bitte wähle eine Datei aus." }, { status: 400 });
    }
    const binary = new Uint8Array(await file.arrayBuffer());
    const imported = await importExposeFile({ name: file.name, mimeType: file.type, binary });

    return Response.json({
      ...imported,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Exposé-Dateiimport fehlgeschlagen:", error);
    const message = error instanceof Error
      ? error.message
      : "Die Datei konnte nicht gelesen werden. Bitte prüfe das Format und versuche es erneut.";
    return Response.json({ error: message }, { status: 400 });
  }
}
