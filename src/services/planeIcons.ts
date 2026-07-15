import type { Aircraft } from '../types/aircraft';

/** Silhouetten-Typen für die Karten-Icons (im Stil von Flightradar24) */
export type PlaneShapeKey =
  | 'jet'
  | 'heavy'
  | 'prop'
  | 'heli'
  | 'glider'
  | 'balloon'
  | 'drone';

interface PlaneShape {
  /** SVG-Pfad, viewBox 0 0 32 32, Nase nach oben */
  path: string;
  /** Icon-Grösse in Pixeln auf der Karte */
  size: number;
  /** false = Icon wird nicht nach Flugrichtung gedreht (z. B. Ballon) */
  rotates?: boolean;
}

export const PLANE_SHAPES: Record<PlaneShapeKey, PlaneShape> = {
  /** Verkehrsjet mit gepfeilten Flügeln (Standard) */
  jet: {
    path: 'M16 1c1.1 0 1.9 1.3 2.1 3l.4 3.3v3.2l11.6 7.1c.6.4.9 1 .9 1.6v2.1l-12.3-3.9-.5 6.9 4 2.9v2.3L16 28.3l-6.2 1.2v-2.3l4-2.9-.5-6.9L1 21.3v-2.1c0-.6.3-1.2.9-1.6l11.6-7.1V7.3l.4-3.3c.2-1.7 1-3 2.1-3z',
    size: 30,
  },
  /** Widebody / schweres Flugzeug – gleiche Silhouette, deutlich grösser */
  heavy: {
    path: 'M16 1c1.1 0 1.9 1.3 2.1 3l.4 3.3v3.2l11.6 7.1c.6.4.9 1 .9 1.6v2.1l-12.3-3.9-.5 6.9 4 2.9v2.3L16 28.3l-6.2 1.2v-2.3l4-2.9-.5-6.9L1 21.3v-2.1c0-.6.3-1.2.9-1.6l11.6-7.1V7.3l.4-3.3c.2-1.7 1-3 2.1-3z',
    size: 38,
  },
  /** Propeller / General Aviation mit geraden Flügeln */
  prop: {
    path: 'M16 2c.9 0 1.5 1.1 1.6 2.5l.3 3h11.6c.6 0 1 .4 1 1v1.9c0 .6-.4 1-1 1H17.7l-.7 9.8 4.6 1.9v2L16 24.3l-5.6.8v-2l4.6-1.9-.7-9.8H2.5c-.6 0-1-.4-1-1V8.5c0-.6.4-1 1-1h11.6l.3-3C14.5 3.1 15.1 2 16 2z',
    size: 26,
  },
  /** Helikopter: Rotorblätter, Kabine, Heckausleger */
  heli: {
    path: 'M7.9 2.2l18 18-1.8 1.8-18-18zM24.1 2.2l1.8 1.8-18 18-1.8-1.8zM16 5.5c3.3 0 6 3 6 6.7s-2.7 6.7-6 6.7-6-3-6-6.7 2.7-6.7 6-6.7zM14.7 18.6h2.6l.6 8.1h3.6v2.4h-11v-2.4h3.6z',
    size: 28,
  },
  /** Segelflugzeug mit langen, schmalen Flügeln */
  glider: {
    path: 'M16 2c.6 0 1 .8 1.1 1.8l.2 2.7 13.2.9c.3 0 .5.3.5.6v1c0 .3-.2.6-.5.6l-13.3.9-.5 13.4 3.3.9v1.6L16 25.6l-4 .8v-1.6l3.3-.9-.5-13.4-13.3-.9c-.3 0-.5-.3-.5-.6v-1c0-.3.2-.6.5-.6l13.2-.9.2-2.7c.1-1 .5-1.8 1.1-1.8z',
    size: 30,
  },
  /** Ballon mit Korb */
  balloon: {
    path: 'M16 2c4.4 0 8 3.4 8 7.6 0 3.6-2.3 6.7-5.2 8.5l-.5 4.9h-4.6l-.5-4.9C10.3 16.3 8 13.2 8 9.6 8 5.4 11.6 2 16 2zM12.9 25h6.2l-.4 4.5h-5.4z',
    size: 24,
    rotates: false,
  },
  /** Drohne / Quadcopter */
  drone: {
    path: 'M8.7 7.3l16 16-1.4 1.4-16-16zM23.3 7.3l1.4 1.4-16 16-1.4-1.4zM13 13h6v6h-6zM4.8 8a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0zM20.8 8a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0zM4.8 24a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0zM20.8 24a3.2 3.2 0 1 0 6.4 0 3.2 3.2 0 1 0-6.4 0z',
    size: 24,
  },
};

/** ICAO-Typen (Präfixe), die als Widebody/Heavy dargestellt werden */
const HEAVY_TYPES = ['A33', 'A34', 'A35', 'A38', 'B74', 'B76', 'B77', 'B78', 'MD1', 'IL9'];

/** ICAO-Typen (Präfixe) von Helikoptern */
const HELI_TYPES = [
  'R22', 'R44', 'R66', 'EC', 'AS3', 'AS5', 'H47', 'H60', 'S76', 'S92',
  'B06', 'B407', 'B412', 'B429', 'A109', 'A119', 'A139', 'EH10', 'NH90',
];

/** ICAO-Typen (Präfixe) von Propeller-/GA-Flugzeugen */
const PROP_TYPES = [
  'AT4', 'AT7', 'DH8', 'DHC', 'PC6', 'PC12', 'PC21', 'P28', 'PA', 'SR2',
  'DA4', 'DA6', 'DV2', 'DR4', 'TBM', 'BE', 'C15', 'C17', 'C18', 'C20', 'C21', 'TB2',
];

/** ICAO-Typen (Präfixe) von Segelflugzeugen */
const GLIDER_TYPES = ['ASK', 'ASW', 'ASG', 'ASH', 'DG', 'LS', 'DUO', 'VENT', 'ARCU', 'JS'];

function matches(type: string, prefixes: string[]): boolean {
  return prefixes.some((p) => type.startsWith(p));
}

/**
 * Silhouette für ein Flugzeug bestimmen: primär über den ICAO-Typ
 * (aus adsbdb, falls schon geladen), sonst über die ADS-B Kategorie.
 */
export function shapeForAircraft(ac: Aircraft, icaoType?: string | null): PlaneShapeKey {
  const type = (icaoType ?? '').toUpperCase();
  if (type) {
    if (matches(type, HEAVY_TYPES)) return 'heavy';
    if (matches(type, HELI_TYPES)) return 'heli';
    if (matches(type, GLIDER_TYPES)) return 'glider';
    if (matches(type, PROP_TYPES)) return 'prop';
  }
  switch (ac.category) {
    case 'A1':
      return 'prop';
    case 'A5':
      return 'heavy';
    case 'A7':
      return 'heli';
    case 'B1':
    case 'B4':
      return 'glider';
    case 'B2':
      return 'balloon';
    case 'B6':
      return 'drone';
    default:
      return 'jet';
  }
}
