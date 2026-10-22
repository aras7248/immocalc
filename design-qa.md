# ImmoCalc – überprüfbarer QA-Stand

Die automatischen Browserprüfungen laufen in GitHub Actions auf dem Review-Branch. Sie verwenden ausschließlich einen simulierten Supabase-Endpunkt und synthetische Nutzerdaten.

Geprüft werden Standardrechner (Eingabe → Ergebnis), Speichern und Laden, alle drei Modi einschließlich Premium-Ziele, der selbst gehostete OCR-Worker mit einem synthetischen Bild, öffentliche rechtliche Platzhalter ohne Anmeldung, Desktop (1280 × 800) und Mobil (390 × 844), horizontaler Seitenüberlauf und unbehandelte Browserfehler. Desktop- und Mobilbilder liegen im jeweiligen Actions-Artefakt `browser-qa-<run-id>`.

Die Screenshots sind Prüfmaterial. Ein manueller visueller Vergleich mit einer früheren Designreferenz wird damit nicht behauptet. Anmeldung, produktive RLS und tatsächliche OCR-Bildqualität müssen zusätzlich in einer eingerichteten Vorschau bzw. Staging-Umgebung geprüft werden. Die Datenbankregeln werden unabhängig davon mit echter PostgreSQL-RLS in einem isolierten CI-Service geprüft.

Aktuelle Ergebnisse und Commit-Zuordnung: siehe Checks in Pull Request #1 und die Statusübersicht in `docs/review-status.md`.
