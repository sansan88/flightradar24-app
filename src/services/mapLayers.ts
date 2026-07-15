import type { StyleSpecification } from 'maplibre-gl';

/** Verfügbare Karten-Hintergründe */
export type MapLayerKey =
  | 'auto'
  | 'carto-light'
  | 'carto-dark'
  | 'swisstopo-color'
  | 'swisstopo-grey'
  | 'swisstopo-satellite'
  | 'osm';

/** Anzeigenamen für die Einstellungen */
export const MAP_LAYERS: Record<MapLayerKey, string> = {
  auto: 'Automatisch (hell/dunkel)',
  'carto-light': 'Hell – dezent (Carto)',
  'carto-dark': 'Dunkel (Carto)',
  'swisstopo-grey': 'Swisstopo Landeskarte grau',
  'swisstopo-color': 'Swisstopo Landeskarte farbig',
  'swisstopo-satellite': 'Swisstopo Luftbild',
  osm: 'OpenStreetMap',
};

/**
 * 'auto' anhand des Geräte-Themes auflösen (Carto hell/dunkel),
 * alle anderen Layer unverändert zurückgeben.
 */
export function resolveMapLayer(key: MapLayerKey): Exclude<MapLayerKey, 'auto'> {
  if (key !== 'auto') return key;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'carto-dark'
    : 'carto-light';
}

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
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

function cartoTiles(style: string): string[] {
  return ['a', 'b', 'c', 'd'].map(
    (s) => `https://${s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}.png`
  );
}

/** MapLibre-Style für den gewählten Karten-Hintergrund */
export function mapStyle(key: MapLayerKey): StyleSpecification {
  switch (resolveMapLayer(key)) {
    case 'carto-light':
      return rasterStyle(
        cartoTiles('light_all'),
        `${OSM_ATTRIBUTION} © <a href="https://carto.com/attributions">CARTO</a>`,
        20
      );
    case 'carto-dark':
      return rasterStyle(
        cartoTiles('dark_all'),
        `${OSM_ATTRIBUTION} © <a href="https://carto.com/attributions">CARTO</a>`,
        20
      );
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
