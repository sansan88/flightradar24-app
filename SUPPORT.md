# Support — SkyPi (Live-Flugradar im Heimnetz)

SkyPi ist ein **privates, nicht-kommerzielles Hobby-Projekt** und wird in der
Freizeit entwickelt. Es gibt keinen kommerziellen Support und keine
garantierten Antwortzeiten — Feedback ist aber jederzeit willkommen.

## Fragen, Probleme, Fehlermeldungen

Bitte erfasse ein Issue im GitHub-Repository:

👉 <https://github.com/sansan88/flightradar24-app/issues>

Hilfreich sind dabei:

- iOS-Version und Gerätemodell (bzw. Browser bei der WebApp)
- Dein Pi-Setup (dump1090 oder readsb, Version)
- Was du erwartet hast und was stattdessen passiert ist

## Mitmachen

Das Projekt ist Open Source — **Pull Requests sind willkommen**:

👉 <https://github.com/sansan88/flightradar24-app/pulls>

## Häufige Fragen

**Die App findet meinen Raspberry Pi nicht.**
Prüfe, ob dein Gerät und der Pi im gleichen Netzwerk sind, ob IP-Adresse und
Port in den Einstellungen stimmen und ob
`http://<pi-ip>:8080/data/aircraft.json` im Browser erreichbar ist. Beim ersten
Start musst du der App zudem den Zugriff auf das lokale Netzwerk erlauben
(iOS-Einstellungen → SkyPi → Lokales Netzwerk).

**Welche Voraussetzungen brauche ich?**
Einen ADS-B-Empfänger im lokalen Netzwerk (z. B. Raspberry Pi mit DVB-T-Stick
und dump1090 oder readsb), der Flugdaten im Standardformat `aircraft.json`
bereitstellt. Anleitung: <https://github.com/sansan88/flightradar24>
