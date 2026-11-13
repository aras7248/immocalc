import assert from "node:assert/strict";
import test from "node:test";
import { decodeBrowserExposeHandoff } from "./browserExposeHandoff.ts";

const toHash = (payload: unknown) => {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `#immocalc-import=${encoded}`;
};

test("accepts a bounded ImmoScout24 exposé handoff", () => {
  const handoff = decodeBrowserExposeHandoff(toHash({
    sourceUrl: "https://www.immobilienscout24.de/expose/168369115",
    title: "Wohnhaus in Beispielstadt",
    bodyText: "Kaufpreis: 450.000 €\nWohnfläche: 160 m²",
    capturedAt: "2026-10-23T10:00:00.000Z",
  }));

  assert.deepEqual(handoff, {
    sourceUrl: "https://www.immobilienscout24.de/expose/168369115",
    title: "Wohnhaus in Beispielstadt",
    bodyText: "Kaufpreis: 450.000 €\nWohnfläche: 160 m²",
    capturedAt: "2026-10-23T10:00:00.000Z",
  });
});

test("rejects handoffs from other domains or without page text", () => {
  assert.equal(decodeBrowserExposeHandoff(toHash({
    sourceUrl: "https://example.com/expose/168369115",
    title: "Fremde Seite",
    bodyText: "Kaufpreis: 450.000 €",
  })), null);

  assert.equal(decodeBrowserExposeHandoff(toHash({
    sourceUrl: "https://www.immobilienscout24.de/expose/168369115",
    title: "Ohne Text",
    bodyText: "",
  })), null);
});
