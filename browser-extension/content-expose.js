(() => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const INSTALL_FLAG = "__immocalcExposeImportInstalled";
  const MAX_PAGE_TEXT_LENGTH = 12_000;

  if (globalThis[INSTALL_FLAG]) return;
  globalThis[INSTALL_FLAG] = true;

  const clean = (value) => (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const firstText = (selectors) => {
    for (const selector of selectors) {
      const candidate = document.querySelector(selector)?.textContent;
      if (candidate && clean(candidate)) return clean(candidate);
    }
    return "";
  };

  const firstMatch = (text, expressions) => {
    for (const expression of expressions) {
      const match = text.match(expression);
      if (match?.[1]) return clean(match[1]);
    }
    return "";
  };

  const extractExpose = () => {
    const root = document.querySelector("main")
      ?? document.querySelector("[data-qa*='expose']")
      ?? document.body;
    const visibleText = clean(root?.innerText ?? document.body.innerText ?? "");
    const heading = firstText(["h1", "[data-qa='expose-title']"])
      || clean(document.title).replace(/\s*\|\s*ImmoScout24.*$/i, "");

    // Die ergänzten Zeilen machen die Übergabe robust, wenn das Portal Labels
    // und Werte visuell trennt oder seine Klassenbezeichnungen ändert.
    const hints = [
      ["Kaufpreis", firstMatch(visibleText, [
        /(?:Kaufpreis|Preisvorstellung|Angebotspreis)\s*(?:ab|ca\.?|von)?\s*[:\-]?\s*([\d.\s]+(?:,\d{1,2})?)\s*(?:€|EUR)/i,
      ])],
      ["Wohnfläche", firstMatch(visibleText, [
        /(?:Wohnfläche|Wohnflaeche)\s*(?:ab|ca\.?|von)?\s*[:\-]?\s*([\d.\s]+(?:,\d{1,2})?)\s*(?:m²|m2|qm)/i,
      ])],
      ["Kaltmiete", firstMatch(visibleText, [
        /(?:Kaltmiete|Mieteinnahmen|monatliche\s+Miete)\s*(?:ab|ca\.?|von)?\s*[:\-]?\s*([\d.\s]+(?:,\d{1,2})?)\s*(?:€|EUR)/i,
      ])],
      ["Baujahr", firstMatch(visibleText, [
        /(?:Baujahr|Baujahr\s+ca\.?)\s*[:\-]?\s*((?:18|19|20)\d{2})\b/i,
      ])],
    ].filter(([, value]) => Boolean(value)).map(([label, value]) => `${label}: ${value}`);

    return {
      sourceUrl: window.location.href,
      title: heading.slice(0, 180) || "ImmoScout24-Exposé",
      bodyText: clean(`${hints.join("\n")}\n${visibleText}`).slice(0, MAX_PAGE_TEXT_LENGTH),
      capturedAt: new Date().toISOString(),
    };
  };

  extensionApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "IMMOCALC_CAPTURE_EXPOSE") return undefined;
    try {
      sendResponse({ ok: true, payload: extractExpose() });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Die sichtbaren Exposé-Daten konnten nicht gelesen werden.",
      });
    }
    return true;
  });
})();
