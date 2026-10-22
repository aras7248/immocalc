# ImmoCalc

Eigenständige Immobilienkalkulation mit Standard- und Rückwärtsrechner, Szenarien und vorbereiteter Premium-Analyse. ImmoCalc teilt das Kundenkonto mit ImmoCow, aber keine Navigation, Projekte oder Tarife. Siehe [Produktgrenzen](docs/product-boundaries.md).

## Entwicklung

Node.js mindestens 22.18.0. `.env.example` nach `.env.local` kopieren und die öffentlichen Supabase-Einstellungen des gemeinsamen Kundenkontos eintragen. Niemals einen Service-Role-Schlüssel als `NEXT_PUBLIC_`-Variable verwenden.

```sh
npm ci
npm run dev
```

Die App läuft auf Port 4001. Vor Entwicklung und Build stellt `scripts/prepare-ocr.mjs` Worker, Core und deutsche Sprachdaten unter `public/ocr/` bereit. Die Sprachdatei stammt aus einem unveränderlichen Commit und wird gegen ihren Git-Blob-Hash geprüft. Der erste Build benötigt Zugriff auf GitHub Raw; die Texterkennung selbst verwendet anschließend nur die eigene App-Domain. Abhängigkeiten und Lockfile sind exakt festgelegt.

## Prüfungen

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

GitHub Actions führt diese Prüfungen bei Push und Pull Request aus. Zusätzlich werden Migrationen und RLS in einem isolierten PostgreSQL-17-Service getestet. Browser-Smoke-Tests verwenden Playwright 1.56.1 ausschließlich als temporäres CI-Werkzeug; die App erhält dadurch keine zusätzliche Produktionsabhängigkeit. Diese Testwerkzeuge sind begründet durch die benötigten echten Browser-, Fokus-, Eingabe- und Mobilprüfungen.

Browserbilder und Ergebnisse werden als Actions-Artefakte gespeichert. Die Tests verwenden synthetische Daten und ein simuliertes Supabase-Backend; sie greifen nicht auf produktive Kundenobjekte zu. Siehe [QA-Stand](design-qa.md).

## Datenbank

Migrationen liegen unter `supabase/migrations/`. Sie betreffen ausschließlich eigene `immocalc_*`-Tabellen. Vor einer produktiven Anwendung bestehendes Schema, Policies und mögliche vorhandene Datensätze prüfen, ein Backup erstellen und die Migration zuerst in einer getrennten Umgebung ausführen. Das gemeinsame Auth-Projekt und ImmoCow-Tabellen werden nicht geändert.

`scripts/test-database.sh` ist ausschließlich für eine leere, wegwerfbare Testdatenbank bestimmt. Die Datei `supabase/tests/bootstrap.sql` simuliert dort die Supabase-Auth-Rollen; sie darf niemals auf ein produktives Supabase-Projekt angewendet werden. Die Migrationen werden im CI zweimal angewendet, um Wiederholbarkeit zu prüfen.

## Rechenmodell

- Kaufnebenkosten werden aus Eigenkapital bezahlt; zusätzlich kann 0–100 % Eigenkapital im Kaufpreis eingesetzt werden. Darlehen = Kaufpreis minus Eigenkapital im Kaufpreis. Cash-on-Cash nutzt das gesamte Eigenkapital.
- Jahresmiete abzüglich Mietausfall (UI-Default 2 %) und laufender Kosten ergibt den verfügbaren Mietertrag. Bruttorendite und Kaufpreisfaktor nutzen weiterhin die Soll-Miete.
- Instandhaltung, Verwaltung und zusätzliche Rücklage werden abgezogen. Bereits als Instandhaltung erfasste Beträge nicht nochmals als Rücklage eintragen.
- Miet- und Kostenänderungen im einfachen Szenario sind einmalige Änderungen zwischen −50 und +100 %. Die Basisrechnung bleibt unverändert. Eine Mehrjahresprojektion verwendet eigene jährliche Wachstumsraten, standardmäßig 0 % Miete und 2 % Kosten.
- Tilgung wird monatlich bei konstanter Annuität berechnet; die letzte Rate wird auf die Restschuld begrenzt. Nach Ende der angegebenen Zinsbindung fortgeführte Zinssätze sind ausdrücklich nur eine Modellannahme.
- Rückwärtsrechnung: Kaufpreis bei Ziel-Cashflow (Standard 0 €, Break-even) oder Ziel-Nettorendite einschließlich Kaufnebenkosten. Ohne Darlehensrate kann der Cashflow keine endliche Kaufpreisgrenze ergeben; `priceLimitStatus` ist dann `unbounded`. Ein numerischer Kaufpreiswert 0 ist in diesem Fall nur ein API-Platzhalter.
- Separat ausgewiesenes, angemessen bewertetes bewegliches Inventar mindert nur die Bemessungsgrundlage der Grunderwerbsteuer. Notar/Grundbuch und Makler bleiben im Modell auf dem Gesamtpreis; tatsächliche Gebühren und Vereinbarungen können abweichen.
- Speicherformat 3 ergänzt neue optionale Felder mit Standardwerten. Explizit gespeicherte Werte bleiben erhalten. Updates sind durch den beim Laden erhaltenen `updated_at`-Stand geschützt.

Beispiel: 350.000 € Kaufpreis, 21.900 € Jahresmiete, 268 m², 4 % Zins, 1,5 % Tilgung und 4.176 € laufende Kosten ergeben −1.526 € Cashflow pro Jahr ohne Mietausfall bzw. −1.964 € bei 2 % Mietausfall. Bei 20 % Eigenkapital im Kaufpreis beträgt das Darlehen 280.000 €; inklusive 42.245 € Kaufnebenkosten werden 112.245 € Eigenkapital benötigt.

## Fachliche Quellen und Pflege

- Maklerkostenteilung: §§ 656b–656d BGB für Verbraucherkäufe von Wohnungen und Einfamilienhäusern: https://www.gesetze-im-internet.de/bgb/__656b.html und https://www.gesetze-im-internet.de/bgb/__656d.html . Keine pauschale Anwendung auf Zweifamilien- oder Mehrfamilienhäuser.
- Bewegliches Inventar: Finanzgericht Köln, Pressemitteilung vom 20.07.2018: https://www.fg-koeln.nrw.de/behoerde/presse/pressemitteilungen/archiv_2018/20_07_2018/index.php . Ein Abzug setzt sachgerechte Werthaltigkeit voraus.
- Grunderwerbsteuersätze jährlich sowie bei Gesetzesänderungen anhand amtlicher Quellen prüfen; Datum und Quellen im Code aktualisieren und die Tests für alle 16 Länder ausführen.

Alle Ergebnisse sind Modellrechnungen, keine Anlage-, Steuer- oder Rechtsberatung. Angaben ohne Gewähr. Rechtliche Betreibertexte und eine echte Zahlungsanbindung müssen gesondert bereitgestellt werden.

## Review und Veröffentlichung

Die Änderungen werden im Entwurfs-PR gesammelt. Ein erfolgreicher Build oder eine Vorschau bedeutet keine Freigabe zur Übernahme in die Produktionsversion. Der aktuelle Umfang und tatsächlich verbleibende Arbeiten werden in [Review-Status](docs/review-status.md) geführt.

Steuerdaten zuletzt geprüft: 22.10.2026. Die Länderübersicht Brandenburg enthält für Bremen noch einen älteren Satz; das aktuelle Bremer Landesgesetz (5,5 %) hat Vorrang. Bei Änderungen: Landesgesetz und Wirksamkeitsdatum prüfen, `LAND_TRANSFER_TAX_RATES_2026` sowie `LAND_TRANSFER_TAX_REVIEW` aktualisieren, alle 16 Länderwerte testen und den sichtbaren Quellenstand prüfen. Vor jedem Jahreswechsel ist eine erneute Prüfung erforderlich.
