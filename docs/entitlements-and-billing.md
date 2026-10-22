# ImmoCalc-Berechtigungen und vorbereitete Zahlung

Die Berechtigung stammt aus `public.immocalc_entitlements`, nicht aus bearbeitbaren Nutzermetadaten. Nutzer dürfen ausschließlich ihre eigene Zeile lesen. Updates sind nur mit einem vertrauenswürdigen serverseitigen Service-Role-Zugang oder durch den Datenbankbetreiber möglich. Ein Service-Role-Schlüssel gehört niemals in den Browser.

Free erlaubt keine neuen gespeicherten Objekte. Investor erlaubt höchstens drei, Professional unbegrenzt. Vorhandene Objekte können weiterhin unter Wahrung der Eigentumsregeln bearbeitet werden. Das Speichern neuer Premium-Analyse-Hüllen erfordert eine gültige Berechtigung. Die Datenbank serialisiert Schreibvorgänge pro Nutzer über eine transaktionsgebundene Sperre; bloße UI-Prüfungen setzen das Limit nicht durch.

Bis zur Zahlungsanbindung kann der Betreiber Berechtigungen in einer geprüften Administrationsumgebung manuell zuweisen: Nutzer-ID anhand von `auth.users` eindeutig prüfen, anschließend die eigene `immocalc_entitlements`-Zeile mit einem der Werte `free`, `investor`, `professional`, einem optionalen Ablaufdatum und `source='manual'` anlegen oder aktualisieren. Änderungen an ImmoCow-Tarifen sind nicht vorgesehen.

Der Endpunkt `/api/billing/webhook` ist bewusst inaktiv und antwortet auf POST mit HTTP 501. Er verarbeitet keine Zahlungsdaten und ändert keine Berechtigungen. Die CTA darf weiterhin keine verfügbare Zahlung behaupten.

Ein zukünftiger Provider muss einen Adapter aus `src/domain/immocalc/billing.ts` implementieren. Vor einer Aktivierung sind Signaturprüfung auf dem unveränderten Request-Body, Replay-Schutz und eindeutige Event-IDs, atomare idempotente Verarbeitung, serverseitige Produkt-/Tarifzuordnung, eindeutige Nutzerzuordnung und definierte Regeln für Ablauf, Kündigung und Erstattung erforderlich. Ungeprüfte Body-Felder oder `user_metadata` sind keine Grundlage für Zugriffe. Anbieter, Preise, Vertragsbedingungen und Webhook-Zugänge sind noch nicht festgelegt.
