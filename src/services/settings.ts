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
}

export const DEFAULT_SETTINGS: Settings = {
  ip: '192.168.1.174',
  port: 8080,
  refreshInterval: 2,
  categories: [],
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
