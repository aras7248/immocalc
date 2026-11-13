# ImmoCalc Exposé-Import

Diese Erweiterung liest **ausschließlich nach einem bewussten Klick** die sichtbaren Textdaten des aktuell geöffneten ImmoScout24-Exposés. Sie speichert keine ImmoScout24-Zugangsdaten und ruft keine Inserate im Hintergrund ab.

## Desktop: Chrome oder Edge

1. `chrome://extensions` (oder `edge://extensions`) öffnen.
2. Den Entwicklermodus einschalten.
3. **Entpackte Erweiterung laden** wählen.
4. Den Ordner `browser-extension` dieses Projekts auswählen.
5. Ein ImmoScout24-Exposé öffnen und auf das ImmoCalc-Symbol klicken.

Als ImmoCalc-Adresse ist lokal bereits `http://localhost:4001/` hinterlegt.

## iPhone: Safari

Safari auf iPhone kann Web-Erweiterungen nur als Teil einer iOS-App installieren. Die Dateien in diesem Ordner sind bewusst als Safari-kompatible WebExtension aufgebaut und lassen sich mit Xcode paketieren:

```bash
xcrun safari-web-extension-packager /ABSOLUTER/PFAD/zu/browser-extension \
  --app-name "ImmoCalc Import" \
  --bundle-identifier "de.immocalc.exposeimport" \
  --swift \
  --ios-only
```

Danach die erzeugte Xcode-App auf dem iPhone installieren und unter **Einstellungen → Safari → Erweiterungen** aktivieren. Für die Installation auf einem echten iPhone sind Xcode und eine Apple-Developer-Mitgliedschaft erforderlich.

Auf dem iPhone ist die veröffentlichte ImmoCalc-Adresse `https://immocalc-two.vercel.app/` bereits voreingestellt. Die veröffentlichte App muss dafür denselben Release-Stand wie dieses Projekt haben. `localhost` des iPhones ist nicht dein Mac. Falls du testweise die lokale Mac-App verwenden möchtest, nutze im selben WLAN stattdessen deren Netzwerkadresse, zum Beispiel `http://192.168.x.x:4001/`.

Vor dem ersten Import einmal in Safari bei ImmoCalc anmelden. Danach öffnet ein Tipp auf die Erweiterung ImmoCalc mit den bereits übernommenen Daten – ohne PDF-Download.
