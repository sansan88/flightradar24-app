import { Preferences } from '@capacitor/preferences';

export interface Settings {
  /** IP-Adresse oder Hostname des Raspberry Pi im lokalen Netzwerk */
  ip: string;
  /** Port des Aircraft Service */
  port: number;
  /** Aktualisierungsintervall in Sekunden */
  refreshInterval: number;
  /** Gefilterte Kategorien (leer = alle anzeigen) */
  categories: string[];
  /** Attribute, die als Beschriftung am Flugzeug-Icon angezeigt werden */
  markerAttributes: string[];
  /** Maximale Anzahl Beschriftungszeilen am Flugzeug-Icon (0 = keine) */
  markerLines: number;
}

/** Verfügbare Attribute für die Beschriftung am Flugzeug-Icon */
export const MARKER_ATTRIBUTES: Record<string, string> = {
  callsign: 'Callsign',
  registration: 'Registration',
  type: 'Flugzeugtyp',
  route: 'Route (IATA)',
  altitude: 'Höhe (m)',
  speed: 'Geschwindigkeit (kt)',
  category: 'Kategorie',
};

export const DEFAULT_SETTINGS: Settings = {
  ip: '192.168.1.174',
  port: 8080,
  refreshInterval: 2,
  categories: [],
  markerAttributes: ['callsign'],
  markerLines: 1,
};

const STORAGE_KEY = 'flightradar-settings';

export async function loadSettings(): Promise<Settings> {
  try {
    const { value } = await Preferences.get({ key: STORAGE_KEY });
    if (value) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(value) };
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
