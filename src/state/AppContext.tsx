import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Aircraft, TrackPoint } from '../types/aircraft';
import { categoryOf } from '../types/aircraft';
import { fetchAircraft } from '../services/aircraftService';
import { fetchDemoAircraft, resetDemo } from '../services/demoService';
import { clearAdsbdbCache, fetchEnrichment, type Enrichment } from '../services/adsbdbService';
import {
  clearStoredSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
} from '../services/settings';

interface AppState {
  settings: Settings;
  /** true, sobald die persistierten Einstellungen geladen sind */
  settingsReady: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  /** Alle Einstellungen auf Werkszustand zurücksetzen (inkl. Ersteinrichtung) */
  resetSettings: () => Promise<void>;
  /** Lokalen adsbdb-Cache (Flugzeug-/Routeninfos) leeren */
  clearEnrichmentCache: () => Promise<void>;
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
  /**
   * Aufgezeichnete Positions-Historie pro ICAO-Hex (seit App-Start).
   * Stabiles Objekt, wird bei jedem Poll in-place ergänzt – zusammen mit
   * `aircraft` lesen, nicht als eigenständige Render-Abhängigkeit verwenden.
   */
  tracks: Record<string, TrackPoint[]>;
  /** Auf der Karte ausgewähltes Flugzeug (Detail-Sheet + Track-Linie) */
  selectedHex: string | null;
  setSelectedHex: (hex: string | null) => void;
  /** Letzte «Auf Karte anzeigen»-Anforderung (ts unterscheidet Wiederholungen) */
  mapFocus: { hex: string; ts: number } | null;
  /** Flugzeug auswählen und die Karte darauf zentrieren */
  showOnMap: (hex: string) => void;
}

/** Maximale Punkte pro Flugzeug (~33 min bei 2 s Intervall) */
const MAX_TRACK_POINTS = 1000;
/** Historie verwerfen, wenn ein Flugzeug so lange nicht mehr gemeldet wurde */
const TRACK_RETENTION_MS = 10 * 60_000;

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState(0);
  const [enrichments, setEnrichments] = useState<Record<string, Enrichment>>({});
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<{ hex: string; ts: number } | null>(null);

  const showOnMap = useCallback((hex: string) => {
    setSelectedHex(hex);
    setMapFocus({ hex, ts: Date.now() });
  }, []);
  const pollInFlight = useRef(false);
  const enrichInFlight = useRef(false);
  const tracksRef = useRef<Record<string, TrackPoint[]>>({});

  /** Positionen des aktuellen Polls an die Historie anhängen */
  const recordTracks = useCallback((list: Aircraft[]) => {
    const tracks = tracksRef.current;
    const now = Date.now();
    for (const ac of list) {
      if (ac.lat == null || ac.lon == null) continue;
      const track = (tracks[ac.hex] ??= []);
      const last = track[track.length - 1];
      if (last && last.lon === ac.lon && last.lat === ac.lat) {
        last.t = now; // Position unverändert – nur als aktuell bestätigen
      } else {
        track.push({ lon: ac.lon, lat: ac.lat, alt: ac.alt_baro, t: now });
        if (track.length > MAX_TRACK_POINTS) track.shift();
      }
    }
    for (const [hex, track] of Object.entries(tracks)) {
      if (now - track[track.length - 1].t > TRACK_RETENTION_MS) {
        delete tracks[hex];
      }
    }
  }, []);

  /**
   * Route und Flugzeugdetails von adsbdb.com nachladen — pro Flugzeug in
   * einem kombinierten Request (Einzel-Calls nur als Fallback im Service).
   * Läuft sequenziell pro Flugzeug; Ergebnisse (inkl. 404-Misses) werden
   * im Service 24 h gecacht (persistent), sodass pro Flieger nur einmal
   * angefragt wird.
   */
  const enrich = useCallback(async (list: Aircraft[]) => {
    if (enrichInFlight.current) return;
    enrichInFlight.current = true;
    try {
      for (const ac of list) {
        const callsign = ac.flight?.trim();
        const { route, details } = await fetchEnrichment(ac.hex, callsign || undefined);
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
      // Demomodus endet, sobald in den Einstellungen ein Service verbunden
      // (IP/Port geändert) wird – ausser der Patch setzt demoMode explizit.
      if (
        prev.demoMode &&
        !('demoMode' in patch) &&
        (patch.ip !== undefined || patch.port !== undefined)
      ) {
        next.demoMode = false;
      }
      void saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(async () => {
    await clearStoredSettings();
    // setupCompleted: false → Welcome Screen (Ersteinrichtung) erscheint wieder
    setSettings({ ...DEFAULT_SETTINGS });
  }, []);

  const clearEnrichmentCache = useCallback(async () => {
    await clearAdsbdbCache();
    // Bereits angezeigte Zusatzinfos verwerfen; der nächste Poll lädt sie neu
    setEnrichments({});
  }, []);

  // Beim Wechsel in/aus dem Demomodus alte Flugzeuge und Tracks verwerfen,
  // damit keine Demo-Flieger neben echten Daten stehen bleiben (und umgekehrt).
  const prevDemoMode = useRef<boolean | null>(null);
  useEffect(() => {
    if (!settingsLoaded) return;
    if (prevDemoMode.current !== null && prevDemoMode.current !== settings.demoMode) {
      setAircraft([]);
      setMessages(0);
      setLastUpdate(null);
      setError(null);
      const tracks = tracksRef.current;
      for (const hex of Object.keys(tracks)) delete tracks[hex];
      resetDemo();
    }
    prevDemoMode.current = settings.demoMode;
  }, [settingsLoaded, settings.demoMode]);

  useEffect(() => {
    // Vor Abschluss der Ersteinrichtung (Welcome Screen) nicht pollen
    if (!settingsLoaded || !settings.setupCompleted) return;

    let cancelled = false;

    const poll = async () => {
      if (pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        const data = settings.demoMode
          ? fetchDemoAircraft()
          : await fetchAircraft(settings);
        if (cancelled) return;
        setAircraft(data.aircraft ?? []);
        recordTracks(data.aircraft ?? []);
        setMessages(data.messages ?? 0);
        setLastUpdate(Date.now());
        setError(null);
        // Demo-Flieger nicht bei adsbdb.com anfragen (fiktive Kennungen)
        if (!settings.demoMode) void enrich(data.aircraft ?? []);
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
  }, [settingsLoaded, settings, enrich, recordTracks]);

  const filteredAircraft =
    settings.categories.length === 0
      ? aircraft
      : aircraft.filter((ac) => settings.categories.includes(categoryOf(ac)));

  return (
    <AppContext.Provider
      value={{
        settings,
        settingsReady: settingsLoaded,
        updateSettings,
        resetSettings,
        clearEnrichmentCache,
        aircraft,
        filteredAircraft,
        lastUpdate,
        error,
        messages,
        enrichments,
        tracks: tracksRef.current,
        selectedHex,
        setSelectedHex,
        mapFocus,
        showOnMap,
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
