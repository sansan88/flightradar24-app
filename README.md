# FlightRadar App

Ionic React App (WebApp + native iPhone App via Capacitor), die den lokalen
Aircraft Service eines Raspberry Pi abruft und alle empfangenen Flugzeuge live
auf der **Swisstopo-Karte** (MapLibre GL) anzeigt.

Quelle der Flugdaten: [sansan88/flightradar24](https://github.com/sansan88/flightradar24)
(Raspberry Pi mit ADS-B Empfänger, dump1090) —
`http://<pi-ip>:8080/data/aircraft.json`

## Features

- 🗺️ **Karte**: Alle Flugzeuge mit Position auf der Swisstopo-Landeskarte,
  Ausrichtung nach Kurs, Farbe nach Flughöhe, Popup mit Details
  (Callsign, Höhe, Geschwindigkeit, Squawk, …)
- 📋 **Liste**: Alle empfangenen Flugzeuge, auch ohne Positionsdaten
- ⚙️ **Einstellungen**:
  - IP-Adresse und Port des Raspberry Pi im lokalen Netzwerk
  - Aktualisierungsintervall (1–30 s)
  - Filter nach ADS-B Flugzeug-Kategorie (A1 leicht … A7 Helikopter usw.)
- Verbindungsstatus und aktuelle Quelle (IP:Port) direkt auf der Karte

## Stack

- [Ionic React 8](https://ionicframework.com/docs/react) + Vite + TypeScript
- [Capacitor 8](https://capacitorjs.com/) (iOS)
- [MapLibre GL JS 5](https://maplibre.org/) mit
  [Swisstopo WMTS](https://www.geo.admin.ch/) (`ch.swisstopo.pixelkarte-farbe`)
- `@capacitor/preferences` für persistente Einstellungen

## Entwicklung (WebApp)

```bash
npm install
npm run dev
```

Der Vite-Dev-Server proxied `/data/*` zum Raspberry Pi, weil der Pi-Webserver
(lighttpd) keine CORS-Header sendet. Standardziel ist `http://192.168.1.174:8080`,
überschreibbar per Umgebungsvariable:

```bash
PI_URL=http://192.168.1.99:8080 npm run dev
```

> **macOS:** Beim ersten Start fragt macOS, ob `node` auf das lokale Netzwerk
> zugreifen darf — das muss erlaubt werden (Systemeinstellungen → Datenschutz →
> Lokales Netzwerk), sonst schlägt der Proxy mit `EHOSTUNREACH` fehl.

Für eine im Browser gehostete Produktiv-WebApp muss der Pi CORS erlauben
(lighttpd: `setenv.add-response-header = ("Access-Control-Allow-Origin" => "*")`).

## iPhone App (iOS)

```bash
npm run ios
```

Das baut die WebApp, synchronisiert sie ins iOS-Projekt und öffnet Xcode.
Dort App auf Gerät/Simulator starten.

In der nativen App laufen die Requests über **CapacitorHttp** (natives
URLSession) — CORS spielt dort keine Rolle. Die `Info.plist` ist vorbereitet:

- `NSAppTransportSecurity` → `NSAllowsLocalNetworking` (HTTP statt HTTPS im LAN)
- `NSLocalNetworkUsageDescription` (iOS fragt beim ersten Zugriff nach der
  Berechtigung für das lokale Netzwerk)

## Datenformat

Der Aircraft Service liefert das dump1090/readsb-Format:

```json
{
  "now": 1783864866.5,
  "messages": 27896,
  "aircraft": [
    { "hex": "4b0ebc", "flight": "HBFPC", "alt_baro": 18000, "gs": 282.8,
      "track": 221.1, "lat": 47.807053, "lon": 8.552170, "category": "A3" }
  ]
}
```

Flugzeuge ohne `lat`/`lon` erscheinen nur in der Liste, nicht auf der Karte.
