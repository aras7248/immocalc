# Review-Status

Alle technisch ausführbaren Punkte der Claude-Prüfliste sind auf `codex/immocalc-review-ci` implementiert und in Draft-PR #1 zur Durchsicht vorbereitet.

| Punkte | Ergebnis |
| --- | --- |
| A1–A5 | Realistische Kosten, Mietausfall, getrennte Kostensteigerung, negative Szenarien und Finanzierung einschließlich Eigenkapital/Zinsbindung |
| A6–A8 | Monatlicher Tilgungsplan mit Jahresprojektion, Ziel-Cashflow/Zielrendite und differenzierte Kaufnebenkosten mit beweglichen Gegenständen |
| B1–B5 | Warnung bei unbekanntem Bundesland, Standort nur nach Bestätigung, Feldvalidierung und zugängliche Dialoge, gemeinsame Zahlenkonvertierung, vorsichtigere OCR-Erkennung |
| C1–C5 | Versionierte Migrationen und Eigentümer-RLS, Umgebungsprüfung, Sicherheitsheader, Schutz vor veralteten Updates, selbst gehostete OCR-Ressourcen |
| D1–D5 | CI, aufgeteilte Zustände/Komponenten/Styles, Browserprüfungen und aktuelle Einrichtung-/QA-Dokumentation |
| E1–E3 | Datenbankgestützte eigene Tarifberechtigungen und Speicherlimits, versionierte Premium-Analysen, ausdrücklich inaktives Zahlungs-/Webhook-Gerüst |
| F1–F3 | Sichtbare Modellrechnungshinweise, öffentliche rechtliche Platzhalter, Quellen-/Datumsstand und Pflegeprozess für die Steuersätze |

## Automatisierte Prüfung

71 lokale Tests und TypeScript-Prüfung sind erfolgreich. GitHub Actions prüft zusätzlich Lint, Produktionsbuild, echte PostgreSQL-Migrationen/RLS und browsergestützte Bedienabläufe mit synthetischen Daten. Maßgeblich sind die Checks des aktuellen PR-Commits. Screenshots und Browserbericht liegen im Actions-Artefakt `browser-qa-<run-id>`. Die Migrationen werden in einer isolierten Testdatenbank zweimal ausgeführt.

## Vor einem produktiven Start

- Die beiden neuen SQL-Migrationen nach Backup und Prüfung in der vorgesehenen Supabase-Umgebung ausrollen. Keine produktive Migration wurde durchgeführt. Die lokal vorhandene reduzierte Supabase-CLI unterstützt `migration new` nicht; die versionierten SQL-Dateien wurden mit UTC-Zeitstempeln angelegt und in CI geprüft.
- ImmoCalc-Berechtigungen durch den Betreiber zuweisen; ohne eingerichtete Tabellen/Berechtigung bleibt Premium gesperrt. Die Vorschau verwendet das konfigurierte Backend und simuliert keine zahlenden Nutzer.
- Betreiberangaben, Datenschutz, AGB und Widerruf rechtlich prüfen und die klar gekennzeichneten Platzhalter ersetzen. Es wurden keine rechtlichen Texte oder Betreiberdaten erfunden.
- Zahlungsanbieter und Vertragsbedingungen festlegen, anschließend die dokumentierte Signatur-/Replay-/Idempotenzprüfung implementieren. Der Webhook bleibt bis dahin HTTP 501; es werden keine Zahlungen ausgelöst.
- Anmeldung mit einem echten Testkonto, OCR mit repräsentativen Exposés und die Bildschirmdarstellung manuell abnehmen. Synthetische Browserprüfungen ersetzen diese Abnahme nicht.

`main` wurde nicht verändert; es wurde keine Produktionsfreigabe vorgenommen.
