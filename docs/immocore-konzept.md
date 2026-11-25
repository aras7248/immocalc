# ImmoCore – gemeinsames Konto und Abos für alle Apps

Stand: 25.11.2026 · Status: Konzept, noch nicht umgesetzt

## Ziel

ImmoCow, ImmoCalc und spätere Apps nutzen **ein Konto pro Person**. ImmoCore verwaltet zentral:

- Login und Benutzerprofil
- Abos und Tarife pro App
- welche App für welche Person freigeschaltet ist
- den Link-Mechanismus zum Teilen von Immobilien

Die fachlichen Daten (Kalkulationen, Immobilien, Mieter …) bleiben in der jeweiligen App.

Dieses Konzept ersetzt in [product-boundaries.md](product-boundaries.md) die Aussage, dass jede App eine eigene Zahlungsanbindung hat. Die Trennung der Daten bleibt bestehen.

## Entscheidungen

| Thema | Entscheidung |
|---|---|
| Abo-Inhaber | die **Person**, keine Organisation |
| Abrechnung | **ein Abo pro App** (z. B. ImmoCalc Pro, ImmoCow Pro), getrennt kündbar |
| Rabatt | Wer in einer App Pro hat, kann eine andere App vergünstigt erhalten. Höhe und Bedingungen sind noch offen. |
| Free | **1 Immobilie pro App**, kein Teilen, keine weiteren Funktionen |
| Teilen | pro Immobilie über einen Link, Recht „ansehen“ oder „bearbeiten“ |
| Wer darf teilen / empfangen? | nur Nutzer mit aktivem **Pro-Abo der jeweiligen App**, auf beiden Seiten |
| Daten zwischen Apps | getrennt; eine Immobilie in ImmoCalc ist unabhängig von ImmoCow |
| Organisationen / Admin-Modell | entfällt; ersetzt durch das Teilen einzelner Immobilien |

## Architektur

**Ein Supabase-Projekt** mit getrennten Schemas, keine zweite Datenbank.

Begründung: Supabase Auth gehört zu genau einem Projekt. Bei einer separaten ImmoCore-Datenbank müsste der Login zwischen Projekten durchgereicht werden, und die Zugriffsregeln (RLS) der Apps könnten nicht prüfen, ob ein Abo besteht. Das bestehende Projekt (heute Anzeigename „ImmoCow“) wird in **ImmoCore** umbenannt.

```
core      gemeinsam: Profile, Apps, Tarife, Freischaltungen, Abrechnung, Einladungslinks
immocalc  nur ImmoCalc
immocow   nur ImmoCow
<app>     je ein Schema pro weiterer App
```

### Schema `core`

| Tabelle | Zweck | Wichtige Felder |
|---|---|---|
| `profiles` | eine Zeile pro Login (`auth.users`) | `id` (= auth user id), `email`, `first_name`, `last_name`, Adresse, `created_at` |
| `apps` | Liste der Apps | `key` (`immocow`, `immocalc` …), `name`, `active` |
| `plans` | Tarife pro App und was sie erlauben | `app_key`, `key` (`free`, `pro` …), `max_objects` (null = unbegrenzt), `can_share`, `stripe_price_id` |
| `app_entitlements` | Person × App → aktueller Tarif | `user_id`, `app_key`, `plan_key`, `status` (`active`, `trialing`, `past_due`, `canceled`), `current_period_end`, `source` (`stripe`, `manual`), `override_reason`, `override_expires_at` |
| `billing_customers` | Person → Stripe-Kunde | `user_id`, `stripe_customer_id` |
| `billing_subscriptions` | ein Stripe-Abo pro Person und App | `user_id`, `app_key`, `stripe_subscription_id`, `stripe_price_id`, `status`, Laufzeit- und Kündigungsfelder |
| `billing_events` | eingehende Stripe-Webhooks (idempotent) | wie heute in ImmoCow, aber mit `user_id` statt `organisation_id` |
| `share_invites` | Einladungslinks zum Teilen | `token` (zufällig, nur als Hash gespeichert), `app_key`, `object_id`, `role` (`view`, `edit`), `created_by`, `expires_at`, `redeemed_by`, `redeemed_at`, `revoked_at` |

Ohne Abo gilt automatisch Free. Eine Person ohne Eintrag in `app_entitlements` hat für diese App also den Free-Tarif.

### Hilfsfunktionen für die Apps

Die Apps lesen Tarifdaten nie direkt aus, sondern fragen nur ab:

- `core.current_plan(app_key)` → Tarif der angemeldeten Person (`free`, wenn nichts eingetragen ist)
- `core.has_feature(app_key, feature)` → z. B. `can_share`
- `core.object_limit(app_key)` → maximale Anzahl Immobilien

Diese Funktionen werden in RLS-Regeln und in der App-Logik verwendet. So ändert ein neuer Tarif nichts am App-Code.

### Schema einer App (Beispiel ImmoCalc)

| Tabelle | Zweck |
|---|---|
| `immocalc.objects` | Kalkulationen (heute `public.immocalc_saved_objects`), mit `owner_id` |
| `immocalc.shares` | Freigaben: `object_id`, `user_id`, `role` (`view` / `edit`), `created_at` |

RLS-Regel (sinngemäß): Eine Person darf ein Objekt lesen, wenn sie Besitzer ist **oder** eine Freigabe hat **und** für ImmoCalc ein Tarif mit `can_share` aktiv ist.

ImmoCow erhält dasselbe Prinzip mit `property_shares` (die Tabelle existiert bereits, ist aber leer).

## Abläufe

### Teilen

1. Besitzer (mit Pro-Abo) klickt bei einer Immobilie auf **Teilen** und wählt „ansehen“ oder „bearbeiten“.
2. ImmoCore erzeugt einen Einladungslink mit einmaligem Code (`core.share_invites`, z. B. 7 Tage gültig).
3. Empfänger öffnet den Link, meldet sich an oder registriert sich.
4. ImmoCore prüft: Hat der Empfänger für diese App ein aktives Pro-Abo?
   - **Ja:** Die App legt den Eintrag in ihrer `shares`-Tabelle an, und der Link ist verbraucht.
   - **Nein:** Der Empfänger wird zum Abschluss eines Abos geführt; danach wird der Link eingelöst.
5. Der Besitzer kann Freigaben jederzeit entziehen.

### Abo abschließen

1. Die Person wählt in einer App einen Tarif.
2. ImmoCore legt bei Bedarf den Stripe-Kunden an (`billing_customers`) und startet den Stripe-Checkout.
3. **Rabatt:** Hat die Person in einer anderen App ein aktives Pro-Abo, wird ein Stripe-Gutschein angehängt.
4. Ein Stripe-Webhook aktualisiert `billing_subscriptions` und `app_entitlements`.

Preise und Gutscheine werden in Stripe gepflegt, die Datenbank speichert nur die Stripe-IDs. Preisänderungen brauchen dadurch keine Codeänderung.

## Regeln bei Abo-Ende

| Situation | Verhalten |
|---|---|
| Abo des **Empfängers** endet | geteilte Immobilien bleiben gespeichert, sind für ihn aber gesperrt, bis er wieder ein Abo hat |
| Abo des **Besitzers** endet | seine Freigaben werden pausiert, nicht gelöscht; mit neuem Abo sind sie wieder aktiv |
| Person ohne Abo hat **mehr als 1 Immobilie** | alle bleiben lesbar, neue Immobilien kann sie nicht anlegen |
| Rabatt-Grundlage (Pro in App A) endet | noch offen, siehe unten |

Es wird nie automatisch etwas gelöscht.

## Login über mehrere Domains

Gemeinsames Konto heißt zunächst: **dieselben Zugangsdaten** in allen Apps. Weil die Apps auf verschiedenen Domains laufen, ist man nach dem Login in ImmoCow nicht automatisch in ImmoCalc angemeldet. Ein echtes Single Sign-on (einmal anmelden, überall drin) ist ein eigener Schritt und kommt später.

## Umgebungen

Heute nutzen lokale Entwicklung und Production **dieselbe Datenbank**. Das muss vor der Umsetzung geändert werden:

- Das Supabase-Projekt „ImmoCow-Test“ wird zur **ImmoCore-Testdatenbank**.
- Lokal (`.env.local`) und auf Vercel Preview wird nur noch gegen die Testdatenbank gearbeitet.
- Migrationen laufen zuerst auf Test, dann auf Production.

## Umsetzung in Phasen

1. **Vorbereitung:** Testdatenbank einrichten, Projekt in ImmoCore umbenennen, lokale Umgebung auf Test umstellen.
2. **`core` anlegen:** Tabellen, Hilfsfunktionen, RLS. `profiles` für alle bestehenden Logins befüllen (Daten aus `public.users` übernehmen, wo vorhanden).
3. **ImmoCalc anbinden:** Free-Grenze (1 Immobilie) über `core.object_limit`, Tarifanzeige, Stripe-Checkout für ImmoCalc Pro. Risiko gering, weil ImmoCalc noch keine Abos hat.
4. **ImmoCow umstellen:** Abrechnung von Organisationen auf Personen. Jede zahlende Organisation wird ihrem Besitzer als ImmoCow-Pro zugeordnet. Die Organisations-Tabellen bleiben stehen, bis kein Code sie mehr nutzt. ImmoCow verwaltet sein Schema mit Prisma, deshalb gehen diese Migrationen über das ImmoCow-Repo.
5. **Teilen bauen:** `core.share_invites` und die Freigabe-Tabellen in beiden Apps, Teilen-Button und Einlöse-Seite.
6. **Später:** Single Sign-on über Domains, Bündelrabatte, weitere Apps.

## Offene Punkte

- Preise und Höhe des Cross-App-Rabatts
- Was mit dem Rabatt passiert, wenn das Pro-Abo in der anderen App endet
- Gültigkeitsdauer der Einladungslinks (Vorschlag: 7 Tage)
- Ob neben Free und Pro weitere Tarife pro App nötig sind
- Wie bestehende ImmoCow-Organisationen mit mehreren Mitgliedern behandelt werden (vor Phase 4 prüfen, ob echte Kunden oder Testdaten)
