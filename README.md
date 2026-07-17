# SkyPi — Live-Flugradar im Heimnetz

**App Name:** SkyPi · **App ID:** `ch.sansan.flightradar` ·
**Repo:** [sansan88/flightradar24-app](https://github.com/sansan88/flightradar24-app)

📄 [Datenschutzrichtlinie](PRIVACY.md) · 🛟 [Support](SUPPORT.md) —
privates Open-Source-Projekt: [Issues](https://github.com/sansan88/flightradar24-app/issues)
und [Pull Requests](https://github.com/sansan88/flightradar24-app/pulls) willkommen.

Ionic React App (WebApp + native iPhone App via Capacitor), die den lokalen
Aircraft Service eines Raspberry Pi abruft und alle empfangenen Flugzeuge live
auf der **Swisstopo-Karte** (MapLibre GL) anzeigt.

Quelle der Flugdaten: [sansan88/flightradar24](https://github.com/sansan88/flightradar24)
(Raspberry Pi mit ADS-B Empfänger, dump1090) —
`http://<pi-ip>:8080/data/aircraft.json`

## App Store

**Werbetext:**

> Dein persönlicher Flugradar: zeigt live alle Flugzeuge, die dein Raspberry Pi
> mit ADS-B-Empfänger auffängt – auf der Swisstopo-Karte, mit Flugzeug- und
> Routeninfos.

**Beschreibung:**

> SkyPi macht deinen Raspberry Pi mit ADS-B-Empfänger zur persönlichen
> Flugverfolgungs-Zentrale. Die App verbindet sich direkt mit deinem Pi im
> lokalen Netzwerk und zeigt alle empfangenen Flugzeuge live auf der Karte –
> ganz ohne Konto, Cloud oder Abo.
>
> **DEIN EIGENER FLUGRADAR**
> Empfange Flugdaten direkt von deinem eigenen ADS-B-Empfänger
> (dump1090/readsb) und sieh in Echtzeit, was über deinem Zuhause fliegt. Das
> Aktualisierungsintervall ist frei wählbar (1–30 Sekunden).
>
> **LIVE-KARTE**
> - Alle Flugzeuge mit Position auf der Karte, ausgerichtet nach Flugrichtung
> - Farbcodierung nach Flughöhe – auf einen Blick erkennbar, wer hoch oder tief
>   unterwegs ist
> - Frei wählbare Kartenhintergründe: Swisstopo Landeskarte (farbig oder grau),
>   Swisstopo Luftbild, OpenStreetMap sowie helle und dunkle Karten – auf Wunsch
>   automatisch passend zum Hell-/Dunkelmodus deines Geräts
> - Konfigurierbare Beschriftung direkt am Flugzeug-Symbol: bis zu drei Zeilen
>   mit Callsign, Registration, Flugzeugtyp, Route, Höhe, Geschwindigkeit oder
>   Kategorie
> - Verbindungsstatus und Datenquelle jederzeit sichtbar
>
> **FLUGZEUG- UND ROUTENINFOS**
> Zu jedem Flugzeug lädt die App Zusatzinformationen von adsbdb.com: Hersteller,
> Typ, Betreiber, Registration sowie die Route mit Abflug- und Zielflughafen
> inklusive Länderflaggen. Ein Tipp auf ein Flugzeug öffnet die Detailansicht
> mit allen Daten – Höhe, Geschwindigkeit, Kurs, Squawk und mehr.
>
> **LISTENANSICHT**
> Alle empfangenen Flugzeuge übersichtlich in einer Liste – auch solche, die
> (noch) keine Position senden. Aktive Flugzeuge mit Positionsdaten stehen
> automatisch zuoberst.
>
> **FLEXIBLE EINSTELLUNGEN**
> - IP-Adresse und Port deines Raspberry Pi frei konfigurierbar
> - Aktualisierungsintervall von 1 bis 30 Sekunden
> - Filter nach ADS-B-Kategorien (z. B. leichte Flugzeuge, Verkehrsflugzeuge,
>   Helikopter)
> - Höhenangaben in Metern
>
> **PRIVAT UND LOKAL**
> Deine Flugdaten bleiben in deinem Netzwerk: Die App liest sie direkt vom
> Raspberry Pi, ohne Umweg über fremde Server. Es ist kein Konto nötig, und es
> werden keine Nutzerdaten gesammelt.
>
> **VORAUSSETZUNGEN**
> Du benötigst einen ADS-B-Empfänger im lokalen Netzwerk (z. B. Raspberry Pi
> mit DVB-T-Stick und dump1090 oder readsb), der Flugdaten im Standardformat
> aircraft.json bereitstellt. Die App ist die ideale Ergänzung zu deinem
> bestehenden ADS-B-Setup.
>
> Perfekt für Planespotter, Aviatik-Fans und alle, die wissen wollen, was
> gerade über ihnen fliegt.

## Features

- 🗺️ **Karte**: Alle Flugzeuge mit Position auf der Swisstopo-Landeskarte,
  Ausrichtung nach Kurs, Farbe nach Flughöhe, Popup mit Details
  (Callsign, Höhe, Geschwindigkeit, Squawk, …)
- ✈️ **Flugzeug- & Routeninfos** von [adsbdb.com](https://www.adsbdb.com/)
  (wie im flightradar24-Script auf dem Pi): Typ, Hersteller, Betreiber,
  Registration sowie Route (Abflug → Ziel). Antworten werden 24 h im
  LRU-Cache gehalten, auch unbekannte Callsigns (404) werden gecacht.
- 📋 **Liste**: Alle empfangenen Flugzeuge, auch ohne Positionsdaten —
  aktive Flieger (mit aktueller Position) stehen zuoberst
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
(lighttpd) keine CORS-Header sendet. Standardziel ist `http://192.168.1.100:8080`,
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
