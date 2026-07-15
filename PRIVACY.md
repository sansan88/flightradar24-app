# Datenschutzrichtlinie — SkyPi (Live-Flugradar im Heimnetz)

*Stand: 15. Juli 2026*

SkyPi ist ein privates, nicht-kommerzielles Open-Source-Projekt. Die App zeigt
Flugdaten an, die dein eigener ADS-B-Empfänger (z. B. Raspberry Pi mit
dump1090/readsb) in deinem lokalen Netzwerk bereitstellt.

## Keine Erhebung von Nutzerdaten

- Die App sammelt, speichert und übermittelt **keine personenbezogenen Daten**.
- Es gibt **kein Benutzerkonto**, keine Registrierung und kein Login.
- Es sind **keine Analyse-, Tracking- oder Werbedienste** eingebaut.
- Es werden keine Daten an den Entwickler oder an Dritte weitergegeben oder
  verkauft.

## Daten bleiben lokal

- Die Flugdaten liest die App direkt von deinem Raspberry Pi im lokalen
  Netzwerk (`aircraft.json`). Diese Daten verlassen dein Netzwerk nicht.
- Deine Einstellungen (IP-Adresse des Pi, Aktualisierungsintervall, Filter,
  Kartenwahl) werden ausschliesslich **lokal auf deinem Gerät** gespeichert.

## Technisch notwendige Netzwerkzugriffe

Für einzelne Funktionen ruft die App öffentlich verfügbare Informationen von
Drittanbietern ab. Dabei werden keine personenbezogenen Daten übermittelt —
technisch bedingt sehen diese Server jedoch deine IP-Adresse:

- **adsbdb.com** — Flugzeug- und Routeninfos (Abfrage von Callsign bzw.
  ICAO-Hex-Code eines Flugzeugs)
- **Kartendienste** (Swisstopo via map.geo.admin.ch, OpenStreetMap u. a.) —
  Laden der Kartenkacheln

Für diese Dienste gelten die Datenschutzbestimmungen der jeweiligen Anbieter.

## Berechtigungen

Die App fragt unter iOS die Berechtigung für den Zugriff auf das **lokale
Netzwerk** an — ausschliesslich, um deinen Raspberry Pi zu erreichen. Es wird
kein Standort, keine Kamera, kein Mikrofon und kein Adressbuch verwendet.

## Kontakt und Fragen

Fragen zum Datenschutz kannst du als Issue im GitHub-Repository stellen:
<https://github.com/sansan88/flightradar24-app/issues>

## Änderungen

Änderungen an dieser Richtlinie werden in diesem Dokument im GitHub-Repository
veröffentlicht.
