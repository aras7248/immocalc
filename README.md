# Immocow Immocalc

Immocalc ist der Rendite- und Finanzierungsrechner im Immocow-Ökosystem. Die Anwendung kann aktuell eigenständig auf Port `4001` laufen und ist so vorbereitet, dass Rechenlogik, Gestaltung und Datenmodell später in Immocow übernommen werden können.

## Voraussetzungen

- Node.js `>= 22.18`
- eine Supabase-Instanz mit aktivierter E-Mail-/Passwort-Anmeldung
- die Tabelle `immocalc_saved_objects` inklusive Row Level Security aus der Immocow-Migration

Lege lokal eine nicht versionierte `.env.local` mit diesen Werten an:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<projekt>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

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

Die Unit-Tests decken Normalrechnung, laufende Kosten, aktuelle Grunderwerbsteuersätze, Cash-on-Cash-Rendite und Rückwärtsrechnung ab.

## Rechenmodell

- Der Kaufpreis wird vollständig finanziert.
- Kaufnebenkosten werden als eingesetztes Eigenkapital behandelt.
- Instandhaltung, Verwaltung und Rücklage werden vor Cashflow und Cash-on-Cash-Rendite abgezogen.
- Die Rückwärtsrechnung verwendet dieselben Kosten- und Finanzierungsannahmen wie die Normalrechnung.
- Die hinterlegten Grunderwerbsteuersätze entsprechen dem Stand 2026 und sollten bei gesetzlichen Änderungen aktualisiert werden.

Die Ergebnisse sind Modellrechnungen und keine Finanz-, Steuer- oder Rechtsberatung.

## Zusammenspiel mit Immocow

Branding, Typografie, Farbvariablen, Hell-/Dunkelmodus und PWA-Assets stammen aus dem aktuellen Immocow-Designsystem. Das Datenmodell und die RLS-Regeln bleiben in Immocow die Quelle der Wahrheit.

Der aktuelle Integrationsstand und die noch offenen Übernahmeschritte sind in [docs/immocow-integration.md](docs/immocow-integration.md) beschrieben. Die Kernfunktionen stehen inzwischen zusätzlich als geschützte Immocow-Route unter `/immocalc` bereit.
