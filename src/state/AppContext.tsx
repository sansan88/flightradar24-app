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
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState(0);
  const pollInFlight = useRef(false);

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
  }, [settingsLoaded, settings]);

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
