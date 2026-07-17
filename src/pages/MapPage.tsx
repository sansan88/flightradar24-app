import React, { useEffect, useRef, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { airplaneOutline, rainy, warningOutline } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerSource from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?raw';
import type { Aircraft, TrackPoint } from '../types/aircraft';
import { callsignOf, formatSpeed, metersFromFeet } from '../types/aircraft';
import type { Enrichment, RouteAirport } from '../services/adsbdbService';
import AircraftDetailModal from '../components/AircraftDetailModal';
import type { Settings } from '../services/settings';
import { fetchLatestRadar, type RadarResult } from '../services/meteoRadarService';
import {
  mapStyle,
  resolveMapLayer,
  transformTileRequest,
  type MapLayerKey,
} from '../services/mapLayers';
import {
  PLANE_SHAPES,
  shapeForAircraft,
  type PlaneShapeKey,
} from '../services/planeIcons';
import { useApp } from '../state/AppContext';
import './MapPage.css';

// MapLibre baut seinen Worker standardmässig per toString() aus dem eigenen
// Bundle zusammen – nach dem Minifizieren durch Vite referenziert dieser Code
// umbenannte Variablen und stirbt («… is not defined»). Folge: GeoJSON-Sources
// (Track-Linie) funktionieren im Prod-Build/in der iOS-App nicht. Darum den
// unveränderten, vorgebauten CSP-Worker als Blob laden.
maplibregl.setWorkerUrl(
  URL.createObjectURL(new Blob([maplibreWorkerSource], { type: 'text/javascript' }))
);

/** Farbe nach barometrischer Höhe (Gelb = tief, Blau/Violett = hoch) */
function altitudeColor(alt?: number | 'ground'): string {
  if (alt === 'ground' || alt === undefined) return '#888888';
  const ratio = Math.min(Math.max(alt, 0), 40000) / 40000;
  const hue = 45 + ratio * 235; // 45 (gelb) → 280 (violett)
  return `hsl(${hue}, 85%, 45%)`;
}

/** Beschriftungszeilen am Icon gemäss Einstellungen zusammenstellen */
function markerLabelLines(
  ac: Aircraft,
  settings: Settings,
  enrichment?: Enrichment
): string[] {
  const values: Record<string, string | null> = {
    callsign: callsignOf(ac),
    registration: enrichment?.details?.registration ?? null,
    type: enrichment?.details?.icao_type ?? enrichment?.details?.type ?? null,
    route:
      enrichment?.route?.origin?.iata_code && enrichment?.route?.destination?.iata_code
        ? `${enrichment.route.origin.iata_code}→${enrichment.route.destination.iata_code}`
        : null,
    altitude:
      ac.alt_baro === 'ground'
        ? 'Boden'
        : ac.alt_baro != null
          ? `${metersFromFeet(ac.alt_baro).toLocaleString('de-CH')} m`
          : null,
    speed: ac.gs != null ? formatSpeed(ac.gs) : null,
    category: ac.category ?? null,
  };
  return settings.markerLineTags
    .map((keys) =>
      keys
        .map((key) => values[key])
        .filter(Boolean)
        .join(' · ')
    )
    .filter((line) => line.length > 0);
}

function planeElement(ac: Aircraft, lines: string[], shape: PlaneShapeKey): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'plane-marker';
  el.innerHTML = `<div class="plane-icon"></div><div class="plane-labels"></div>`;
  updatePlaneElement(el, ac, lines, shape);
  return el;
}

function updatePlaneElement(
  el: HTMLDivElement,
  ac: Aircraft,
  lines: string[],
  shape: PlaneShapeKey
): void {
  const icon = el.querySelector('.plane-icon') as HTMLDivElement;
  const def = PLANE_SHAPES[shape];

  // Silhouette (neu) aufbauen, wenn sich der Typ ändert – z. B. sobald
  // der ICAO-Typ von adsbdb nachgeladen wurde
  if (el.dataset.shape !== shape) {
    el.dataset.shape = shape;
    icon.innerHTML = `
      <svg viewBox="0 0 32 32" width="${def.size}" height="${def.size}">
        <path class="plane-fill" d="${def.path}" />
      </svg>`;
  }

  const svg = icon.querySelector('svg') as SVGElement;
  const path = icon.querySelector('.plane-fill') as SVGPathElement;
  const labels = el.querySelector('.plane-labels') as HTMLDivElement;
  svg.style.transform = def.rotates === false ? '' : `rotate(${ac.track ?? 0}deg)`;
  path.setAttribute('fill', altitudeColor(ac.alt_baro));
  const html = lines.map((line) => `<span class="plane-label">${line}</span>`).join('');
  if (labels.innerHTML !== html) labels.innerHTML = html;
}

/** ID von Source und Layer für die Track-Linie des ausgewählten Flugzeugs */
const TRACK_ID = 'selected-track';

/** ID von Source und Layer für die Routen-Linien (Abflug-/Zielflughafen) */
const ROUTE_ID = 'selected-route';

/** ID von Source und Layer für das Niederschlagsradar (MeteoSchweiz) */
const RADAR_ID = 'precipitation-radar';

/**
 * Das RZC-Radarbild wird alle 5 Minuten neu publiziert (mit ~4–5 Min
 * Verzug) — jede Minute nachschauen, ob ein neueres Frame verfügbar ist
 */
const RADAR_REFRESH_MS = 60 * 1000;

const EMPTY_TRACK: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Track als Segmente aufbereiten, jedes nach der Höhe am Segmentende gefärbt
 * (gleiche Farbskala wie die Flugzeug-Icons).
 */
function trackGeoJson(track: TrackPoint[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let i = 1; i < track.length; i++) {
    features.push({
      type: 'Feature',
      properties: { color: altitudeColor(track[i].alt) },
      geometry: {
        type: 'LineString',
        coordinates: [
          [track[i - 1].lon, track[i - 1].lat],
          [track[i].lon, track[i].lat],
        ],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * Grosskreis-Bogen zwischen zwei Punkten (Slerp auf der Kugel), damit auch
 * weit entfernte Flughäfen mit realistischer Flugbahn verbunden werden.
 */
function greatCircle(from: [number, number], to: [number, number]): [number, number][] {
  const rad = Math.PI / 180;
  const [lon1, lat1] = [from[0] * rad, from[1] * rad];
  const [lon2, lat2] = [to[0] * rad, to[1] * rad];

  const toVec = (lon: number, lat: number): [number, number, number] => [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
  const a = toVec(lon1, lat1);
  const b = toVec(lon2, lat2);
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const angle = Math.acos(dot);
  if (angle < 1e-6) return [from, to];

  const steps = Math.max(2, Math.ceil((angle / rad) * 2)); // ~1 Punkt pro 0.5°
  const coords: [number, number][] = [];
  let prevLon = from[0];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const f1 = Math.sin((1 - t) * angle) / Math.sin(angle);
    const f2 = Math.sin(t * angle) / Math.sin(angle);
    const x = f1 * a[0] + f2 * b[0];
    const y = f1 * a[1] + f2 * b[1];
    const z = f1 * a[2] + f2 * b[2];
    let lon = Math.atan2(y, x) / rad;
    const lat = Math.atan2(z, Math.hypot(x, y)) / rad;
    // Antimeridian: Sprünge von ±360° vermeiden, damit die Linie nicht
    // quer über die Karte läuft
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    coords.push([lon, lat]);
  }
  return coords;
}

/**
 * Gestrichelte Linien vom Abflughafen zum Anfang der aufgezeichneten
 * Track-Linie und vom Flugzeug zum Zielflughafen (sofern adsbdb
 * Koordinaten liefert). Die Abflug-Linie endet am ersten Track-Punkt —
 * ab dort übernimmt der farbige Routenverlauf.
 */
function routeGeoJson(
  plane: [number, number],
  trackStart: [number, number],
  origin?: RouteAirport,
  destination?: RouteAirport
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const leg = (airport: RouteAirport | undefined, kind: 'origin' | 'destination') => {
    if (airport?.latitude == null || airport?.longitude == null) return;
    const airportPos: [number, number] = [airport.longitude, airport.latitude];
    features.push({
      type: 'Feature',
      properties: { kind },
      geometry: {
        type: 'LineString',
        coordinates:
          kind === 'origin' ? greatCircle(airportPos, trackStart) : greatCircle(plane, airportPos),
      },
    });
  };
  leg(origin, 'origin');
  leg(destination, 'destination');
  return { type: 'FeatureCollection', features };
}

const MapPage: React.FC = () => {
  const {
    settings,
    filteredAircraft,
    enrichments,
    tracks,
    selectedHex,
    setSelectedHex,
    mapFocus,
    error,
    lastUpdate,
  } = useApp();
  const router = useIonRouter();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());
  const appliedLayerRef = useRef<MapLayerKey | null>(null);
  const [showRadar, setShowRadar] = useState(false);
  const [radar, setRadar] = useState<RadarResult | null>(null);
  const radarTimeRef = useRef<Date | undefined>(undefined);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    appliedLayerRef.current = resolveMapLayer(settings.mapLayer);
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle(settings.mapLayer),
      center: [8.6268, 47.6985], // Region Schaffhausen (s.geo.admin.ch/0nsm0qt6zo0v)
      zoom: 9.3,
      attributionControl: { compact: true },
      transformRequest: transformTileRequest,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }));
    mapRef.current = map;

    // Ionic rendert die Seite erst nach dem Mount fertig – Grösse nachziehen
    const resize = window.setTimeout(() => map.resize(), 300);
    return () => {
      window.clearTimeout(resize);
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Mount; Layer-Wechsel siehe unten
  }, []);

  // Karten-Hintergrund wechseln, wenn die Einstellung ändert (Marker sind
  // DOM-Elemente und überleben den Style-Wechsel). Bei «Automatisch» folgt
  // die Karte zusätzlich live dem Hell-/Dunkel-Wechsel des Geräts.
  useEffect(() => {
    const applyLayer = () => {
      const map = mapRef.current;
      if (!map) return;
      const resolved = resolveMapLayer(settings.mapLayer);
      if (appliedLayerRef.current === resolved) return;
      appliedLayerRef.current = resolved;
      map.setStyle(mapStyle(resolved));
    };

    applyLayer();
    if (settings.mapLayer !== 'auto') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyLayer);
    return () => media.removeEventListener('change', applyLayer);
  }, [settings.mapLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const ac of filteredAircraft) {
      if (ac.lat == null || ac.lon == null) continue;
      seen.add(ac.hex);

      const enrichment = enrichments[ac.hex];
      const lines = markerLabelLines(ac, settings, enrichment);
      const shape = shapeForAircraft(ac, enrichment?.details?.icao_type);
      const existing = markers.get(ac.hex);
      if (existing) {
        existing.setLngLat([ac.lon, ac.lat]);
        updatePlaneElement(existing.getElement() as HTMLDivElement, ac, lines, shape);
      } else {
        const hex = ac.hex;
        const element = planeElement(ac, lines, shape);
        // Klick auf den Flieger: Detail-Sheet öffnen und Track-Linie zeigen
        element.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedHex(hex);
        });
        const marker = new maplibregl.Marker({ element })
          .setLngLat([ac.lon, ac.lat])
          .addTo(map);
        markers.set(ac.hex, marker);
      }
    }

    // Marker entfernen, deren Flugzeug nicht mehr gemeldet wird
    for (const [hex, marker] of markers) {
      if (!seen.has(hex)) {
        marker.remove();
        markers.delete(hex);
      }
    }
  }, [filteredAircraft, enrichments, settings]);

  // Track-Linie des ausgewählten Flugzeugs zeichnen und bei jedem Poll
  // verlängern; nach einem Style-Wechsel werden Source/Layer neu angelegt
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const track = selectedHex ? (tracks[selectedHex] ?? []) : [];
      const data = track.length > 1 ? trackGeoJson(track) : EMPTY_TRACK;
      const source = map.getSource(TRACK_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource(TRACK_ID, { type: 'geojson', data });
        map.addLayer({
          id: TRACK_ID,
          type: 'line',
          source: TRACK_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3,
            'line-opacity': 0.9,
          },
        });
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      // Style lädt noch (Start oder Layer-Wechsel) – nachziehen, sobald bereit
      map.once('idle', apply);
      return () => {
        map.off('idle', apply);
      };
    }
  }, [selectedHex, filteredAircraft, tracks, settings.mapLayer]);

  // Gestrichelte Routen-Linien des ausgewählten Flugzeugs (Abflughafen →
  // Flugzeug → Zielflughafen) gemäss adsbdb-Koordinaten; wandern bei jedem
  // Poll mit der aktuellen Position mit
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const ac = selectedHex ? filteredAircraft.find((a) => a.hex === selectedHex) : undefined;
      const route = selectedHex ? enrichments[selectedHex]?.route : undefined;
      const track = selectedHex ? (tracks[selectedHex] ?? []) : [];
      let data = EMPTY_TRACK;
      if (ac?.lat != null && ac?.lon != null && route) {
        const plane: [number, number] = [ac.lon, ac.lat];
        // Abflug-Linie endet am ersten aufgezeichneten Track-Punkt statt
        // an der aktuellen Position, damit sie den Routenverlauf fortsetzt
        const trackStart: [number, number] = track.length
          ? [track[0].lon, track[0].lat]
          : plane;
        data = routeGeoJson(plane, trackStart, route.origin, route.destination);
      }
      const source = map.getSource(ROUTE_ID) as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData(data);
      } else {
        map.addSource(ROUTE_ID, { type: 'geojson', data });
        map.addLayer(
          {
            id: ROUTE_ID,
            type: 'line',
            source: ROUTE_ID,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              // Zurückgelegte Strecke (ab Abflughafen) gedeckter als die
              // verbleibende Strecke zum Ziel
              'line-color': [
                'match',
                ['get', 'kind'],
                'origin',
                '#8e9aaf',
                '#4c6ef5',
              ],
              'line-width': 2,
              'line-opacity': 0.85,
              'line-dasharray': [2, 3],
            },
          },
          // Unter der Track-Linie einordnen, damit diese lesbar bleibt
          map.getLayer(TRACK_ID) ? TRACK_ID : undefined
        );
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once('idle', apply);
      return () => {
        map.off('idle', apply);
      };
    }
  }, [selectedHex, filteredAircraft, enrichments, tracks, settings.mapLayer]);

  // Niederschlagsradar laden, solange die Wetterfunktion aktiv ist; danach
  // regelmässig prüfen, ob MeteoSchweiz ein neueres Frame publiziert hat
  useEffect(() => {
    if (!showRadar) {
      radarTimeRef.current = undefined;
      setRadar(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetchLatestRadar(radarTimeRef.current)
        .then((result) => {
          if (cancelled || !result) return;
          radarTimeRef.current = result.time;
          setRadar(result);
        })
        .catch((err) => console.warn('Niederschlagsradar konnte nicht geladen werden', err));
    };
    load();
    const interval = window.setInterval(load, RADAR_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [showRadar]);

  // Radar-Overlay auf der Karte nachführen; nach einem Style-Wechsel werden
  // Source/Layer neu angelegt. Liegt unter der Track-Linie und den Markern.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      const source = map.getSource(RADAR_ID) as maplibregl.GeoJSONSource | undefined;
      if (!radar) {
        if (map.getLayer(RADAR_ID)) map.removeLayer(RADAR_ID);
        if (source) map.removeSource(RADAR_ID);
        return;
      }
      if (source) {
        source.setData(radar.geojson);
      } else {
        map.addSource(RADAR_ID, { type: 'geojson', data: radar.geojson });
        map.addLayer(
          {
            id: RADAR_ID,
            type: 'fill',
            source: RADAR_ID,
            paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.55 },
          },
          map.getLayer(TRACK_ID) ? TRACK_ID : undefined
        );
      }
    };

    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once('idle', apply);
      return () => {
        map.off('idle', apply);
      };
    }
  }, [radar, settings.mapLayer]);

  // «Auf Karte anzeigen» aus der Liste: Karte auf das Flugzeug zentrieren
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapFocus) return;
    const pos = markersRef.current.get(mapFocus.hex)?.getLngLat();
    if (pos) {
      map.flyTo({ center: pos, zoom: Math.max(map.getZoom(), 9) });
    }
  }, [mapFocus]);

  // Karte neu dimensionieren, wenn der Tab wieder sichtbar wird
  useEffect(() => {
    const onVisible = () => mapRef.current?.resize();
    window.addEventListener('resize', onVisible);
    return () => window.removeEventListener('resize', onVisible);
  }, []);

  // Ausgewähltes Flugzeug live nachführen; verschwindet es aus dem Feed,
  // bleibt der letzte Stand im Sheet sichtbar
  const lastSelected = useRef<Aircraft | null>(null);
  const selected = selectedHex
    ? (filteredAircraft.find((ac) => ac.hex === selectedHex) ?? lastSelected.current)
    : null;
  if (selected) lastSelected.current = selected;

  const visibleCount = filteredAircraft.filter((ac) => ac.lat != null && ac.lon != null).length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton
              onClick={() => setShowRadar((value) => !value)}
              color={showRadar ? 'primary' : 'medium'}
              aria-label="Niederschlagsradar ein-/ausblenden"
            >
              <IonIcon slot="icon-only" icon={rainy} />
            </IonButton>
          </IonButtons>
          <IonTitle>SkyPi</IonTitle>
          {lastUpdate && (
            <IonNote slot="end" className="update-note">
              {new Date(lastUpdate).toLocaleTimeString('de-CH')}
            </IonNote>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={false}>
        <div className="map-container" ref={mapContainer} />
        <div className="map-overlay">
          <IonChip
            color={error ? 'danger' : 'primary'}
            onClick={error ? () => router.push('/settings') : undefined}
          >
            <IonIcon icon={error ? warningOutline : airplaneOutline} />
            <IonLabel>{error ? 'Keine Verbindung' : `${visibleCount} sichtbar`}</IonLabel>
          </IonChip>
          {showRadar && radar && (
            <IonChip color="medium">
              <IonIcon icon={rainy} />
              <IonLabel>
                {radar.time.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
              </IonLabel>
            </IonChip>
          )}
        </div>
        <AircraftDetailModal
          sheet
          aircraft={selected}
          enrichment={selected ? enrichments[selected.hex] : undefined}
          onDismiss={() => setSelectedHex(null)}
        />
      </IonContent>
    </IonPage>
  );
};

export default MapPage;
