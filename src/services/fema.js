// FEMA National Flood Hazard Layer (NFHL) — Layer 28: Flood Hazard Zones.
// All requests are GET. Point geometry is always { x: longitude, y: latitude }.
//
// FEMA's ArcGIS endpoint generally supports CORS for GET requests, so the
// primary path uses fetch(). As a resilience fallback (in case a particular
// deployment of the service ever lacks CORS headers), the same reusable
// JSONP helper used for the Census Geocoder can be used against ArcGIS's
// built-in `callback` parameter — this keeps the app proxy-free either way.
import { jsonp } from './jsonp';

const FEMA_NFHL_LAYER28_URL =
  'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query';

const FLOOD_ATTRIBUTE_FIELDS = [
  'FLD_ZONE',
  'ZONE_SUBTY',
  'SFHA_TF',
  'STATIC_BFE',
  'DEPTH',
  'V_DATUM',
];

function buildGeometryParam(lat, lng) {
  return JSON.stringify({
    x: lng,
    y: lat,
    spatialReference: { wkid: 4326 },
  });
}

function buildBaseParams(lat, lng) {
  return {
    geometry: buildGeometryParam(lat, lng),
    geometryType: 'esriGeometryPoint',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: FLOOD_ATTRIBUTE_FIELDS.join(','),
  };
}

/** Converts an Esri JSON polygon geometry (rings) into a GeoJSON Polygon/MultiPolygon. */
function esriRingsToGeoJsonGeometry(rings) {
  if (!rings || rings.length === 0) return null;
  if (rings.length === 1) {
    return { type: 'Polygon', coordinates: rings };
  }
  return { type: 'MultiPolygon', coordinates: rings.map((ring) => [ring]) };
}

/**
 * Query FEMA NFHL Layer 28 for flood-zone attributes at a point.
 * returnGeometry=false — attributes only.
 *
 * @param {{ lat: number, lng: number }} point
 * @returns {Promise<{ hasFeature: boolean, attributes: object|null }>}
 */
export async function fetchFloodAttributes({ lat, lng }) {
  const params = new URLSearchParams({
    ...buildBaseParams(lat, lng),
    returnGeometry: 'false',
    f: 'json',
  });
  const url = `${FEMA_NFHL_LAYER28_URL}?${params.toString()}`;

  let data;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`FEMA attribute request failed with status ${response.status}`);
    }
    data = await response.json();
  } catch (fetchError) {
    // CORS or network fallback via JSONP against the same ArcGIS endpoint.
    try {
      data = await jsonp(url);
    } catch (jsonpError) {
      throw new Error(
        `fetch() failed: ${fetchError.message}; JSONP fallback also failed: ${jsonpError.message}`
      );
    }
  }

  const feature = data?.features?.[0];
  if (!feature) {
    return { hasFeature: false, attributes: null };
  }
  return { hasFeature: true, attributes: feature.attributes };
}

/**
 * Query FEMA NFHL Layer 28 for the flood-zone polygon at a point.
 * returnGeometry=true — polygon geometry as GeoJSON.
 *
 * @param {{ lat: number, lng: number }} point
 * @returns {Promise<object|null>} A GeoJSON Feature, or null if no flood polygon covers the point.
 */
export async function fetchFloodPolygon({ lat, lng }) {
  const params = new URLSearchParams({
    ...buildBaseParams(lat, lng),
    returnGeometry: 'true',
    f: 'geojson',
  });
  const url = `${FEMA_NFHL_LAYER28_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`FEMA geometry request failed with status ${response.status}`);
    }
    const geojson = await response.json();
    return geojson?.features?.[0] ?? null;
  } catch (fetchError) {
    // Fallback: JSONP only supports f=json (Esri JSON), so request that
    // format via the callback mechanism and convert rings to GeoJSON.
    const jsonParams = new URLSearchParams({
      ...buildBaseParams(lat, lng),
      returnGeometry: 'true',
      f: 'json',
    });
    const jsonUrl = `${FEMA_NFHL_LAYER28_URL}?${jsonParams.toString()}`;

    let data;
    try {
      data = await jsonp(jsonUrl);
    } catch (jsonpError) {
      throw new Error(
        `fetch() failed: ${fetchError.message}; JSONP fallback also failed: ${jsonpError.message}`
      );
    }

    const feature = data?.features?.[0];
    if (!feature) return null;

    const geometry = esriRingsToGeoJsonGeometry(feature.geometry?.rings);
    if (!geometry) return null;

    return {
      type: 'Feature',
      geometry,
      properties: feature.attributes ?? {},
    };
  }
}

/** Maps a FEMA FLD_ZONE code to a fill/stroke color for map rendering and the legend. */
export function getFloodZoneColor(zone) {
  if (!zone) return '#8a8f8a'; // unknown/neutral
  const z = zone.toUpperCase();
  if (z.startsWith('VE') || z === 'V') return '#a3324d'; // coastal high-risk
  if (z.startsWith('AE') || z.startsWith('A')) return '#2f6fb0'; // high-risk (SFHA)
  if (z.startsWith('X')) return '#8fae86'; // minimal risk
  return '#8a8f8a'; // unknown/neutral
}

/** Human-readable label for the legend. */
export function getFloodZoneLabel(zone) {
  if (!zone) return 'Unknown';
  const z = zone.toUpperCase();
  if (z.startsWith('VE') || z === 'V') return 'Coastal high-risk (VE)';
  if (z.startsWith('AE') || z.startsWith('A')) return 'High-risk (A/AE)';
  if (z.startsWith('X')) return 'Minimal risk (X)';
  return `Zone ${zone}`;
}

const FEMA_EXPORT_URL = 'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/export';
const WEB_MERCATOR_RADIUS = 6378137;
const TILE_SIZE = 256;

/** Converts a Google Maps XYZ tile coordinate to a Web Mercator (EPSG:3857) bounding box. */
function tileToWebMercatorBBox({ x, y }, zoom) {
  const initialResolution = (2 * Math.PI * WEB_MERCATOR_RADIUS) / TILE_SIZE;
  const originShift = (2 * Math.PI * WEB_MERCATOR_RADIUS) / 2;
  const resolution = initialResolution / Math.pow(2, zoom);

  const minX = x * TILE_SIZE * resolution - originShift;
  const maxX = (x + 1) * TILE_SIZE * resolution - originShift;
  const maxY = originShift - y * TILE_SIZE * resolution;
  const minY = originShift - (y + 1) * TILE_SIZE * resolution;

  return [minX, minY, maxX, maxY];
}

/**
 * Build a FEMA NFHL MapServer "export" image URL for one map tile.
 * Used with google.maps.ImageMapType as the optional broad FEMA flood tile
 * overlay. Image tiles are loaded as <img> requests, so no CORS headers
 * are required from the server.
 */
export function getFemaTileUrl({ x, y }, zoom) {
  const [minX, minY, maxX, maxY] = tileToWebMercatorBBox({ x, y }, zoom);
  const params = new URLSearchParams({
    bbox: `${minX},${minY},${maxX},${maxY}`,
    bboxSR: '3857',
    imageSR: '3857',
    size: `${TILE_SIZE},${TILE_SIZE}`,
    format: 'png32',
    transparent: 'true',
    layers: 'show:28',
    f: 'image',
  });
  return `${FEMA_EXPORT_URL}?${params.toString()}`;
}
