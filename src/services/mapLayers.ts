import type { RequestParameters, StyleSpecification } from 'maplibre-gl';
import { Capacitor } from '@capacitor/core';
import { version } from '../../package.json';

/** Verfügbare Karten-Hintergründe */
export type MapLayerKey =
  | 'auto'
  | 'swisstopo-color'
  | 'swisstopo-grey'
  | 'swisstopo-satellite'
  | 'osm';

/** Anzeigenamen für die Einstellungen */
export const MAP_LAYERS: Record<MapLayerKey, string> = {
  auto: 'Automatisch (hell/dunkel)',
  'swisstopo-color': 'Swisstopo Landeskarte farbig',
  'swisstopo-grey': 'Swisstopo Landeskarte grau',
  'swisstopo-satellite': 'Swisstopo Luftbild',
  osm: 'OpenStreetMap',
};

/**
 * 'auto' anhand des Geräte-Themes auflösen (Landeskarte farbig hell,
 * Landeskarte grau dunkel), alle anderen Layer unverändert zurückgeben.
 */
export function resolveMapLayer(key: MapLayerKey): Exclude<MapLayerKey, 'auto'> {
  if (key !== 'auto') return key;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'swisstopo-grey'
    : 'swisstopo-color';
}

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/**
 * OSM Tile Usage Policy: Apps müssen sich mit eindeutigem, stabilem
 * User-Agent ausweisen. In der nativen App laufen die Kachel-Requests über
 * CapacitorHttp (URLSession), das explizite Header durchreicht — im Browser
 * ist der User-Agent-Header nicht setzbar (dort zählt der Referer).
 */
const APP_USER_AGENT = `SkyPi/${version} (+https://github.com/sansan88/flightradar24-app)`;

/** transformRequest für MapLibre: OSM-Kacheln in der nativen App kennzeichnen */
export function transformTileRequest(url: string): RequestParameters | undefined {
  if (Capacitor.isNativePlatform() && url.includes('tile.openstreetmap.org')) {
    return { url, headers: { 'User-Agent': APP_USER_AGENT } };
  }
  return undefined;
}
const SWISSTOPO_ATTRIBUTION =
  '© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>';

function rasterStyle(
  tiles: string[],
  attribution: string,
  maxzoom: number
): StyleSpecification {
  return {
    version: 8,
    sources: {
      base: { type: 'raster', tiles, tileSize: 256, maxzoom, attribution },
    },
    layers: [{ id: 'base', type: 'raster', source: 'base' }],
  };
}

function swisstopoTiles(layer: string, format: string): string[] {
  return [
    `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/{z}/{x}/{y}.${format}`,
  ];
}

/** MapLibre-Style für den gewählten Karten-Hintergrund */
export function mapStyle(key: MapLayerKey): StyleSpecification {
  switch (resolveMapLayer(key)) {
    case 'swisstopo-color':
      return rasterStyle(
        swisstopoTiles('ch.swisstopo.pixelkarte-farbe', 'jpeg'),
        SWISSTOPO_ATTRIBUTION,
        18
      );
    case 'swisstopo-grey':
      return rasterStyle(
        swisstopoTiles('ch.swisstopo.pixelkarte-grau', 'jpeg'),
        SWISSTOPO_ATTRIBUTION,
        18
      );
    case 'swisstopo-satellite':
      return rasterStyle(
        swisstopoTiles('ch.swisstopo.swissimage', 'jpeg'),
        SWISSTOPO_ATTRIBUTION,
        19
      );
    case 'osm':
      return rasterStyle(
        ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        OSM_ATTRIBUTION,
        19
      );
  }
}
