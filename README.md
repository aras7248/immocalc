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

- Der Kaufpreis wird vollständig finanziert.
- Kaufnebenkosten werden als eingesetztes Eigenkapital behandelt.
- Instandhaltung, Verwaltung und Rücklage werden vor Cashflow und Cash-on-Cash-Rendite abgezogen.
- Die Rückwärtsrechnung verwendet dieselben Kosten- und Finanzierungsannahmen wie die Normalrechnung.
- Die hinterlegten Grunderwerbsteuersätze entsprechen dem Stand 2026 und sollten bei gesetzlichen Änderungen aktualisiert werden.

Die Ergebnisse sind Modellrechnungen und keine Finanz-, Steuer- oder Rechtsberatung.

## Produktgrenze zu ImmoCow

- Gemeinsam: Kundenkonto sowie harmonisierte Design-Tokens und Oberflächenmuster.
- Getrennt: Navigation, Funktionen, Projekte, Berechnungen, Abonnements, Zahlungen und Produktentwicklung.
- Später kann ImmoCow auf einer Partner-App-Fläche ausschließlich auf ImmoCalc verlinken. Die App selbst und ihre Kundendaten werden dort nicht eingebettet.

Weitere Details stehen in [docs/product-boundaries.md](docs/product-boundaries.md).
