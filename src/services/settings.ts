import { Preferences } from '@capacitor/preferences';
import type { MapLayerKey } from './mapLayers';

export interface Settings {
  /** Karten-Hintergrund (Basemap) */
  mapLayer: MapLayerKey;
  /** IP-Adresse oder Hostname des Raspberry Pi im lokalen Netzwerk */
  ip: string;
  /** Port des Aircraft Service */
  port: number;
  /** Aktualisierungsintervall in Sekunden */
  refreshInterval: number;
  /** Gefilterte Kategorien (leer = alle anzeigen) */
  categories: string[];
  /**
   * Beschriftung am Flugzeug-Icon: pro Zeile (Index 0–2) die Attribut-Keys
   * aus MARKER_ATTRIBUTES, die auf dieser Zeile angezeigt werden
   * (leer = Zeile ausblenden).
   */
  markerLineTags: string[][];
}

/** Verfügbare Attribute für die Beschriftung am Flugzeug-Icon */
export const MARKER_ATTRIBUTES: Record<string, string> = {
  callsign: 'Callsign',
  registration: 'Registration',
  type: 'Flugzeugtyp',
  route: 'Route (IATA)',
  altitude: 'Höhe (m ü. M.)',
  speed: 'Geschwindigkeit (km/h)',
  category: 'Kategorie',
};

/** Anzahl konfigurierbarer Beschriftungszeilen am Icon */
export const MARKER_LINE_COUNT = 3;

export const DEFAULT_SETTINGS: Settings = {
  mapLayer: 'auto',
  ip: '192.168.1.174',
  port: 8080,
  refreshInterval: 2,
  categories: [],
  markerLineTags: [['callsign'], [], []],
};

const STORAGE_KEY = 'flightradar-settings';

export async function loadSettings(): Promise<Settings> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (value) {
      const stored = JSON.parse(value) as Partial<Settings> & {
        markerAttributes?: string[];
        markerLines?: number;
        markerLineTags?: unknown[];
      };
      // Migration älterer Formate: Attribut-Liste + Zeilenanzahl bzw.
      // ein Attribut-Key (oder 'none') pro Zeile
      let lineTags: string[][] | undefined;
      if (Array.isArray(stored.markerLineTags)) {
        lineTags = stored.markerLineTags.map((entry) =>
          Array.isArray(entry)
            ? entry.filter((k): k is string => typeof k === 'string' && k !== 'none')
            : typeof entry === 'string' && entry !== 'none'
              ? [entry]
              : []
        );
      } else if (Array.isArray(stored.markerAttributes)) {
        const count = Math.min(stored.markerLines ?? 1, MARKER_LINE_COUNT);
        lineTags = Array.from({ length: MARKER_LINE_COUNT }, (_, i) => {
          const key = i < count ? stored.markerAttributes?.[i] : undefined;
          return key ? [key] : [];
        });
      }
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        markerLineTags: lineTags ?? DEFAULT_SETTINGS.markerLineTags,
      };
    }
  } catch (err) {
    console.warn('Einstellungen konnten nicht geladen werden', err);
  }
  return { ...DEFAULT_SETTINGS };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(settings) });
}

export function aircraftUrl(settings: Settings): string {
  return `http://${settings.ip}:${settings.port}/data/aircraft.json`;
}
