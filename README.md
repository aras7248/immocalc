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

## Exposé-Import: erste Testversion

Auf der Seite `/bewertung` kann ein Exposé als PDF (bis 30 Seiten, 15 MB) oder als Bilddatei
(JPG, PNG, WEBP; bis 15 MB) eingelesen werden.

Die App zerlegt PDF-Dateien in einzelne Seiten, lässt jede Seite von einem KI-Modell
einschließlich Bildern und Tabellen auswerten und zeigt die erkannten Angaben mit
Seitenzahl und Beleg an. Die Seitenzahl wird technisch geprüft. Ist auch nur eine Seite
unlesbar, bleiben Bewertung und PDF-Ausgabe gesperrt. Erkennbare Widersprüche
müssen ebenfalls zuerst geklärt werden.

**Wichtig:** Eine technisch vollständige Seitenbearbeitung garantiert keine
hundertprozentige Fehlerfreiheit. Die KI kann Zahlen oder Details übersehen.
Deshalb müssen wichtige Angaben und die Antworten auf Rückfragen vom Nutzer bestätigt
werden. Ohne diese Bestätigung rechnet die Bewertungsseite nicht.

### Einrichtung

Ergänze nur auf dem Server (Vercel-Projektvariablen / lokale `.env.local`):

```dotenv
OPENAI_API_KEY=<serverseitiger API-Schlüssel>
OPENAI_EXPOSE_MODEL=gpt-4.1
```

`OPENAI_EXPOSE_MODEL` ist optional; der Standardwert ist `gpt-4.1`.
Der Schlüssel darf niemals mit `NEXT_PUBLIC_` beginnen oder im Browser stehen.
Außerdem müssen die bestehenden Supabase-Variablen vorhanden sein. Die API
prüft vor jedem Import den angemeldeten Nutzer über Supabase.

Das eingelesene Original-PDF wird nach der Anfrage nicht dauerhaft in ImmoCalc
gespeichert. Die erkannten Angaben, Belege und Seitenzusammenfassungen werden
in dieser Testversion **nur lokal im Browser** des angemeldeten Nutzers gespeichert,
nicht geräteübergreifend. Bei gelöschtem Browser-Speicher gehen diese Daten verloren.
Für den späteren Produktivbetrieb ist eine datenschutzgerechte, nutzergebundene
Datenbankablage mit Löschfunktion erforderlich.

Die App verarbeitet Exposés zur KI-Erkennung über einen externen KI-Dienst.
Daher nur Unterlagen hochladen, deren Verarbeitung und Weitergabe zulässig ist.

### Was noch fehlt

- Automatischer Zugriff auf lizenzierte Markt- und Vergleichsdaten
- Technisch unabhängige Belegkontrolle direkt gegen PDF-Originaltext
- Vollständige Wertermittlung nach ImmoWertV
- Persistente Speicherung in Supabase statt lokalem Browser-Speicher
- Serverseitig gestalteter Premium-PDF-Bericht (derzeit Browser-Druckansicht)
- Praxistests mit unterschiedlich aufgebauten, gescannten Exposés

Die Bewertungsseite verwendet bis dahin einen ausdrücklich vorläufigen
Preisvergleich aus manuell hinterlegten Vergleichsangeboten.
