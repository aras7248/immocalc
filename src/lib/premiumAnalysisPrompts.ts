// Original prompts supplied by the user; do not renumber their sequence.
export const PREMIUM_ANALYSIS_STEPS = [
  {
    id: 1,
    title: "Rolle, Objektdaten & fehlende Informationen",
    prompt:
      "Du bist ein erfahrener Immobilien-Investmentanalyst, Gutachter und Verhandlungsberater für Wohnimmobilien in Deutschland.\n\nIch möchte eine Immobilie professionell bewerten, um eine fundierte Kaufentscheidung zu treffen und später mit einer sachlichen, nachvollziehbaren Analyse in die Preisverhandlung mit dem Verkäufer zu gehen.\n\nArbeite streng analytisch, konservativ und nachvollziehbar. Kennzeichne jede Annahme explizit als [Annahme]. Wenn Informationen fehlen, stelle mir gezielte Rückfragen, bevor du eine Bewertung vornimmst.\n\nHier sind die verfügbaren Objektdaten:\n\n[Exposé, Adresse, Baujahr, Wohnfläche, Kaufpreis, aktuelle Miete, Hausgeld, Rücklagen, Energieausweis, Zustand, Modernisierungen usw. einfügen]\n\nBitte erstelle daraus:\n1. Einen strukturierten Objektsteckbrief (Objektart, Lage, Baujahr, Fläche, Nutzung, Mieteinnahmen, Kaufpreis, Kaufnebenkosten, Preis pro m², Zustand, Energieeffizienz, Besonderheiten)\n2. Eine Liste der Informationen, die für eine belastbare Kaufpreisbewertung noch fehlen\n3. Erste Auffälligkeiten\n\nBewerte an dieser Stelle noch nicht final.",
  },
  {
    id: 2,
    title: "Lage- und Marktanalyse (mit echten Vergleichsdaten)",
    prompt:
      "Analysiere nun die Lage der Immobilie professionell aus Investorensicht.\n\nHier zusätzliche aktuelle Marktdaten, die ich recherchiert habe:\n[Vergleichsangebote, Bodenrichtwert, Mietspiegel-Auszug einfügen]\n\nBerücksichtige:\n1. Makrolage (Stadt/Region, Bevölkerungsentwicklung, Arbeitsmarkt, Kaufkraft, Infrastruktur, Wohnraumnachfrage)\n2. Mikrolage (Umgebung, ÖPNV, Einkaufsmöglichkeiten, Schulen/Ärzte, Lärm/Gewerbe, Vermietbarkeit)\n3. Immobilienmarkt (realistische Kaufpreise/Mieten pro m², Angebot-Nachfrage, Vergleich mit ähnlichen Objekten)\n4. Chancen und Risiken der Lage\n\nGib am Ende eine Lagebewertung von 1–10 mit nachvollziehbarer Begründung. Kennzeichne alles, was auf Schätzung statt auf den gelieferten Daten beruht, klar als [Schätzung].",
  },
  {
    id: 3,
    title: "Wirtschaftlichkeitsrechnung (als Tabelle)",
    prompt:
      "Erstelle nun eine vollständige Wirtschaftlichkeitsanalyse für diese Immobilie – bitte als übersichtliche Tabelle, nicht als Fließtext, damit ich Annahmen leicht ändern kann.\n\nKaufpreis: [einfügen]\nKaufnebenkosten (Makler, Grunderwerbsteuer, Notar, Grundbuch): [einfügen]\nEigenkapital: [einfügen]\nDarlehensbetrag: [einfügen]\nZinssatz: [einfügen]\nTilgung: [einfügen]\nAktuelle Jahreskaltmiete: [einfügen]\nNicht umlagefähige Kosten: [einfügen]\nInstandhaltungsrücklage: [einfügen]\nHausgeld (bei Eigentumswohnung): [einfügen]\nLeerstandspuffer: [einfügen]\nVerwaltungskosten: [einfügen]\nGeschätzte Sanierungskosten: [einfügen]\n\nBerechne und zeige jede Zwischenrechnung nachvollziehbar:\n1. Gesamtkapitalbedarf\n2. Kaufpreis pro m²\n3. Brutto- und Nettomietrendite\n4. Faktor Kaufpreis/Jahreskaltmiete\n5. Monatliche Finanzierungsrate\n6. Monatlicher Cashflow (vor und nach konservativen Kostenannahmen)\n7. Break-even-Miete\n8. Kapitaldienstdeckungsgrad\n9. Eigenkapitalrendite\n10. Restschuld nach 10/15/20 Jahren\n11. Sensitivitätsanalyse: +0,5 % Zins, +1,0 % Zins, -10 % Miete, +5 % Kosten, zusätzlicher Sanierungsbedarf\n\nErkläre die Ergebnisse so, dass ich sie einem Verkäufer oder Finanzierungspartner verständlich präsentieren kann.",
  },
  {
    id: 4,
    title: "Risikoprüfung & fairer Kaufpreis",
    prompt:
      "Prüfe die Immobilie aus technischer, rechtlicher und kaufmännischer Sicht auf Risiken (Baujahrtypische Risiken, Dach, Fassade, Fenster, Heizung, Elektrik, Leitungen, Keller/Feuchtigkeit, Energieeffizienz, Gemeinschaftseigentum, Sonderumlagenrisiko, Mietvertragsrisiken, Mietsteigerungspotenzial, Leerstandsrisiko, Instandhaltungsstau, rechtlich noch zu prüfende Unterlagen).\n\nErstelle eine Risikomatrix mit: Risiko | Wahrscheinlichkeit | finanzielle Auswirkung | Relevanz für die Verhandlung.\n\nLeite daraus einen konkreten Preisabschlag ab und ermittle anschließend – basierend auf der bisherigen Analyse – einen realistischen fairen Kaufpreis über mehrere Ansätze:\n1. Vergleichswertverfahren (Preis/m² im Marktvergleich, Zu-/Abschläge)\n2. Ertragswertorientierte Bewertung (nachhaltige Nettokaltmiete, marktüblicher Faktor, Bewirtschaftungskosten, Risikoabschläge)\n3. Investorenperspektive (Preis bei neutralem Cashflow, Preis bei Mindestrendite)\n\nGib am Ende eine klare Kaufpreis-Spanne aus:\n- Sehr attraktiver Kaufpreis: ___ €\n- Fairer Kaufpreis: ___ €\n- Noch vertretbarer Maximalpreis: ___ €\n- Überhöhter Bereich ab: ___ €\n\nBegründe jeden Wert nachvollziehbar.",
  },
  {
    id: 5,
    title: "Verkäufer-Präsentation & Verhandlungsstrategie",
    prompt:
      "Erstelle aus der gesamten bisherigen Analyse eine professionelle, sachliche Präsentation für den Verkäufer sowie die passende Verhandlungsstrategie.\n\nZiel: Ich möchte zeigen, dass mein Angebot nicht willkürlich niedrig ist, sondern auf einer nachvollziehbaren wirtschaftlichen Bewertung basiert. Ton: professionell, ruhig, seriös – nicht aggressiv, nicht belehrend, aber bestimmt.\n\nStruktur:\n1. Kurze Einleitung\n2. Positive Aspekte der Immobilie\n3. Sachliche Bewertungsgrundlage\n4. Marktvergleich\n5. Wirtschaftliche Betrachtung\n6. Zustand/Risiken/Investitionsbedarf\n7. Herleitung meines Kaufpreisangebots\n8. Fazit\n\nErgänze dazu:\n9. Meine stärksten Verhandlungsargumente\n10. Argumente, die ich besser vermeiden sollte\n11. Mögliche Einwände des Verkäufers und gute Antworten darauf\n12. Einstiegssatz für das Gespräch\n13. Formulierung meines Angebots\n14. Formulierung, falls der Verkäufer ablehnt",
  },
  {
    id: 6,
    title: "Finaler PDF-fertiger Gesamtbericht",
    prompt:
      'Fasse die gesamte bisherige Analyse (Objektsteckbrief, Lage, Wirtschaftlichkeit, Risiken, fairer Kaufpreis, Verkäufer-Präsentation, Verhandlungsstrategie) zu einem einzigen, durchgängigen und professionell formatierten Bericht zusammen, den ich als PDF exportieren kann.\n\nAnforderungen an die Formatierung:\n- Klare Kapitelüberschriften und Nummerierung\n- Tabellen für Zahlen (Steckbrief, Wirtschaftlichkeit, Risikomatrix, Kaufpreis-Spanne)\n- Ein kurzes Management-Summary (max. 10 Zeilen) ganz am Anfang\n- Alle Annahmen am Ende gesammelt in einem eigenen Abschnitt "Annahmen & offene Punkte"\n- Sachlicher, professioneller Ton durchgehend\n\nGib mir den Bericht so aus, dass ich ihn direkt in ein Dokument kopieren und als PDF speichern kann.',
  },
] as const;
