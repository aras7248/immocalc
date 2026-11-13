# Prompt-Sequenz: Professionelle Immobilienbewertung

So verwenden: Prompt 1 zuerst einfügen, Antwort abwarten, fehlende Daten ergänzen. Dann Schritt für Schritt weiter. Am Ende Prompt 6 nutzen, um alles zu einem PDF-fertigen Bericht zusammenzufassen.

---

## Prompt 1 – Rolle, Objektdaten & fehlende Informationen

```
Du bist ein erfahrener Immobilien-Investmentanalyst, Gutachter und Verhandlungsberater für Wohnimmobilien in Deutschland.

Ich möchte eine Immobilie professionell bewerten, um eine fundierte Kaufentscheidung zu treffen und später mit einer sachlichen, nachvollziehbaren Analyse in die Preisverhandlung mit dem Verkäufer zu gehen.

Arbeite streng analytisch, konservativ und nachvollziehbar. Kennzeichne jede Annahme explizit als [Annahme]. Wenn Informationen fehlen, stelle mir gezielte Rückfragen, bevor du eine Bewertung vornimmst.

Hier sind die verfügbaren Objektdaten:

[Exposé, Adresse, Baujahr, Wohnfläche, Kaufpreis, aktuelle Miete, Hausgeld, Rücklagen, Energieausweis, Zustand, Modernisierungen usw. einfügen]

Bitte erstelle daraus:
1. Einen strukturierten Objektsteckbrief (Objektart, Lage, Baujahr, Fläche, Nutzung, Mieteinnahmen, Kaufpreis, Kaufnebenkosten, Preis pro m², Zustand, Energieeffizienz, Besonderheiten)
2. Eine Liste der Informationen, die für eine belastbare Kaufpreisbewertung noch fehlen
3. Erste Auffälligkeiten

Bewerte an dieser Stelle noch nicht final.
```

---

## Prompt 2 – Lage- und Marktanalyse (mit echten Vergleichsdaten)

*Wichtig: Füge hier – bevor du den Prompt abschickst – selbst aktuelle Vergleichsdaten ein (z. B. Inserate von ImmoScout/Immowelt/Kleinanzeigen, Bodenrichtwert, Mietspiegel), oder nutze eine App mit Websuche-Funktion. Ohne echte Daten sind Marktzahlen sonst nur Schätzungen.*

```
Analysiere nun die Lage der Immobilie professionell aus Investorensicht.

Hier zusätzliche aktuelle Marktdaten, die ich recherchiert habe:
[Vergleichsangebote, Bodenrichtwert, Mietspiegel-Auszug einfügen]

Berücksichtige:
1. Makrolage (Stadt/Region, Bevölkerungsentwicklung, Arbeitsmarkt, Kaufkraft, Infrastruktur, Wohnraumnachfrage)
2. Mikrolage (Umgebung, ÖPNV, Einkaufsmöglichkeiten, Schulen/Ärzte, Lärm/Gewerbe, Vermietbarkeit)
3. Immobilienmarkt (realistische Kaufpreise/Mieten pro m², Angebot-Nachfrage, Vergleich mit ähnlichen Objekten)
4. Chancen und Risiken der Lage

Gib am Ende eine Lagebewertung von 1–10 mit nachvollziehbarer Begründung. Kennzeichne alles, was auf Schätzung statt auf den gelieferten Daten beruht, klar als [Schätzung].
```

---

## Prompt 3 – Wirtschaftlichkeitsrechnung (als Tabelle)

```
Erstelle nun eine vollständige Wirtschaftlichkeitsanalyse für diese Immobilie – bitte als übersichtliche Tabelle, nicht als Fließtext, damit ich Annahmen leicht ändern kann.

Kaufpreis: [einfügen]
Kaufnebenkosten (Makler, Grunderwerbsteuer, Notar, Grundbuch): [einfügen]
Eigenkapital: [einfügen]
Darlehensbetrag: [einfügen]
Zinssatz: [einfügen]
Tilgung: [einfügen]
Aktuelle Jahreskaltmiete: [einfügen]
Nicht umlagefähige Kosten: [einfügen]
Instandhaltungsrücklage: [einfügen]
Hausgeld (bei Eigentumswohnung): [einfügen]
Leerstandspuffer: [einfügen]
Verwaltungskosten: [einfügen]
Geschätzte Sanierungskosten: [einfügen]

Berechne und zeige jede Zwischenrechnung nachvollziehbar:
1. Gesamtkapitalbedarf
2. Kaufpreis pro m²
3. Brutto- und Nettomietrendite
4. Faktor Kaufpreis/Jahreskaltmiete
5. Monatliche Finanzierungsrate
6. Monatlicher Cashflow (vor und nach konservativen Kostenannahmen)
7. Break-even-Miete
8. Kapitaldienstdeckungsgrad
9. Eigenkapitalrendite
10. Restschuld nach 10/15/20 Jahren
11. Sensitivitätsanalyse: +0,5 % Zins, +1,0 % Zins, -10 % Miete, +5 % Kosten, zusätzlicher Sanierungsbedarf

Erkläre die Ergebnisse so, dass ich sie einem Verkäufer oder Finanzierungspartner verständlich präsentieren kann.
```

---

## Prompt 4 – Risikoprüfung & fairer Kaufpreis

```
Prüfe die Immobilie aus technischer, rechtlicher und kaufmännischer Sicht auf Risiken (Baujahrtypische Risiken, Dach, Fassade, Fenster, Heizung, Elektrik, Leitungen, Keller/Feuchtigkeit, Energieeffizienz, Gemeinschaftseigentum, Sonderumlagenrisiko, Mietvertragsrisiken, Mietsteigerungspotenzial, Leerstandsrisiko, Instandhaltungsstau, rechtlich noch zu prüfende Unterlagen).

Erstelle eine Risikomatrix mit: Risiko | Wahrscheinlichkeit | finanzielle Auswirkung | Relevanz für die Verhandlung.

Leite daraus einen konkreten Preisabschlag ab und ermittle anschließend – basierend auf der bisherigen Analyse – einen realistischen fairen Kaufpreis über mehrere Ansätze:
1. Vergleichswertverfahren (Preis/m² im Marktvergleich, Zu-/Abschläge)
2. Ertragswertorientierte Bewertung (nachhaltige Nettokaltmiete, marktüblicher Faktor, Bewirtschaftungskosten, Risikoabschläge)
3. Investorenperspektive (Preis bei neutralem Cashflow, Preis bei Mindestrendite)

Gib am Ende eine klare Kaufpreis-Spanne aus:
- Sehr attraktiver Kaufpreis: ___ €
- Fairer Kaufpreis: ___ €
- Noch vertretbarer Maximalpreis: ___ €
- Überhöhter Bereich ab: ___ €

Begründe jeden Wert nachvollziehbar.
```

---

## Prompt 5 – Verkäufer-Präsentation & Verhandlungsstrategie

```
Erstelle aus der gesamten bisherigen Analyse eine professionelle, sachliche Präsentation für den Verkäufer sowie die passende Verhandlungsstrategie.

Ziel: Ich möchte zeigen, dass mein Angebot nicht willkürlich niedrig ist, sondern auf einer nachvollziehbaren wirtschaftlichen Bewertung basiert. Ton: professionell, ruhig, seriös – nicht aggressiv, nicht belehrend, aber bestimmt.

Struktur:
1. Kurze Einleitung
2. Positive Aspekte der Immobilie
3. Sachliche Bewertungsgrundlage
4. Marktvergleich
5. Wirtschaftliche Betrachtung
6. Zustand/Risiken/Investitionsbedarf
7. Herleitung meines Kaufpreisangebots
8. Fazit

Ergänze dazu:
9. Meine stärksten Verhandlungsargumente
10. Argumente, die ich besser vermeiden sollte
11. Mögliche Einwände des Verkäufers und gute Antworten darauf
12. Einstiegssatz für das Gespräch
13. Formulierung meines Angebots
14. Formulierung, falls der Verkäufer ablehnt
```

---

## Prompt 6 – Finaler PDF-fertiger Gesamtbericht

*Diesen Prompt am Ende nutzen, damit du das Ergebnis sauber als PDF exportieren/speichern kannst.*

```
Fasse die gesamte bisherige Analyse (Objektsteckbrief, Lage, Wirtschaftlichkeit, Risiken, fairer Kaufpreis, Verkäufer-Präsentation, Verhandlungsstrategie) zu einem einzigen, durchgängigen und professionell formatierten Bericht zusammen, den ich als PDF exportieren kann.

Anforderungen an die Formatierung:
- Klare Kapitelüberschriften und Nummerierung
- Tabellen für Zahlen (Steckbrief, Wirtschaftlichkeit, Risikomatrix, Kaufpreis-Spanne)
- Ein kurzes Management-Summary (max. 10 Zeilen) ganz am Anfang
- Alle Annahmen am Ende gesammelt in einem eigenen Abschnitt "Annahmen & offene Punkte"
- Sachlicher, professioneller Ton durchgehend

Gib mir den Bericht so aus, dass ich ihn direkt in ein Dokument kopieren und als PDF speichern kann.
```
