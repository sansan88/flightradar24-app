import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/** Routeninformation von api.adsbdb.com */
export interface RouteAirport {
  iata_code?: string;
  icao_code?: string;
  name?: string;
  municipality?: string;
  country_name?: string;
  country_iso_name?: string;
  elevation?: number;
  latitude?: number;
  longitude?: number;
}

export interface FlightRoute {
  callsign?: string;
  callsign_icao?: string;
  callsign_iata?: string;
  airline?: {
    name?: string;
    icao?: string;
    iata?: string;
    country?: string;
    country_iso?: string;
    callsign?: string;
  };
  origin?: RouteAirport;
  destination?: RouteAirport;
}

/** Flugzeugdetails von api.adsbdb.com */
export interface AircraftDetails {
  type?: string;
  icao_type?: string;
  manufacturer?: string;
  mode_s?: string;
  registration?: string;
  registered_owner?: string;
  registered_owner_country_name?: string;
  registered_owner_country_iso_name?: string;
  registered_owner_operator_flag_code?: string | null;
  url_photo?: string | null;
  url_photo_thumbnail?: string | null;
}

/** ISO-3166-Ländercode (z. B. "CH") → Flaggen-Emoji 🇨🇭 */
export function flagEmoji(iso?: string): string | null {
  if (!iso || !/^[A-Za-z]{2}$/.test(iso)) return null;
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden

type CacheEntry<V> = { value: V; timestamp: number };

/** LRU-Cache mit TTL (wie im flightradar24 Python-Script) */
class LRUCache<V> {
  private cache = new Map<string, CacheEntry<V>>();

  constructor(
    private maxSize = MAX_CACHE_SIZE,
    private ttlMs = CACHE_TTL_MS
  ) {}

  get(key: string): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    // Ans Ende verschieben (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.delete(key);
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  entries(): [string, CacheEntry<V>][] {
    return [...this.cache];
  }

  /** Persistierte Einträge übernehmen (abgelaufene werden verworfen) */
  restore(entries: [string, CacheEntry<V>][]): void {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (
        entry &&
        typeof entry.timestamp === 'number' &&
        now - entry.timestamp <= this.ttlMs
      ) {
        this.cache.set(key, entry);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// {} wird auch für unbekannte Callsigns/Hex-Codes gecacht (404-Miss),
// damit nicht bei jedem Poll erneut angefragt wird
const routeCache = new LRUCache<FlightRoute>();
const detailsCache = new LRUCache<AircraftDetails>();
const inflight = new Map<string, Promise<unknown>>();

// --- Persistenz: Cache überlebt App-Neustarts (24-h-TTL gilt weiterhin) ---

const CACHE_STORAGE_KEY = 'adsbdb-cache';
const CACHE_SAVE_DEBOUNCE_MS = 2000;

let cacheLoaded: Promise<void> | null = null;
let saveTimer: number | undefined;

function ensureCacheLoaded(): Promise<void> {
  cacheLoaded ??= (async () => {
    try {
      const { value } = await Preferences.get({ key: CACHE_STORAGE_KEY });
      if (!value) return;
      const stored = JSON.parse(value) as {
        routes?: [string, CacheEntry<FlightRoute>][];
        details?: [string, CacheEntry<AircraftDetails>][];
      };
      if (Array.isArray(stored.routes)) routeCache.restore(stored.routes);
      if (Array.isArray(stored.details)) detailsCache.restore(stored.details);
    } catch (err) {
      console.warn('adsbdb-Cache konnte nicht geladen werden', err);
    }
  })();
  return cacheLoaded;
}

/** Cache verzögert wegschreiben (sammelt Ergebnisse eines Poll-Zyklus) */
function persistCache(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void Preferences.set({
      key: CACHE_STORAGE_KEY,
      value: JSON.stringify({
        routes: routeCache.entries(),
        details: detailsCache.entries(),
      }),
    }).catch((err) => console.warn('adsbdb-Cache konnte nicht gespeichert werden', err));
  }, CACHE_SAVE_DEBOUNCE_MS);
}

/** Lokalen adsbdb-Cache (Speicher + Persistenz) vollständig leeren */
export async function clearAdsbdbCache(): Promise<void> {
  window.clearTimeout(saveTimer);
  routeCache.clear();
  detailsCache.clear();
  await Preferences.remove({ key: CACHE_STORAGE_KEY });
}

/** GET, der 404 als "bekannt unbekannt" (leeres Objekt) zurückgibt */
async function getJson(url: string): Promise<unknown | null> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      connectTimeout: 10000,
      readTimeout: 10000,
    });
    if (response.status === 404) return {};
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (response.status === 404) return {};
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Route (Abflug/Ziel) zu einem Callsign abfragen.
 * Leeres Objekt = adsbdb kennt den Callsign nicht (z. B. Militär/Privat).
 * null = Anfrage fehlgeschlagen (wird beim nächsten Poll erneut versucht).
 */
export async function fetchFlightRoute(callsign: string): Promise<FlightRoute | null> {
  await ensureCacheLoaded();
  const cached = routeCache.get(callsign);
  if (cached !== undefined) return cached;

  const key = `route:${callsign}`;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<FlightRoute | null>;

  const promise = (async (): Promise<FlightRoute | null> => {
    try {
      const json = (await getJson(
        `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`
      )) as { response?: unknown } | null;
      // adsbdb liefert bei Unbekanntem den String "unknown callsign" statt eines Objekts
      const payload = json?.response;
      const route =
        payload && typeof payload === 'object'
          ? ((payload as { flightroute?: FlightRoute }).flightroute ?? {})
          : {};
      routeCache.set(callsign, route);
      persistCache();
      return route;
    } catch (err) {
      console.warn(`Route für ${callsign} konnte nicht geladen werden`, err);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

// Spezialfall wie im flightradar24-Script: HB-IFA fehlt in adsbdb
const KNOWN_AIRCRAFT: Record<string, AircraftDetails> = {
  '4b15a2': {
    type: 'A350-941',
    icao_type: 'A359',
    manufacturer: 'Airbus',
    registration: 'HB-IFA',
    registered_owner: 'Swiss International Air Lines',
    registered_owner_country_name: 'Switzerland',
    registered_owner_country_iso_name: 'CH',
  },
};

/**
 * Flugzeugdetails (Typ, Hersteller, Betreiber) zu einem ICAO-Hex abfragen.
 */
export async function fetchAircraftDetails(hex: string): Promise<AircraftDetails | null> {
  const hexLower = hex.toLowerCase();

  const known = KNOWN_AIRCRAFT[hexLower];
  if (known) return known;

  await ensureCacheLoaded();
  const cached = detailsCache.get(hexLower);
  if (cached !== undefined) return cached;

  const key = `ac:${hexLower}`;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<AircraftDetails | null>;

  const promise = (async (): Promise<AircraftDetails | null> => {
    try {
      const json = (await getJson(
        `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(hexLower)}`
      )) as { response?: unknown } | null;
      const payload = json?.response;
      const details =
        payload && typeof payload === 'object'
          ? ((payload as { aircraft?: AircraftDetails }).aircraft ?? {})
          : {};
      detailsCache.set(hexLower, details);
      persistCache();
      return details;
    } catch (err) {
      console.warn(`Flugzeugdetails für ${hex} konnten nicht geladen werden`, err);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

/**
 * Kombi-Call: Flugzeugdetails und Route in einem Request
 * (`/v0/aircraft/<hex>?callsign=<callsign>`).
 * - `details` {} = adsbdb kennt das Flugzeug nicht (404).
 * - `route` undefined = keine Route in der Antwort (Callsign unbekannt).
 * - null = Anfrage fehlgeschlagen (Netzwerkfehler o. Ä.).
 */
async function fetchCombined(
  hexLower: string,
  callsign: string
): Promise<{ details: AircraftDetails; route?: FlightRoute } | null> {
  const key = `combi:${hexLower}:${callsign}`;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<{ details: AircraftDetails; route?: FlightRoute } | null>;

  const promise = (async () => {
    try {
      const json = (await getJson(
        `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(
          hexLower
        )}?callsign=${encodeURIComponent(callsign)}`
      )) as { response?: unknown } | null;
      const payload = json?.response;
      if (payload && typeof payload === 'object') {
        const p = payload as { aircraft?: AircraftDetails; flightroute?: FlightRoute };
        return { details: p.aircraft ?? {}, route: p.flightroute };
      }
      // 404 «unknown aircraft»: Flugzeug nicht in adsbdb — die Route kann
      // trotzdem existieren und wird vom Aufrufer einzeln nachgefragt
      return { details: {} as AircraftDetails, route: undefined };
    } catch (err) {
      console.warn(`Kombi-Abfrage für ${hexLower}/${callsign} fehlgeschlagen`, err);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, promise);
  return promise;
}

/**
 * Route und Flugzeugdetails zu einem Flugzeug abfragen — bevorzugt in einem
 * kombinierten Request. Einzel-Calls nur als Fallback, wenn der Kombi-Call
 * fehlschlägt oder keine Route liefert (bzw. wenn kein Callsign vorliegt).
 * Fehlende Felder im Ergebnis = aktuell nicht verfügbar (nächster Poll
 * versucht es erneut); {} = adsbdb kennt den Eintrag definitiv nicht.
 */
export async function fetchEnrichment(
  hex: string,
  callsign?: string
): Promise<Enrichment> {
  const hexLower = hex.toLowerCase();
  await ensureCacheLoaded();

  // undefined = noch nie (erfolgreich) angefragt
  let details: AircraftDetails | null | undefined =
    KNOWN_AIRCRAFT[hexLower] ?? detailsCache.get(hexLower);
  let route: FlightRoute | null | undefined = callsign
    ? routeCache.get(callsign)
    : null;

  if (details === undefined && callsign && route === undefined) {
    const combined = await fetchCombined(hexLower, callsign);
    if (combined) {
      details = combined.details;
      detailsCache.set(hexLower, details);
      if (combined.route) {
        route = combined.route;
        routeCache.set(callsign, route);
      }
      persistCache();
    }
    // combined === null (Fehler): unten per Einzel-Calls erneut versuchen
  }

  if (details === undefined) details = await fetchAircraftDetails(hex);
  if (route === undefined && callsign) route = await fetchFlightRoute(callsign);

  return { details: details ?? undefined, route: route ?? undefined };
}

/** Kombinierte Zusatzinfos für ein Flugzeug */
export interface Enrichment {
  route?: FlightRoute;
  details?: AircraftDetails;
}

export function formatRoute(route?: FlightRoute): string | null {
  if (!route?.origin && !route?.destination) return null;
  const part = (a?: RouteAirport) =>
    a ? [a.iata_code, a.municipality ?? a.name].filter(Boolean).join(' ') : '?';
  return `${part(route.origin)} → ${part(route.destination)}`;
}

export function formatAircraftDetails(details?: AircraftDetails): string | null {
  if (!details) return null;
  const type = [details.manufacturer, details.type].filter(Boolean).join(' ');
  return [type, details.registered_owner].filter(Boolean).join(' · ') || null;
}
