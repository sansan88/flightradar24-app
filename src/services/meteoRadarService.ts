import { Capacitor, CapacitorHttp } from '@capacitor/core';

/**
 * Niederschlagsradar von MeteoSchweiz (RZC-Komposit der fünf Wetterradare,
 * alle 5 Minuten aktualisiert). Nutzt die interne JSON-API der
 * MeteoSchweiz-Web-App (https://www.meteoschweiz.admin.ch → Niederschlag):
 *
 *   /product/output/radar/rzc/radar_rzc.<YYYYMMDD_HHMM>.json   (Zeit in UTC)
 *
 * Das Format ist undokumentiert: pro Intensitätsstufe (`areas`, mit Hex-Farbe)
 * eine Liste von Konturen im LV95-Gitter, als Lauflängen-kodierte Pfade.
 * Der Decoder unten ist dem JS-Bundle der MeteoSchweiz-Seite nachgebaut.
 */

const METEO_BASE = 'https://www.meteoschweiz.admin.ch';

interface RadarShape {
  /** Delta-Schritte: je 2 Zeichen pro Punkt, charCode − 77 ('K'…'O' = −2…+2) */
  d: string;
  /** Sub-Position (Ziffer 0–9) des Punkts auf der jeweiligen Gitterkante */
  o: string;
  /** Start-Index (Halbzellen) in x-Richtung */
  i: number;
  /** Start-Index (Halbzellen) in y-Richtung */
  j: number;
  /** Zeichen-Ebene: höhere Level (stärkere Intensität) liegen oben */
  l: number;
}

interface RadarJson {
  coords: {
    system: string;
    x_min: number;
    x_max: number;
    x_count: number;
    y_min: number;
    y_max: number;
    y_count: number;
  };
  /** Eine Fläche pro Intensitätsstufe; jede Shape-Gruppe = Polygon mit Löchern */
  areas: { color: string; shapes: RadarShape[][] }[];
}

export interface RadarResult {
  /** Zeitpunkt der Radarmessung */
  time: Date;
  geojson: GeoJSON.FeatureCollection;
}

/** Swisstopo-Näherungsformeln LV03/LV95 → WGS84 (wie von MeteoSchweiz genutzt) */
function chToWgs(x: number, y: number): [number, number] {
  const xp = (x - 600000) / 1e6;
  const yp = (y - 200000) / 1e6;
  const lat =
    16.9023892 +
    3.238272 * yp -
    0.270978 * xp ** 2 -
    0.002528 * yp ** 2 -
    0.0447 * xp ** 2 * yp -
    0.014 * yp ** 3;
  const lng =
    2.6779094 + 4.728982 * xp + 0.791484 * xp * yp + 0.1306 * xp * yp ** 2 - 0.0436 * xp ** 3;
  return [(lng * 100) / 36, (lat * 100) / 36];
}

/** Eine kodierte Kontur in einen geschlossenen WGS84-Ring dekodieren */
function decodeRing(shape: RadarShape, c: RadarJson['coords']): [number, number][] {
  let i = shape.i;
  let j = shape.j;
  const ring: [number, number][] = [];
  for (let s = 0; s < shape.o.length; s++) {
    const sub = parseInt(shape.o.charAt(s), 10) / 10 + 0.05;
    let x: number;
    let y: number;
    if (i % 2 === 0) {
      x = c.x_min + ((c.x_max - c.x_min) * (i / 2)) / c.x_count;
      y = c.y_min + ((c.y_max - c.y_min) * ((j - 1) / 2 + sub)) / c.y_count;
    } else {
      x = c.x_min + ((c.x_max - c.x_min) * ((i - 1) / 2 + sub)) / c.x_count;
      y = c.y_min + ((c.y_max - c.y_min) * (j / 2)) / c.y_count;
    }
    ring.push(chToWgs(1000 * x, 1000 * y));
    if (2 * s < shape.d.length) {
      i += shape.d.charCodeAt(2 * s) - 77;
      j += shape.d.charCodeAt(2 * s + 1) - 77;
    }
  }
  if (ring.length > 0) ring.push(ring[0]);
  return ring;
}

/** Radar-JSON in eine GeoJSON-FeatureCollection umwandeln (nach Level sortiert) */
export function decodeRadar(data: RadarJson): GeoJSON.FeatureCollection {
  const features: (GeoJSON.Feature & { level: number })[] = [];
  for (const area of data.areas) {
    for (const group of area.shapes) {
      const rings = group
        .map((shape) => decodeRing(shape, data.coords))
        .filter((ring) => ring.length >= 4);
      if (rings.length === 0) continue;
      features.push({
        type: 'Feature',
        level: group[0].l,
        properties: { color: `#${area.color}` },
        geometry: { type: 'MultiPolygon', coordinates: [rings] },
      });
    }
  }
  // Innerhalb des Fill-Layers zeichnet MapLibre in Feature-Reihenfolge –
  // stärkere Intensitäten (höheres Level) müssen zuletzt kommen
  features.sort((a, b) => a.level - b.level);
  return {
    type: 'FeatureCollection',
    features: features.map(({ level: _level, ...feature }) => feature),
  };
}

async function fetchMeteoJson(path: string): Promise<unknown | null> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url: `${METEO_BASE}${path}`,
      connectTimeout: 10000,
      readTimeout: 10000,
    });
    if (response.status === 404) return null;
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  }

  // meteoschweiz.admin.ch sendet keine CORS-Header – im Web-Dev den
  // Vite-Proxy (/meteo/*) nutzen
  const url = import.meta.env.DEV ? `/meteo${path}` : `${METEO_BASE}${path}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json();
}

/** Datum als UTC-Timestamp im MeteoSchweiz-Dateinamensformat (YYYYMMDD_HHMM) */
function utcStamp(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}` +
    `_${p(date.getUTCHours())}${p(date.getUTCMinutes())}`
  );
}

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * Neueste verfügbare Radarmessung holen: aktuelle Zeit auf 5 Minuten (UTC)
 * abrunden und bei 404 schrittweise 5 Minuten zurückgehen — MeteoSchweiz
 * publiziert die Frames mit ~4–5 Minuten Verzug, das abgerundete Frame
 * existiert also oft noch nicht.
 *
 * `newerThan`: Zeitstempel des bereits angezeigten Frames; ist kein neueres
 * verfügbar, wird `null` zurückgegeben statt dasselbe Bild neu zu laden.
 */
export async function fetchLatestRadar(newerThan?: Date): Promise<RadarResult | null> {
  let time = new Date(Math.floor(Date.now() / FIVE_MINUTES) * FIVE_MINUTES);
  for (let attempt = 0; attempt < 5; attempt++) {
    if (newerThan && time.getTime() <= newerThan.getTime()) return null;
    const data = await fetchMeteoJson(`/product/output/radar/rzc/radar_rzc.${utcStamp(time)}.json`);
    if (data) {
      return { time, geojson: decodeRadar(data as RadarJson) };
    }
    time = new Date(time.getTime() - FIVE_MINUTES);
  }
  if (newerThan) return null;
  throw new Error('Kein aktuelles Radarbild verfügbar');
}
