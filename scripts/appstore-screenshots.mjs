/**
 * App Store Screenshots mit Playwright.
 *
 * Emuliert ein iPhone 13 Pro Max (Viewport 428×926 @3x) und erzeugt damit
 * Screenshots in exakt 1284×2778 px – das von App Store Connect für diese
 * App verlangte iPhone-6,5-Zoll-Format; iPad in 2048×2732 (13 Zoll).
 *
 * Der Raspberry-Pi-Feed (/data/aircraft.json) und api.adsbdb.com werden
 * gemockt: eine kleine simulierte Flotte bewegt sich realistisch über die
 * Region Schaffhausen, damit auch die Track-Linie im Detail-Sheet sichtbar ist.
 *
 * Verwendung:  npm run dev  (läuft bereits)  →  node scripts/appstore-screenshots.mjs [baseUrl]
 */
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = process.argv[2] ?? 'http://localhost:5174';
const OUT_DIR = resolve(import.meta.dirname, '..', 'appstore-screenshots');
mkdirSync(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Simulierte Flotte rund um Schaffhausen (Kartenzentrum 8.6268 / 47.6985)
// idealPos = Position ~25 s nach App-Start, dann liegen alle schön im Bild
// und das ausgewählte Flugzeug hat bereits eine Track-Linie hinter sich.
// ---------------------------------------------------------------------------
const T_IDEAL = 25; // Sekunden
const KNOTS_TO_MS = 0.5144;
const M_PER_DEG_LAT = 111_320;

const FLEET = [
  {
    hex: '4b1804', flight: 'SWR23K', lat: 47.723, lon: 8.571, track: 302,
    alt: 28_000, gs: 462, rate: 1_600, squawk: '1023', category: 'A5', rssi: -8.1,
    details: {
      type: 'A330-343', icao_type: 'A333', manufacturer: 'Airbus',
      registration: 'HB-JHE', registered_owner: 'Swiss International Air Lines',
      registered_owner_country_name: 'Switzerland', registered_owner_country_iso_name: 'CH',
    },
    route: {
      airline: { name: 'Swiss International Air Lines', icao: 'SWR', iata: 'LX' },
      origin: { iata_code: 'ZRH', icao_code: 'LSZH', name: 'Zürich Airport', municipality: 'Zürich', country_name: 'Switzerland' },
      destination: { iata_code: 'JFK', icao_code: 'KJFK', name: 'John F. Kennedy International Airport', municipality: 'New York', country_name: 'United States' },
    },
  },
  {
    hex: '4b1f4c', flight: 'EDW24', lat: 47.677, lon: 8.638, track: 214,
    alt: 21_000, gs: 424, rate: 2_100, squawk: '5512', category: 'A3', rssi: -5.4,
    details: {
      type: 'A320-214', icao_type: 'A320', manufacturer: 'Airbus',
      registration: 'HB-JLT', registered_owner: 'Edelweiss Air',
      registered_owner_country_name: 'Switzerland', registered_owner_country_iso_name: 'CH',
    },
    route: {
      airline: { name: 'Edelweiss Air', icao: 'EDW', iata: 'WK' },
      origin: { iata_code: 'ZRH', icao_code: 'LSZH', name: 'Zürich Airport', municipality: 'Zürich', country_name: 'Switzerland' },
      destination: { iata_code: 'PMI', icao_code: 'LEPA', name: 'Palma de Mallorca Airport', municipality: 'Palma de Mallorca', country_name: 'Spain' },
    },
  },
  {
    hex: '3c65a2', flight: 'DLH4TK', lat: 47.752, lon: 8.604, track: 158,
    alt: 12_000, gs: 318, rate: -1_400, squawk: '1000', category: 'A3', rssi: -12.7,
    details: {
      type: 'A320-271N', icao_type: 'A20N', manufacturer: 'Airbus',
      registration: 'D-AINY', registered_owner: 'Lufthansa',
      registered_owner_country_name: 'Germany', registered_owner_country_iso_name: 'DE',
    },
    route: {
      airline: { name: 'Lufthansa', icao: 'DLH', iata: 'LH' },
      origin: { iata_code: 'FRA', icao_code: 'EDDF', name: 'Frankfurt am Main Airport', municipality: 'Frankfurt', country_name: 'Germany' },
      destination: { iata_code: 'ZRH', icao_code: 'LSZH', name: 'Zürich Airport', municipality: 'Zürich', country_name: 'Switzerland' },
    },
  },
  {
    hex: '4b19f2', flight: 'EZS81PB', lat: 47.712, lon: 8.699, track: 248,
    alt: 24_000, gs: 447, rate: 0, squawk: '4571', category: 'A3', rssi: -9.8,
    details: {
      type: 'A320-214', icao_type: 'A320', manufacturer: 'Airbus',
      registration: 'HB-JXN', registered_owner: 'easyJet Switzerland',
      registered_owner_country_name: 'Switzerland', registered_owner_country_iso_name: 'CH',
    },
    route: {
      airline: { name: 'easyJet Switzerland', icao: 'EZS', iata: 'DS' },
      origin: { iata_code: 'ZRH', icao_code: 'LSZH', name: 'Zürich Airport', municipality: 'Zürich', country_name: 'Switzerland' },
      destination: { iata_code: 'OPO', icao_code: 'LPPR', name: 'Francisco Sá Carneiro Airport', municipality: 'Porto', country_name: 'Portugal' },
    },
  },
  {
    hex: '4b0f33', flight: 'HBKFW', lat: 47.664, lon: 8.601, track: 88,
    alt: 4_500, gs: 112, rate: 300, squawk: '7000', category: 'A1', rssi: -18.2,
    details: {
      type: 'DR 400/180', icao_type: 'DR40', manufacturer: 'Robin',
      registration: 'HB-KFW', registered_owner: 'Fluggruppe Schaffhausen',
      registered_owner_country_name: 'Switzerland', registered_owner_country_iso_name: 'CH',
    },
    route: null,
  },
  {
    // Sinkender Langstreckenflug → erfüllt den Anflug-Filter der Retro-Anzeige
    // (Kategorie A5, geom_rate < -0.1, unter 15 000 ft)
    hex: '4b1620', flight: 'SWR161', lat: 47.671, lon: 8.545, track: 196,
    alt: 9_800, gs: 322, rate: -1_750, squawk: '1327', category: 'A5', rssi: -6.9,
    details: {
      type: '777-3DE ER', icao_type: 'B77W', manufacturer: 'Boeing',
      registration: 'HB-JNB', registered_owner: 'Swiss International Air Lines',
      registered_owner_country_name: 'Switzerland', registered_owner_country_iso_name: 'CH',
    },
    route: {
      airline: { name: 'Swiss International Air Lines', icao: 'SWR', iata: 'LX' },
      origin: { iata_code: 'BKK', icao_code: 'VTBS', name: 'Suvarnabhumi Airport', municipality: 'Bangkok', country_name: 'Thailand' },
      destination: { iata_code: 'ZRH', icao_code: 'LSZH', name: 'Zürich Airport', municipality: 'Zürich', country_name: 'Switzerland' },
    },
  },
  {
    hex: '4b43a9', flight: 'REGA3', lat: 47.728, lon: 8.664, track: 47,
    alt: 2_800, gs: 128, rate: 0, squawk: '7000', category: 'A7', rssi: -15.6,
    details: {
      type: 'H145 (BK117 D-2)', icao_type: 'EC45', manufacturer: 'Airbus Helicopters',
      registration: 'HB-ZQK', registered_owner: 'Rega – Schweizerische Rettungsflugwacht',
      registered_owner_country_name: 'Switzerland', registered_owner_country_iso_name: 'CH',
    },
    route: null,
  },
];

/** Position eines Flugzeugs zum Zeitpunkt t (Sekunden seit Kontext-Start) */
function positionAt(plane, t) {
  const v = plane.gs * KNOTS_TO_MS;
  const dt = t - T_IDEAL;
  const rad = (plane.track * Math.PI) / 180;
  const dLat = (v * Math.cos(rad) * dt) / M_PER_DEG_LAT;
  const dLon =
    (v * Math.sin(rad) * dt) / (M_PER_DEG_LAT * Math.cos((plane.lat * Math.PI) / 180));
  return { lat: plane.lat + dLat, lon: plane.lon + dLon };
}

function aircraftJson(state) {
  const t = (Date.now() - state.start) / 1000;
  return {
    now: Date.now() / 1000,
    messages: 1_284_557 + Math.round(t * 310),
    aircraft: FLEET.map((p) => {
      const { lat, lon } = positionAt(p, t);
      return {
        hex: p.hex,
        flight: `${p.flight}  `.slice(0, 8),
        alt_baro: p.alt,
        alt_geom: p.alt + 75,
        gs: p.gs,
        track: p.track,
        baro_rate: p.rate,
        geom_rate: p.rate,
        squawk: p.squawk,
        category: p.category,
        lat,
        lon,
        seen_pos: 0.2,
        seen: 0.1,
        rssi: p.rssi,
        messages: 4_211 + Math.round(t * 3),
      };
    }),
  };
}

/**
 * Mock-Routen für den Pi-Feed und api.adsbdb.com auf einem Browser-Context.
 * Jeder Context bekommt eine eigene Simulations-Uhr, damit die Flotte bei
 * t = T_IDEAL unabhängig von der bisherigen Laufzeit ideal im Bild liegt.
 */
async function mockRoutes(context) {
  const state = { start: Date.now() };
  await context.route('**/data/aircraft.json*', (route) =>
    route.fulfill({ json: aircraftJson(state) })
  );
  await context.route('https://api.adsbdb.com/v0/callsign/**', (route) => {
    const callsign = decodeURIComponent(route.request().url().split('/').pop());
    const plane = FLEET.find((p) => p.flight === callsign);
    if (plane?.route) {
      route.fulfill({ json: { response: { flightroute: { callsign, airline: plane.route.airline, origin: plane.route.origin, destination: plane.route.destination } } } });
    } else {
      route.fulfill({ status: 404, json: { response: 'unknown callsign' } });
    }
  });
  await context.route('https://api.adsbdb.com/v0/aircraft/**', (route) => {
    // Kombi-Call: /v0/aircraft/<hex>?callsign=<cs> → aircraft + flightroute
    const url = new URL(route.request().url());
    const hex = url.pathname.split('/').pop()?.toLowerCase();
    const plane = FLEET.find((p) => p.hex === hex);
    if (!plane) {
      route.fulfill({ status: 404, json: { response: 'unknown aircraft' } });
      return;
    }
    const response = { aircraft: plane.details };
    if (url.searchParams.has('callsign') && plane.route) {
      response.flightroute = {
        callsign: plane.flight,
        airline: plane.route.airline,
        origin: plane.route.origin,
        destination: plane.route.destination,
      };
    }
    route.fulfill({ json: { response } });
  });
  return state;
}

/**
 * Geräteprofile mit den von App Store Connect akzeptierten Pixelmassen.
 * Die Playwright-Presets nutzen den Safari-Viewport (mit Browser-UI) –
 * für App-Store-Screenshots braucht es den vollen Screen, daher wird der
 * Viewport jeweils explizit überschrieben.
 */
const DEVICE_PROFILES = {
  // iPhone 6,5": 428×926 @3x → 1284×2778 (von App Store Connect verlangt)
  iphone: {
    ...devices['iPhone 13 Pro Max'],
    viewport: { width: 428, height: 926 },
  },
  // iPad Pro 12,9"/13": 1024×1366 @2x → 2048×2732
  ipad: {
    ...devices['iPad Pro 11'],
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
  },
};

async function newAppContext(browser, deviceProfile, colorScheme) {
  const context = await browser.newContext({
    ...deviceProfile,
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
    colorScheme,
  });
  // Ersteinrichtung überspringen: Settings mit setupCompleted vorbelegen
  // (Capacitor Preferences nutzt im Web localStorage mit CapacitorStorage-Präfix)
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      'CapacitorStorage.flightradar-settings',
      JSON.stringify({
        mapLayer: 'auto',
        ip: '192.168.1.100',
        port: 8080,
        refreshInterval: 2,
        categories: [],
        markerLineTags: [['callsign'], [], []],
        demoMode: false,
        setupCompleted: true,
      }),
    ]
  );
  const state = await mockRoutes(context);
  return { context, state };
}

/** Bis zum Ideal-Zeitpunkt der Simulation warten (Flotte schön im Bild) */
async function waitUntilIdeal(page, state) {
  const remaining = state.start + T_IDEAL * 1000 - Date.now();
  if (remaining > 0) await page.waitForTimeout(remaining);
}

async function shoot(page, dir, name) {
  const path = resolve(dir, name);
  await page.screenshot({ path });
  console.log(`✓ ${name}`);
}

/** Warten, bis Karte + Marker gerendert sind (Tiles geladen, Netz ruhig) */
async function waitForMap(page) {
  await page.waitForSelector('.plane-marker', { timeout: 60_000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3_000); // Tile-Fade-In der Karte abwarten
}

/** Kompletter Screenshot-Satz (hell 01–07, dunkel 08) für ein Geräteprofil */
async function captureSet(browser, deviceKey) {
  const dir = resolve(OUT_DIR, deviceKey);
  mkdirSync(dir, { recursive: true });
  console.log(`\n— ${deviceKey} —`);

  // --- Heller Modus: Karte, Detail-Sheet, Detail-Voll, Liste, Einstellungen ---
  {
    const { context, state } = await newAppContext(
      browser,
      DEVICE_PROFILES[deviceKey],
      'light'
    );
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/map`);
    await waitForMap(page);
    await waitUntilIdeal(page, state);
    await shoot(page, dir, '01-karte.png');

    // Flugzeug antippen → Sheet mit Zusammenfassung + Track-Linie auf der Karte.
    // dispatchEvent statt click(): der Marker bewegt sich mit jedem Poll und
    // kann knapp ausserhalb des Viewports liegen — die Karte zentriert nach
    // der Auswahl ohnehin per flyTo auf das Flugzeug.
    const sheetSummary = page.locator('ion-modal .sheet-summary');
    for (let attempt = 1; attempt <= 5; attempt++) {
      await page.locator('.plane-marker', { hasText: 'EDW24' }).dispatchEvent('click');
      try {
        await sheetSummary.waitFor({ state: 'visible', timeout: 5_000 });
        break;
      } catch {
        // Klick ging ins Leere (Marker beim Poll gerade ersetzt) → nochmals
        if (attempt === 5) throw new Error('Detail-Sheet öffnete sich nicht');
      }
    }
    await page.waitForTimeout(5_000); // ein paar Polls → Track-Linie wächst
    await shoot(page, dir, '02-flug-details-karte.png');

    // Sheet ganz aufziehen → vollständige Detail-Ansicht
    await page.evaluate(() => document.querySelector('ion-modal')?.setCurrentBreakpoint(0.9));
    await page.waitForTimeout(1_200);
    await shoot(page, dir, '03-flug-details.png');
    await page.evaluate(() => document.querySelector('ion-modal')?.dismiss());
    await page.waitForTimeout(800);

    // Retro-Anzeige (LED-Matrix mit aktuellem Anflug)
    await page.locator('ion-tab-button[tab="retro"]').click();
    await page.waitForSelector('.led-canvas');
    await page.waitForTimeout(3_000); // Enrichment + LED-Rendering abwarten
    await shoot(page, dir, '04-retro.png');

    // Liste
    await page.locator('ion-tab-button[tab="list"]').click();
    // :visible — die zuvor besuchte Retro-Seite behält ihre (versteckten)
    // ion-items im DOM des Router-Outlets
    await page.waitForSelector('ion-list ion-item:visible');
    await page.waitForTimeout(1_500);
    await shoot(page, dir, '05-liste.png');

    // Einstellungen
    await page.locator('ion-tab-button[tab="settings"]').click();
    await page.waitForTimeout(1_500);
    await shoot(page, dir, '06-einstellungen.png');

    // Info
    await page.locator('ion-tab-button[tab="info"]').click();
    await page.waitForTimeout(1_500);
    await shoot(page, dir, '07-info.png');

    await context.close();
  }

  // --- Dunkler Modus: Karte ---
  {
    const { context, state } = await newAppContext(
      browser,
      DEVICE_PROFILES[deviceKey],
      'dark'
    );
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/map`);
    await waitForMap(page);
    await waitUntilIdeal(page, state);
    await shoot(page, dir, '08-karte-dunkel.png');
    await context.close();
  }
}

const browser = await chromium.launch();
for (const deviceKey of Object.keys(DEVICE_PROFILES)) {
  await captureSet(browser, deviceKey);
}
await browser.close();
console.log(`\nFertig → ${OUT_DIR}`);
