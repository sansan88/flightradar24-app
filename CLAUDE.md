# SkyPi — Live-Flugradar im Heimnetz

Ionic React App (WebApp + native iOS App via Capacitor), die den lokalen
Aircraft Service eines Raspberry Pi (ADS-B-Empfänger mit dump1090/readsb)
abruft und alle empfangenen Flugzeuge live auf der Swisstopo-Karte anzeigt.

## Naming

- **App Name (App Store, Homescreen):** SkyPi
- **Tagline / Untertitel:** Live-Flugradar im Heimnetz
- **App ID:** `ch.sansan.flightradar` (nicht ändern — im App Store registriert)
- **Repo:** https://github.com/sansan88/flightradar24-app
- **Datenquelle (Pi-Setup):** https://github.com/sansan88/flightradar24
- In nutzersichtbaren Texten (App Store, UI, README) immer "SkyPi" verwenden,
  nicht "FlightRadar". App-Store-Werbetext und -Beschreibung stehen im README.

## Befehle

```bash
npm run dev      # Vite-Dev-Server, proxied /data/* zum Pi (PI_URL überschreibbar)
npm run build    # tsc && vite build → dist/
npm run ios      # build + cap sync ios + öffnet Xcode
```

## Architektur

- `src/pages/` — MapPage (MapLibre GL), ListPage, SettingsPage
- `src/components/AircraftDetailModal.tsx` — Detailansicht pro Flugzeug
- `src/services/aircraftService.ts` — Polling von `http://<pi>:8080/data/aircraft.json`
- `src/services/adsbdbService.ts` — Flugzeug-/Routeninfos von adsbdb.com,
  24-h-LRU-Cache (auch 404s werden gecacht)
- `src/services/mapLayers.ts` — Kartenhintergründe (Swisstopo farbig/grau,
  Luftbild, OSM, hell/dunkel, auto nach Systemtheme)
- `src/services/settings.ts` + `src/state/AppContext.tsx` — Einstellungen,
  persistiert via `@capacitor/preferences`
- `src/types/aircraft.ts` — dump1090/readsb-Datenformat

## Wichtige Eigenheiten

- **CORS**: Der Pi-Webserver (lighttpd) sendet keine CORS-Header. Im Web-Dev
  proxied Vite `/data/*` zum Pi; in der nativen App laufen Requests über
  CapacitorHttp (natives URLSession), CORS spielt dort keine Rolle.
- **iOS Info.plist**: `NSAllowsLocalNetworking` (HTTP im LAN) und
  `NSLocalNetworkUsageDescription` sind gesetzt — bei Änderungen beibehalten.
- Flugzeuge ohne `lat`/`lon` erscheinen nur in der Liste, nicht auf der Karte;
  aktive Flieger stehen in der Liste zuoberst.
- Höhenangaben werden in Metern angezeigt (Quelle liefert Fuss).
- Alles lokal und privat: keine Cloud, kein Konto, keine Analytics — keine
  Abhängigkeiten einbauen, die Nutzerdaten an fremde Server senden
  (Ausnahme: adsbdb.com für Flugzeug-/Routeninfos, Swisstopo/OSM-Kacheln).
