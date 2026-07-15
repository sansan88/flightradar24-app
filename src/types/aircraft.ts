/** Ein Flugzeug aus aircraft.json (dump1090 / readsb Format) */
export interface Aircraft {
  hex: string;
  flight?: string;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  ias?: number;
  tas?: number;
  mach?: number;
  track?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  emergency?: string;
  category?: string;
  lat?: number;
  lon?: number;
  seen_pos?: number;
  seen?: number;
  rssi?: number;
  messages?: number;
}

/** Ein Punkt der aufgezeichneten Positions-Historie eines Flugzeugs */
export interface TrackPoint {
  lon: number;
  lat: number;
  alt?: number | 'ground';
  /** Zeitstempel (ms), wann der Punkt zuletzt bestätigt wurde */
  t: number;
}

export interface AircraftResponse {
  now: number;
  messages: number;
  aircraft: Aircraft[];
}

/** ADS-B Emitter-Kategorien mit deutscher Beschreibung */
export const AIRCRAFT_CATEGORIES: Record<string, string> = {
  A0: 'A0 – Keine Info',
  A1: 'A1 – Leicht (< 7 t)',
  A2: 'A2 – Klein (7–34 t)',
  A3: 'A3 – Gross (34–136 t)',
  A4: 'A4 – Starke Wirbelschleppe (B757)',
  A5: 'A5 – Schwer (> 136 t)',
  A6: 'A6 – Hohe Leistung (> 5 g)',
  A7: 'A7 – Helikopter',
  B1: 'B1 – Segelflugzeug',
  B2: 'B2 – Ballon / Luftschiff',
  B4: 'B4 – Gleitschirm / Fallschirm',
  B6: 'B6 – Drohne (UAV)',
  C0: 'C0 – Bodenfahrzeug (Keine Info)',
  C1: 'C1 – Rettungsfahrzeug',
  C2: 'C2 – Servicefahrzeug',
  none: 'Ohne Kategorie',
};

/** Kategorie eines Flugzeugs für den Filter ('none' wenn nicht gesendet) */
export function categoryOf(ac: Aircraft): string {
  return ac.category ?? 'none';
}

export function callsignOf(ac: Aircraft): string {
  return ac.flight?.trim() || ac.hex.toUpperCase();
}

export function metersFromFeet(feet: number): number {
  return Math.round(feet * 0.3048);
}

export function kmhFromKnots(knots: number): number {
  return Math.round(knots * 1.852);
}

/** Höhe in Metern über Meer */
export function formatAltitude(alt?: number | 'ground'): string {
  if (alt === 'ground') return 'Am Boden';
  if (alt == null) return '–';
  return `${metersFromFeet(alt).toLocaleString('de-CH')} m ü. M.`;
}

/** Geschwindigkeit in km/h */
export function formatSpeed(knots?: number): string {
  if (knots == null) return '–';
  return `${kmhFromKnots(knots).toLocaleString('de-CH')} km/h`;
}

/** Steig-/Sinkrate in m/s (aus ft/min), mit Vorzeichen */
export function formatVerticalRate(feetPerMin?: number): string {
  if (feetPerMin == null) return '–';
  const ms = feetPerMin * 0.00508;
  const rounded = Math.round(ms * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('de-CH')} m/s`;
}
