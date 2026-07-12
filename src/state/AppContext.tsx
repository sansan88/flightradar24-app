import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Aircraft } from '../types/aircraft';
import { categoryOf } from '../types/aircraft';
import { fetchAircraft } from '../services/aircraftService';
import {
  fetchAircraftDetails,
  fetchFlightRoute,
  type Enrichment,
} from '../services/adsbdbService';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../services/settings';

interface AppState {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Alle empfangenen Flugzeuge (ungefiltert) */
  aircraft: Aircraft[];
  /** Nach Kategorie gefilterte Flugzeuge */
  filteredAircraft: Aircraft[];
  /** Zeitstempel des letzten erfolgreichen Abrufs */
  lastUpdate: number | null;
  /** Fehlermeldung des letzten Abrufs, null wenn ok */
  error: string | null;
  /** Anzahl empfangener Mode-S Messages laut Service */
  messages: number;
  /** Zusatzinfos (Route, Flugzeugtyp) pro ICAO-Hex von adsbdb.com */
  enrichments: Record<string, Enrichment>;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState(0);
  const [enrichments, setEnrichments] = useState<Record<string, Enrichment>>({});
  const pollInFlight = useRef(false);
  const enrichInFlight = useRef(false);

  /**
   * Route und Flugzeugdetails von adsbdb.com nachladen.
   * Läuft sequenziell pro Flugzeug; Ergebnisse (inkl. 404-Misses) werden
   * im Service 24 h gecacht, sodass pro Flieger nur einmal angefragt wird.
   */
  const enrich = useCallback(async (list: Aircraft[]) => {
    if (enrichInFlight.current) return;
    enrichInFlight.current = true;
    try {
      for (const ac of list) {
        const callsign = ac.flight?.trim();
        const [route, details] = await Promise.all([
          callsign ? fetchFlightRoute(callsign) : Promise.resolve(null),
          fetchAircraftDetails(ac.hex),
        ]);
        if (route || details) {
          setEnrichments((prev) => {
            const existing = prev[ac.hex];
            const next: Enrichment = {
              route: route ?? existing?.route,
              details: details ?? existing?.details,
            };
            if (
              existing &&
              existing.route === next.route &&
              existing.details === next.details
            ) {
              return prev;
            }
            return { ...prev, [ac.hex]: next };
          });
        }
      }
    } finally {
      enrichInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      setSettingsLoaded(true);
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    let cancelled = false;

    const poll = async () => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        const data = await fetchAircraft(settings);
        if (cancelled) return;
        setAircraft(data.aircraft ?? []);
        setMessages(data.messages ?? 0);
        setLastUpdate(Date.now());
        setError(null);
        void enrich(data.aircraft ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        pollInFlight.current = false;
      }
    };

    void poll();
    const intervalMs = Math.max(1, settings.refreshInterval) * 1000;
    const timer = window.setInterval(poll, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [settingsLoaded, settings, enrich]);

  const filteredAircraft =
    settings.categories.length === 0
      ? aircraft
      : aircraft.filter((ac) => settings.categories.includes(categoryOf(ac)));

  return (
    <AppContext.Provider
      value={{
        settings,
        updateSettings,
        aircraft,
        filteredAircraft,
        lastUpdate,
        error,
        messages,
        enrichments,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp muss innerhalb von <AppProvider> verwendet werden');
  }
  return ctx;
}
