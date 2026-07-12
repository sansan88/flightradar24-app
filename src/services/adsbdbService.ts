import { Capacitor, CapacitorHttp } from '@capacitor/core';

/** Routeninformation von api.adsbdb.com */
export interface RouteAirport {
  iata_code?: string;
  icao_code?: string;
  name?: string;
  municipality?: string;
  country_name?: string;
}

export interface FlightRoute {
  callsign?: string;
  airline?: { name?: string; icao?: string; iata?: string };
  origin?: RouteAirport;
  destination?: RouteAirport;
}

/** Flugzeugdetails von api.adsbdb.com */
export interface AircraftDetails {
  type?: string;
  icao_type?: string;
  manufacturer?: string;
  registration?: string;
  registered_owner?: string;
  registered_owner_country_name?: string;
}

const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden

/** LRU-Cache mit TTL (wie im flightradar24 Python-Script) */
class LRUCache<V> {
  private cache = new Map<string, { value: V; timestamp: number }>();

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
}

// {} wird auch für unbekannte Callsigns/Hex-Codes gecacht (404-Miss),
// damit nicht bei jedem Poll erneut angefragt wird
const routeCache = new LRUCache<FlightRoute>();
const detailsCache = new LRUCache<AircraftDetails>();
const inflight = new Map<string, Promise<unknown>>();

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

/**
 * Flugzeugdetails (Typ, Hersteller, Betreiber) zu einem ICAO-Hex abfragen.
 */
export async function fetchAircraftDetails(hex: string): Promise<AircraftDetails | null> {
  const hexLower = hex.toLowerCase();

  // Spezialfall wie im flightradar24-Script: HB-IFA fehlt in adsbdb
  if (hexLower === '4b15a2') {
    return {
      type: 'A350-941',
      icao_type: 'A359',
      manufacturer: 'Airbus',
      registration: 'HB-IFA',
      registered_owner: 'Swiss International Air Lines',
    };
  }

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
