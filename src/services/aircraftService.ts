import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { AircraftResponse } from '../types/aircraft';
import { aircraftUrl, type Settings } from './settings';

/**
 * Ruft aircraft.json vom Raspberry Pi ab.
 * Nativ (iOS) läuft der Request über CapacitorHttp und umgeht damit
 * CORS- und Mixed-Content-Einschränkungen des WebViews.
 */
export async function fetchAircraft(settings: Settings): Promise<AircraftResponse> {
  const url = aircraftUrl(settings);

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      connectTimeout: 5000,
      readTimeout: 5000,
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }
    return typeof response.data === 'string'
      ? (JSON.parse(response.data) as AircraftResponse)
      : (response.data as AircraftResponse);
  }

  // Im Browser-Dev-Modus über den Vite-Dev-Proxy gehen (der Pi sendet keine
  // CORS-Header); das Ziel wird per `pi`-Parameter aus den Settings gesetzt
  const webUrl = import.meta.env.DEV
    ? `/data/aircraft.json?pi=${encodeURIComponent(`${settings.ip}:${settings.port}`)}`
    : url;
  const response = await fetch(webUrl, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as AircraftResponse;
}
