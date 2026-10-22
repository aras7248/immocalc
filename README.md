# ImmoCalc

ImmoCalc ist eine eigenständige App für Rendite-, Finanzierungs- und Investitionsanalysen von Immobilien. Sie besitzt eine eigene Oberfläche, Navigation, Rechenlogik, Datenhaltung und künftig eigene kostenpflichtige Tarife.

ImmoCalc und ImmoCow verwenden dasselbe zentrale Kundenkonto. Ein bestehender ImmoCow-Zugang kann daher auch für die Anmeldung in ImmoCalc genutzt werden. ImmoCalc wird jedoch nicht als Route oder Rechner in ImmoCow eingebettet.

## Voraussetzungen

- Node.js `>= 22.18`
- das gemeinsam genutzte Supabase-Projekt mit aktivierter E-Mail-/Passwort-Anmeldung
- die Tabelle `immocalc_saved_objects` mit nutzergebundener Row Level Security

Lege lokal eine nicht versionierte `.env.local` mit diesen Werten an:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Damit dasselbe Kundenkonto in beiden Apps funktioniert, müssen ImmoCalc und ImmoCow dieselbe Supabase-Projekt-URL verwenden.

## Entwicklung

```bash
npm install
npm run dev
```

Die Anwendung ist anschließend unter [http://localhost:4001](http://localhost:4001) erreichbar.

## Qualitätssicherung

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Die Unit-Tests decken Normalrechnung, laufende Kosten, aktuelle Grunderwerbsteuersätze, Cash-on-Cash-Rendite, Rückwärtsrechnung und die Premium-Tarifgrenzen ab.

## Rechenmodell

- Der Darlehensbetrag entspricht dem Kaufpreis abzüglich des gewählten Eigenkapitalanteils (Standard 0 %).
- Das eingesetzte Eigenkapital umfasst Kaufnebenkosten plus Eigenkapital im Kaufpreis.
- Instandhaltung, Verwaltung und Rücklage werden vor Cashflow und Cash-on-Cash-Rendite abgezogen.
- Die Rückwärtsrechnung verwendet dieselben Kosten- und Finanzierungsannahmen wie die Normalrechnung.
- Die hinterlegten Grunderwerbsteuersätze entsprechen dem Stand 2026 und sollten bei gesetzlichen Änderungen aktualisiert werden.

Die Ergebnisse sind Modellrechnungen und keine Finanz-, Steuer- oder Rechtsberatung.

## Produktgrenze zu ImmoCow

- Gemeinsam: Kundenkonto sowie harmonisierte Design-Tokens und Oberflächenmuster.
- Getrennt: Navigation, Funktionen, Projekte, Berechnungen, Abonnements, Zahlungen und Produktentwicklung.
- Später kann ImmoCow auf einer Partner-App-Fläche ausschließlich auf ImmoCalc verlinken. Die App selbst und ihre Kundendaten werden dort nicht eingebettet.

Weitere Details stehen in [docs/product-boundaries.md](docs/product-boundaries.md).


## Laufende Überarbeitung nach Claude-Review (20.10.2026)

### A1 und A2 – lokal implementiert, Freigabeprüfungen offen

- Die Standard-Beispielrechnung berücksichtigt 1 €/m² Instandhaltung, 30 € Verwaltung und 50 € zusätzliche Rücklage pro Monat. Cashflow und Nettorendite sind vor Steuern ausgewiesen.
- Standard- und Rückwärtsrechner enthalten Mietausfall/Leerstand (UI-Default 2 %). Der Abzug wirkt auf NOI, Cashflow, Deckung und erforderliche Angebotsmiete. Bruttorendite und Kaufpreisfaktor verwenden weiter die Soll-Miete.
- Speicherformat 3 ergänzt fehlende Mietausfallwerte bei älteren Objekten mit 2 %. Explizit gespeicherte Werte einschließlich 0 % sowie bestehende Kostenwerte bleiben erhalten. Die Migration schreibt keine Datenbankzeilen beim Laden um.
- Direkte Aufrufe der Rechenfunktionen ohne Mietausfallparameter behalten für die API-Kompatibilität den bisherigen Wert 0 %.
- Referenz: 350.000 € Kaufpreis, 21.900 € Jahresmiete und die Beispielkosten ergeben −1.526 €/Jahr vor Mietausfall beziehungsweise −1.964 €/Jahr bei 2 % Mietausfall.
- Stand der Prüfungen: 23 Node-Tests und TypeScript-Prüfung erfolgreich. ESLint und Produktionsbuild können wegen fehlender Abhängigkeiten noch nicht starten (`@eslint-community/eslint-utils`, `@swc/helpers`); der npm-Zugriff ist aus dieser Arbeitsumgebung nicht erreichbar. Die Aufgaben D1, A1 und A2 werden auf einem separaten Review-Branch geführt. Vollständige Prüfungen erfolgen über GitHub Actions. Browserprüfung und Produktionsveröffentlichung stehen aus.

A6 bis F3 sind noch nicht umgesetzt (ausgenommen D1).

## Automatische Prüfungen (D1)

GitHub Actions führt bei Push und Pull Request mit Node 22.18.0 zunächst `npm ci` und anschließend Typecheck, ESLint, Unit-Tests und den Produktionsbuild aus. Für den Build werden ausschließlich Supabase-Platzhalter verwendet; es erfolgen keine Tests gegen produktive Kundendaten. Die CI veröffentlicht die App nicht.

### A3 – Kostensteigerung im Szenario

`scenarioCostIncreasePercent` verändert ausschließlich die Szenariokosten für Instandhaltung, Verwaltung und zusätzliche Rücklage. Standard- und Rückwärtsrechnung sowie die Deckungsanzeige verwenden im Szenario dieselbe Kostenbasis. Die Basisrechnung und Angebotsprüfung bleiben unverändert. Das Feld ist in beiden Rechnern einstellbar, wird gespeichert und beim Laden wiederhergestellt. Alte Speicherstände und direkte API-Aufrufe erhalten den Standardwert 0 %. Dies ist eine einmalige Szenarioänderung und keine jährliche Kostenprojektion.

Validierung für A3: 28 Unit-Tests und TypeScript lokal erfolgreich; vollständige Prüfungen erfolgen im CI des Review-Branches. Der vorangehende A1/A2/D1-Stand hat sämtliche CI-Prüfungen bestanden.

### A4 – Negative Szenarien

Miet- und Kostenänderungen akzeptieren −50 % bis +100 %, einschließlich negativer Dezimalwerte. Die zentralen Grenzen in `src/lib/scenario.ts` gelten für beide Rechenfunktionen, das Laden gespeicherter Objekte und die Oberfläche. Fehlende oder nicht endliche Werte verwenden weiterhin 0 %. Außerhalb des Bereichs liegende Werte werden begrenzt.

Die Textfelder erhalten Zwischenstände wie ein einzelnes Minuszeichen und deutsche Dezimalkommas während der Eingabe; beim Verlassen wird der begrenzte Wert formatiert. Der Mietregler unterstützt denselben Bereich. Gespeicherte negative Miet- und Kostenänderungen bleiben beim erneuten Laden erhalten. Die Basisrechnung bleibt unverändert.

A4 erweitert die fachliche Eingabegrenze aus A3: Negative Kostenänderungen sind nun gültig und werden nicht mehr als ungültige Werte auf 0 gesetzt. Die bisherigen Tests wurden ausschließlich für diese Änderung angepasst. 34 Unit-Tests und TypeScript lokal erfolgreich; Lint und Produktionsbuild werden über GitHub Actions geprüft.

### A5 – Eigenkapital und Finanzierungsstruktur

`equityPercentOfPrice` (0–100 %, Default 0) beschreibt Eigenkapital im Kaufpreis zusätzlich zu den aus Eigenkapital bezahlten Kaufnebenkosten. `financing.principal` ist der verbleibende Darlehensbetrag. Zins, Tilgung, Annuität und Mietdeckung verwenden diesen Betrag. `totalEquityRequired` enthält das gesamte eingesetzte Eigenkapital und bildet die Basis der Cash-on-Cash-Rendite. `acquisitionCosts.equityRequired` bleibt als kompatible Angabe ausschließlich für die Kaufnebenkosten erhalten.

Beide Rechner speichern den Eigenkapitalanteil und die optionale Zinsbindung (`fixedInterestYears`, 1–30 volle Jahre, ohne Angabe `null` im Rechenmodell). Alte Objekte erhalten 0 % Eigenkapital und keine Zinsbindung. Die Zinsbindung verändert die Erstjahresrechnung nicht; Restschuld und Mehrjahresentwicklung folgen mit A6. Die Übernahme aus dem Standardrechner synchronisiert auch die neuen Felder.

Die Rückwärtsrechnung verwendet den finanzierten Kaufpreisanteil. Ohne Darlehensrate gibt es bei ausreichendem Mietertrag keine endliche, allein aus dem Cashflow ableitbare Kaufpreisgrenze (`priceLimitStatus: unbounded`). Die Oberfläche zeigt das ausdrücklich. Bei nicht gedeckten laufenden Kosten gilt `unaffordable`. In beiden Fällen ist `maxPurchasePrice: 0` lediglich ein numerischer Platzhalter für bestehende API-Verbraucher und keine Kaufpreisempfehlung. Die Prüfung eines konkreten Angebotspreises weist weiterhin Darlehen und gesamten Eigenkapitalbedarf aus. Das Modell enthält keine Obergrenze des verfügbaren Eigenkapitalbudgets.

Beispiel ohne Mietausfall: Bei 350.000 € Kaufpreis und 20 % Eigenkapital entfallen 70.000 € auf den Kaufpreis, das Darlehen beträgt 280.000 € und das gesamte Eigenkapital inklusive 42.245 € Kaufnebenkosten beträgt 112.245 €.

Validierung: 43 Unit-Tests einschließlich 0/20/100 % Eigenkapital, unveränderter Ergebnisse beim Standardwert 0 %, Standard-/Rückwärts-Gegenrechnungen und Speicherung älterer Objekte. TypeScript lokal erfolgreich; vollständige Prüfungen erfolgen über GitHub Actions.
