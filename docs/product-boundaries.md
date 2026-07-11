# Produktgrenzen und gemeinsames Kundenkonto

## Eigenständige App

ImmoCalc wird unabhängig von ImmoCow entwickelt und ausgeliefert. Die App besitzt eine eigene Domain, Navigation, Rechenlogik, Projektverwaltung, Tariflogik und Zahlungsanbindung. ImmoCow enthält keine ImmoCalc-Route und keine eingebettete Rechneroberfläche.

## Gemeinsames Kundenkonto

Beide Apps verwenden dasselbe Supabase-Auth-Projekt. Dadurch gelten dieselben E-Mail-/Passwort-Zugangsdaten in ImmoCow und ImmoCalc. Die Apps prüfen ihre Sitzungen jeweils selbstständig und schützen ihre eigenen Datenzugriffe mit Row Level Security.

Da Browser-Sitzungen an die jeweilige App-Domain gebunden sind, bedeutet das gemeinsame Kundenkonto zunächst gemeinsame Zugangsdaten und nicht automatisch eine domainübergreifend übernommene Sitzung. Ein späteres echtes Single Sign-on muss als eigener, sicherer Auth-Flow geplant werden.

## Design-Harmonisierung

ImmoCalc verwendet dieselbe grundlegende Designlinie wie ImmoCow: Farb-Tokens, Typografie, Abstände, Rundungen, Hell-/Dunkelmodus und wiederkehrende Bedienmuster. Produktname, Navigation und Funktionsumfang bleiben eigenständig.

## Daten- und Tariftrennung

- `immocalc_saved_objects` enthält ausschließlich ImmoCalc-Kalkulationen und ist über `user_id` geschützt.
- ImmoCow zeigt keine ImmoCalc-Projekte oder Berechnungsergebnisse an.
- ImmoCalc erhält eigene Tarife, Berechtigungen und Zahlungen.
- ImmoCow-Abonnements schalten keine ImmoCalc-Premiumfunktionen frei.

## Spätere Partner-Apps

ImmoCow kann später eine reine Produktentdeckung für Partner-Apps anbieten. Ein Eintrag darf Name, Kurzbeschreibung und Link zu ImmoCalc zeigen. Rechner, Kundendaten, Projekte, Tarife und Zahlungen bleiben vollständig in ImmoCalc.
