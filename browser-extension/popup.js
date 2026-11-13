(() => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const DEFAULT_APP_URL = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? "https://immocalc-two.vercel.app/"
    : "http://localhost:4001/";
  const status = document.querySelector("#page-status");
  const result = document.querySelector("#result");
  const appUrlInput = document.querySelector("#app-url");
  const importButton = document.querySelector("#import-button");
  let activeTabId = null;

  const setResult = (message, isError = false) => {
    result.textContent = message;
    result.classList.toggle("error", isError);
  };

  const encodeHandoff = (payload) => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  };

  const getTargetUrl = (value, payload) => {
    const candidate = value.trim() || DEFAULT_APP_URL;
    const target = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    if (!/^https?:$/.test(target.protocol)) throw new Error("Bitte hinterlege eine gültige ImmoCalc-Adresse.");
    target.hash = `immocalc-import=${encodeHandoff(payload)}`;
    return target.href;
  };

  const captureActiveExpose = async () => {
    if (activeTabId === null) throw new Error("Es ist kein Exposé-Tab aktiv.");
    try {
      return await extensionApi.tabs.sendMessage(activeTabId, { type: "IMMOCALC_CAPTURE_EXPOSE" });
    } catch {
      await extensionApi.scripting.executeScript({ target: { tabId: activeTabId }, files: ["content-expose.js"] });
      return extensionApi.tabs.sendMessage(activeTabId, { type: "IMMOCALC_CAPTURE_EXPOSE" });
    }
  };

  const initialise = async () => {
    const stored = await extensionApi.storage.local.get({ appUrl: DEFAULT_APP_URL });
    appUrlInput.value = stored.appUrl;

    const [tab] = await extensionApi.tabs.query({ active: true, currentWindow: true });
    activeTabId = tab?.id ?? null;
    const isSupported = /^https:\/\/([^.]+\.)?immobilienscout24\.de\/expose\//i.test(tab?.url ?? "");
    if (!isSupported) {
      status.textContent = "Öffne zuerst ein ImmoScout24-Exposé im aktuellen Tab.";
      importButton.disabled = true;
      return;
    }
    status.textContent = "Die sichtbaren Objektdaten dieses Tabs werden übernommen.";
  };

  appUrlInput.addEventListener("change", () => {
    void extensionApi.storage.local.set({ appUrl: appUrlInput.value.trim() || DEFAULT_APP_URL });
  });

  importButton.addEventListener("click", async () => {
    importButton.disabled = true;
    setResult("Daten werden übernommen …");
    try {
      const response = await captureActiveExpose();
      if (!response?.ok || !response.payload?.bodyText) {
        throw new Error(response?.error ?? "Im geöffneten Exposé wurden keine Daten gefunden.");
      }
      const destination = getTargetUrl(appUrlInput.value, response.payload);
      await extensionApi.storage.local.set({ appUrl: appUrlInput.value.trim() || DEFAULT_APP_URL });
      await extensionApi.tabs.create({ url: destination });
      setResult("ImmoCalc wurde mit den Exposé-Daten geöffnet.");
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Die Übergabe ist fehlgeschlagen.", true);
      importButton.disabled = false;
    }
  });

  void initialise().catch((error) => {
    status.textContent = error instanceof Error ? error.message : "Die Erweiterung konnte nicht gestartet werden.";
    importButton.disabled = true;
  });
})();
