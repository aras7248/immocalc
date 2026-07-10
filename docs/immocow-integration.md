# Immocalc in Immocow integrieren

## Integrationsstand

Immocalc läuft inzwischen als geschützter Bereich unter `/immocalc` innerhalb von Immocow. Beide Anwendungen verwenden weiterhin dieselbe Tabelle; Immocow teilt nun Sitzung, Navigation, Theme und Supabase-Konfiguration mit dem integrierten Rechner.

```text
Immocow App
├── gemeinsame Authentifizierung und Navigation
├── gemeinsames Designsystem und Marken-Assets
├── geschützte Route /immocalc
│   ├── Rechner-Oberfläche
│   └── reine Domain-Funktionen aus src/lib/calculations.ts
└── serverseitiger Zugriff auf immocalc_saved_objects
```

## Bereits harmonisiert und integriert

- Farb-, Typografie-, Radius- und Abstandsvariablen entsprechen Immocow.
- Hell- und Dunkelmodus verwenden denselben lokalen Theme-Schlüssel.
- Logos, Favicons und PWA-Symbole sind mit den aktuellen Immocow-Assets identisch.
- Rechenlogik und Tests sind unabhängig von React und Supabase.
- Gespeicherte Objekte verwenden stabile UUIDs und eine versionierte Nutzlast (`schemaVersion: 2`).
- Schreib- und Löschzugriffe filtern zusätzlich nach `user_id`.
- Die geschützte Immocow-Route enthält Standard- und Rückwärtsrechnung.
- Der numerische Rechenkern liegt kanonisch unter `ImmoCow/src/domain/immocalc`.
- Ein Persistenzadapter hält bestehende `schemaVersion: 2`-Datensätze in beiden Projekten lesbar.

## Quelle der Wahrheit

Das Schema für `immocalc_saved_objects` liegt in Immocow:

- `ImmoCow/prisma/schema.prisma`
- `ImmoCow/prisma/migrations/20260301213059_add_task_model/migration.sql`

Die Migration aktiviert Row Level Security und beschränkt Lesen, Einfügen, Ändern und Löschen auf `auth.uid() = user_id`. Änderungen am Tabellenvertrag sollten zuerst dort erfolgen.

## Verbleibende Übernahme

1. Den direkten Browserzugriff auf Supabase bei Bedarf durch eine serverseitige Immocow-Datenzugriffsschicht ersetzen; RLS bleibt dabei zwingende zweite Schutzschicht.
2. Vor einer neuen Pflichtfeld-Version eine explizite Migration von `schemaVersion: 2` vorsehen.
3. Einen End-to-End-Test für Anmelden, Berechnen, Speichern, Laden, Löschen und die bestätigte OCR-Übernahme mit einem dedizierten Testkonto ergänzen.

## Authentifizierung

Die eigenständige Anwendung prüft den Benutzer weiterhin mit `supabase.auth.getUser()`. Die integrierte Route verwendet dagegen die bestehende Cookie-/SSR-Sitzung von Immocow und benötigt keinen zweiten Login.

## Fachliche Erweiterungspunkte

Folgende Themen gehören bewusst nicht in den aktuellen Basisscope, sind aber sinnvolle spätere Module:

- steuerliche Betrachtung einschließlich Abschreibung und persönlichem Steuersatz
- unterschiedliche Finanzierungsbausteine und Eigenkapital auf den Kaufpreis
- Mietausfall, Leerstand und nicht umlagefähige Betriebskosten
- Modernisierungsbudget, Förderdarlehen und Zinsänderungsszenarien
- versionierte Markt- und Steuersätze statt fest im Client hinterlegter Werte
