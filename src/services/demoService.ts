import type { Aircraft, AircraftResponse } from '../types/aircraft';

/**
 * Simulierte Flugzeuge für den Demomodus (Ersteinrichtung ohne Raspberry Pi).
 * Die Flieger bewegen sich zwischen den Abrufen physikalisch plausibel weiter
 * (Kurs, Geschwindigkeit, Steig-/Sinkflug) und fliegen am Rand des
 * Empfangsgebiets wieder neu ein. Liefert dasselbe Format wie aircraft.json.
 */

/** Zentrum des simulierten Empfangsgebiets (Zürich) */
const CENTER = { lat: 47.3769, lon: 8.5417 };
/** Ab dieser Distanz zum Zentrum fliegt ein Flugzeug neu ein (km) */
const MAX_DISTANCE_KM = 90;
/** Maximaler Simulationsschritt, falls die App pausiert war (s) */
const MAX_STEP_S = 30;

const DEG = Math.PI / 180;
/** km pro Grad Breite bzw. Länge (auf Breite des Zentrums) */
const KM_PER_DEG_LAT = 111;
const KM_PER_DEG_LON = 111 * Math.cos(CENTER.lat * DEG);

interface DemoPlane {
  hex: string;
  flight: string;
  category: string;
  squawk: string;
  /** ohne Position: erscheint nur in der Liste, nicht auf der Karte */
  lat?: number;
  lon?: number;
  track: number;
  /** Geschwindigkeit über Grund in Knoten */
  gs: number;
  /** Höhe in Fuss */
  altFt: number;
  /** Zielhöhe in Fuss – Steig-/Sinkflug endet dort */
  targetAltFt: number;
  /** Steig-/Sinkrate in Fuss/min */
  baroRate: number;
  /** leichte Kursänderung in Grad/s (Helikopter/Segelflieger kreisen) */
  turnRate: number;
  msgs: number;
}

interface Blueprint {
  hex: string;
  flight: string;
  category: string;
  gs: number;
  altFt: number;
  targetAltFt?: number;
  baroRate?: number;
  turnRate?: number;
  noPosition?: boolean;
}

/** Typischer Mix über der Schweiz: Airliner, Businessjet, Rega, Segelflieger */
const FLEET: Blueprint[] = [
  { hex: '4b1801', flight: 'SWR23A', category: 'A3', gs: 440, altFt: 36000 },
  { hex: '4b0289', flight: 'EDW56', category: 'A5', gs: 465, altFt: 38000 },
  { hex: '3c65a1', flight: 'DLH57K', category: 'A3', gs: 430, altFt: 34000 },
  { hex: '4b1f22', flight: 'EZS81BF', category: 'A3', gs: 415, altFt: 32000 },
  { hex: '400f8b', flight: 'BAW714', category: 'A3', gs: 450, altFt: 37000 },
  { hex: '06a0f2', flight: 'QTR8112', category: 'A5', gs: 480, altFt: 40000, targetAltFt: 26000, baroRate: -1400 },
  { hex: '4b1a2f', flight: 'SWR761', category: 'A2', gs: 310, altFt: 9000, targetAltFt: 25000, baroRate: 1900 },
  { hex: '4b43aa', flight: 'REGA5', category: 'A7', gs: 130, altFt: 3500, turnRate: 1.2 },
  { hex: '4b32e1', flight: 'HBSGU', category: 'B1', gs: 62, altFt: 6800, turnRate: 2.4 },
  { hex: '4b28cd', flight: 'HBKFD', category: 'A1', gs: 105, altFt: 4500 },
  // Nur Mode-S ohne Positionsdaten: erscheint nur in der Liste
  { hex: '4b2ac3', flight: 'SWR199', category: 'A3', gs: 445, altFt: 39000, noPosition: true },
];

let planes: DemoPlane[] | null = null;
let lastTick = 0;
let totalMessages = 0;

function distanceFromCenterKm(lat: number, lon: number): number {
  const dx = (lon - CENTER.lon) * KM_PER_DEG_LON;
  const dy = (lat - CENTER.lat) * KM_PER_DEG_LAT;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Position im Umkreis des Zentrums (km, Peilung in Grad) */
function positionAt(bearingDeg: number, distanceKm: number): { lat: number; lon: number } {
  const rad = bearingDeg * DEG;
  return {
    lat: CENTER.lat + (distanceKm * Math.cos(rad)) / KM_PER_DEG_LAT,
    lon: CENTER.lon + (distanceKm * Math.sin(rad)) / KM_PER_DEG_LON,
  };
}

/** Am Rand des Empfangsgebiets neu einfliegen lassen, grob Richtung Zentrum */
function respawnAtEdge(p: DemoPlane): void {
  const bearing = Math.random() * 360;
  const pos = positionAt(bearing, MAX_DISTANCE_KM - 5);
  p.lat = pos.lat;
  p.lon = pos.lon;
  p.track = (bearing + 180 + (Math.random() * 80 - 40) + 360) % 360;
}

function createFleet(): DemoPlane[] {
  return FLEET.map((bp) => {
    const plane: DemoPlane = {
      hex: bp.hex,
      flight: bp.flight,
      category: bp.category,
      squawk: String(1000 + Math.floor(Math.random() * 6000)),
      track: Math.random() * 360,
      gs: bp.gs,
      altFt: bp.altFt,
      targetAltFt: bp.targetAltFt ?? bp.altFt,
      baroRate: bp.baroRate ?? 0,
      turnRate: bp.turnRate ?? Math.random() * 0.2 - 0.1,
      msgs: Math.floor(Math.random() * 500),
    };
    if (!bp.noPosition) {
      const pos = positionAt(Math.random() * 360, 10 + Math.random() * 55);
      plane.lat = pos.lat;
      plane.lon = pos.lon;
    }
    return plane;
  });
}

function advance(p: DemoPlane, dtS: number): void {
  p.msgs += Math.round(dtS * (5 + Math.random() * 20));
  if (p.lat == null || p.lon == null) return;

  p.track = (p.track + p.turnRate * dtS + 360) % 360;
  const distNm = (p.gs * dtS) / 3600;
  const rad = p.track * DEG;
  p.lat += (distNm * 1.852 * Math.cos(rad)) / KM_PER_DEG_LAT;
  p.lon += (distNm * 1.852 * Math.sin(rad)) / KM_PER_DEG_LON;

  if (p.baroRate !== 0) {
    p.altFt += (p.baroRate * dtS) / 60;
    if (
      (p.baroRate > 0 && p.altFt >= p.targetAltFt) ||
      (p.baroRate < 0 && p.altFt <= p.targetAltFt)
    ) {
      p.altFt = p.targetAltFt;
      p.baroRate = 0;
    }
  }

  if (distanceFromCenterKm(p.lat, p.lon) > MAX_DISTANCE_KM) {
    respawnAtEdge(p);
  }
}

function toAircraft(p: DemoPlane): Aircraft {
  return {
    hex: p.hex,
    flight: `${p.flight} `,
    category: p.category,
    squawk: p.squawk,
    lat: p.lat != null ? Math.round(p.lat * 1e5) / 1e5 : undefined,
    lon: p.lon != null ? Math.round(p.lon * 1e5) / 1e5 : undefined,
    track: Math.round(p.track * 10) / 10,
    gs: p.gs,
    alt_baro: Math.round(p.altFt / 25) * 25,
    baro_rate: Math.round(p.baroRate / 64) * 64,
    seen: 0,
    seen_pos: p.lat != null ? 0 : undefined,
    rssi: Math.round((-4 - Math.random() * 20) * 10) / 10,
    messages: p.msgs,
  };
}

/** Aktuellen Stand der Simulation abrufen (Format wie aircraft.json) */
export function fetchDemoAircraft(): AircraftResponse {
  const now = Date.now();
  if (!planes) {
    planes = createFleet();
    lastTick = now;
  }
  const dtS = Math.min(Math.max((now - lastTick) / 1000, 0), MAX_STEP_S);
  lastTick = now;
  for (const p of planes) advance(p, dtS);
  totalMessages += Math.round(planes.length * dtS * 25 * (0.8 + Math.random() * 0.4));
  return {
    now: now / 1000,
    messages: totalMessages,
    aircraft: planes.map(toAircraft),
  };
}

/** Simulation zurücksetzen (beim Beenden/Neustarten des Demomodus) */
export function resetDemo(): void {
  planes = null;
  totalMessages = 0;
}
