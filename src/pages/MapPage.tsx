import React, { useEffect, useRef } from 'react';
import {
  IonBadge,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { wifiOutline, airplaneOutline, warningOutline } from 'ionicons/icons';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Aircraft } from '../types/aircraft';
import { callsignOf, formatAltitude } from '../types/aircraft';
import {
  formatAircraftDetails,
  formatRoute,
  type Enrichment,
} from '../services/adsbdbService';
import { useApp } from '../state/AppContext';
import './MapPage.css';

/** Swisstopo Landeskarte (WMTS, Web Mercator) */
const SWISSTOPO_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    swisstopo: {
      type: 'raster',
      tiles: [
        'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg',
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: '© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>',
    },
  },
  layers: [{ id: 'swisstopo', type: 'raster', source: 'swisstopo' }],
};

/** Farbe nach barometrischer Höhe (Gelb = tief, Blau/Violett = hoch) */
function altitudeColor(alt?: number | 'ground'): string {
  if (alt === 'ground' || alt === undefined) return '#888888';
  const ratio = Math.min(Math.max(alt, 0), 40000) / 40000;
  const hue = 45 + ratio * 235; // 45 (gelb) → 280 (violett)
  return `hsl(${hue}, 85%, 45%)`;
}

const PLANE_SVG_PATH =
  'M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z';

function planeElement(ac: Aircraft): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'plane-marker';
  el.innerHTML = `
    <svg viewBox="0 0 24 24" width="30" height="30">
      <path d="${PLANE_SVG_PATH}" stroke="white" stroke-width="0.8" />
    </svg>
    <span class="plane-label"></span>`;
  updatePlaneElement(el, ac);
  return el;
}

function updatePlaneElement(el: HTMLDivElement, ac: Aircraft): void {
  const svg = el.querySelector('svg') as SVGElement;
  const path = el.querySelector('path') as SVGPathElement;
  const label = el.querySelector('.plane-label') as HTMLSpanElement;
  svg.style.transform = `rotate(${ac.track ?? 0}deg)`;
  path.setAttribute('fill', altitudeColor(ac.alt_baro));
  label.textContent = callsignOf(ac);
}

function popupHtml(ac: Aircraft, enrichment?: Enrichment): string {
  const route = formatRoute(enrichment?.route);
  const aircraftInfo = formatAircraftDetails(enrichment?.details);
  const header = [
    aircraftInfo && `<div class="popup-aircraft">${aircraftInfo}</div>`,
    route && `<div class="popup-route">${route}</div>`,
  ]
    .filter(Boolean)
    .join('');

  const rows: [string, string][] = [
    ['Callsign', callsignOf(ac)],
    ['Registration', enrichment?.details?.registration ?? '–'],
    ['ICAO Hex', ac.hex.toUpperCase()],
    ['Kategorie', ac.category ?? '–'],
    ['Höhe', formatAltitude(ac.alt_baro)],
    ['Geschwindigkeit', ac.gs != null ? `${Math.round(ac.gs)} kt` : '–'],
    ['Kurs', ac.track != null ? `${Math.round(ac.track)}°` : '–'],
    ['Steig-/Sinkrate', ac.baro_rate != null ? `${ac.baro_rate} ft/min` : '–'],
    ['Squawk', ac.squawk ?? '–'],
    ['Signal', ac.rssi != null ? `${ac.rssi} dBFS` : '–'],
  ];
  return `<div class="plane-popup">${header}${rows
    .map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`)
    .join('')}</div>`;
}

const MapPage: React.FC = () => {
  const { settings, filteredAircraft, enrichments, error, lastUpdate } = useApp();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef(new Map<string, maplibregl.Marker>());

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: SWISSTOPO_STYLE,
      center: [8.4, 47.1], // Schweiz
      zoom: 7,
      attributionControl: { compact: true },
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
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = markersRef.current;
    const seen = new Set<string>();

    for (const ac of filteredAircraft) {
      if (ac.lat == null || ac.lon == null) continue;
      seen.add(ac.hex);

      const enrichment = enrichments[ac.hex];
      const existing = markers.get(ac.hex);
      if (existing) {
        existing.setLngLat([ac.lon, ac.lat]);
        updatePlaneElement(existing.getElement() as HTMLDivElement, ac);
        existing.getPopup()?.setHTML(popupHtml(ac, enrichment));
      } else {
        const marker = new maplibregl.Marker({ element: planeElement(ac) })
          .setLngLat([ac.lon, ac.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 18, closeButton: false }).setHTML(
              popupHtml(ac, enrichment)
            )
          )
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
  }, [filteredAircraft, enrichments]);

  // Karte neu dimensionieren, wenn der Tab wieder sichtbar wird
  useEffect(() => {
    const onVisible = () => mapRef.current?.resize();
    window.addEventListener('resize', onVisible);
    return () => window.removeEventListener('resize', onVisible);
  }, []);

  const visibleCount = filteredAircraft.filter((ac) => ac.lat != null && ac.lon != null).length;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>FlightRadar</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent scrollY={false}>
        <div className="map-container" ref={mapContainer} />
        <div className="map-overlay">
          <IonChip color={error ? 'danger' : 'success'}>
            <IonIcon icon={error ? warningOutline : wifiOutline} />
            <IonLabel>{settings.ip}:{settings.port}</IonLabel>
          </IonChip>
          <IonChip color="primary">
            <IonIcon icon={airplaneOutline} />
            <IonLabel>
              {visibleCount} sichtbar
              <IonBadge color="light" className="total-badge">
                {filteredAircraft.length} total
              </IonBadge>
            </IonLabel>
          </IonChip>
          {error && (
            <IonChip color="danger">
              <IonLabel>Keine Verbindung: {error}</IonLabel>
            </IonChip>
          )}
          {!error && lastUpdate && (
            <IonChip color="medium">
              <IonLabel>
                Aktualisiert {new Date(lastUpdate).toLocaleTimeString('de-CH')}
              </IonLabel>
            </IonChip>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default MapPage;
