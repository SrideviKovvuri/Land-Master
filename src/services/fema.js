// FEMA National Flood Hazard Layer (NFHL) — Layer 28: Flood Hazard Zones.
// All requests are GET. Point geometry is always { x: longitude, y: latitude }.
//
// Primary source: hazards.fema.gov's own ArcGIS Server (fetch, then a
// JSONP fallback via the same reusable helper used for the Census
// Geocoder, using ArcGIS's built-in `callback` mechanism).
//
// Fallback source: FEMA also republishes the NFHL data as hosted feature
// services on ArcGIS Online (services*.arcgis.com). That's cloud SaaS
// infrastructure that supports CORS by default, unlike hazards.fema.gov's
// on-prem server — so when the primary source is unreachable from the
// browser, querying these mirrors directly via fetch() still keeps the
// app entirely proxy-free.
import { jsonp } from './jsonp';

const FEMA_NFHL_LAYER28_URL =
  'https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query';

// FEMA-published NFHL mirrors hosted on ArcGIS Online. Tried in order if
// hazards.fema.gov is unreachable from the browser.
const ARCGIS_ONLINE_FEATURE_SERVERS = [
  'https://services5.arcgis.com/ul2HkPnjmlM1iEE4/ArcGIS/rest/services/FEMA_Flood_Hazard/FeatureServer',
  'https://services.arcgis.com/2gdL2gxYNFY2TOUb/arcgis/rest/services/FEMA_National_Flood_Hazard_Layer/FeatureServer',
];
const FLOOD_ZONE_LAYER_NAME_PATTERN = /flood.*hazard.*zone/i;

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
 * Query hazards.fema.gov for raw Esri JSON, trying fetch() first and
 * falling back to JSONP. Throws (with both failure reasons) if both fail.
 */
async function queryHazardsFema(extraParams) {
  const params = new URLSearchParams({ ...extraParams, f: 'json' });
  const url = `${FEMA_NFHL_LAYER28_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`request failed with status ${response.status}`);
    }
    return await response.json();
  } catch (fetchError) {
    try {
      return await jsonp(url);
    } catch (jsonpError) {
      throw new Error(
        `hazards.fema.gov fetch() failed: ${fetchError.message}; JSONP fallback also failed: ${jsonpError.message}`
      );
    }
  }
}

const floodZoneLayerIdCache = new Map();

/** Finds (and caches) the "Flood Hazard Zones" layer ID within an ArcGIS Online FeatureServer. */
async function discoverFloodZoneLayerId(featureServerUrl) {
  if (floodZoneLayerIdCache.has(featureServerUrl)) {
    return floodZoneLayerIdCache.get(featureServerUrl);
  }
  const response = await fetch(`${featureServerUrl}?f=json`);
  if (!response.ok) {
    throw new Error(`layer discovery failed with status ${response.status}`);
  }
  const meta = await response.json();
  const layers = meta.layers ?? [];
  const match = layers.find((layer) => FLOOD_ZONE_LAYER_NAME_PATTERN.test(layer.name ?? ''));
  const layerId = match ? match.id : layers[0]?.id;
  if (layerId == null) {
    throw new Error('no layers found in FeatureServer');
  }
  floodZoneLayerIdCache.set(featureServerUrl, layerId);
  return layerId;
}

/**
 * Queries the FEMA-published ArcGIS Online NFHL mirrors in order via
 * fetch() (CORS-friendly cloud infrastructure). Throws if all fail.
 */
async function queryArcgisOnline(lat, lng, { returnGeometry, format }) {
  let lastError;
  for (const featureServerUrl of ARCGIS_ONLINE_FEATURE_SERVERS) {
    try {
      const layerId = await discoverFloodZoneLayerId(featureServerUrl);
      const params = new URLSearchParams({
        geometry: buildGeometryParam(lat, lng),
        geometryType: 'esriGeometryPoint',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: '*',
        returnGeometry: String(returnGeometry),
        f: format,
      });
      const response = await fetch(`${featureServerUrl}/${layerId}/query?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('no ArcGIS Online NFHL mirrors configured');
}

/**
 * Query FEMA NFHL Layer 28 for flood-zone attributes at a point.
 * returnGeometry=false — attributes only.
 *
 * @param {{ lat: number, lng: number }} point
 * @returns {Promise<{ hasFeature: boolean, attributes: object|null }>}
 */
export async function fetchFloodAttributes({ lat, lng }) {
  let data;
  try {
    data = await queryHazardsFema({ ...buildBaseParams(lat, lng), returnGeometry: 'false' });
  } catch (primaryError) {
    try {
      data = await queryArcgisOnline(lat, lng, { returnGeometry: false, format: 'json' });
    } catch (fallbackError) {
      throw new Error(
        `Primary FEMA source failed: ${primaryError.message}; ArcGIS Online fallback also failed: ${fallbackError.message}`
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
  // hazards.fema.gov: try native GeoJSON via fetch first.
  try {
    const params = new URLSearchParams({
      ...buildBaseParams(lat, lng),
      returnGeometry: 'true',
      f: 'geojson',
    });
    const response = await fetch(`${FEMA_NFHL_LAYER28_URL}?${params.toString()}`, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`request failed with status ${response.status}`);
    }
    const geojson = await response.json();
    return geojson?.features?.[0] ?? null;
  } catch (fetchError) {
    // JSONP only supports Esri JSON (f=json), so request that format via
    // the callback mechanism and convert rings to GeoJSON ourselves.
    try {
      const data = await queryHazardsFema({ ...buildBaseParams(lat, lng), returnGeometry: 'true' });
      const feature = data?.features?.[0];
      if (!feature) return null;
      const geometry = esriRingsToGeoJsonGeometry(feature.geometry?.rings);
      if (!geometry) return null;
      return { type: 'Feature', geometry, properties: feature.attributes ?? {} };
    } catch (jsonpError) {
      // Both hazards.fema.gov paths failed — fall back to the ArcGIS
      // Online mirrors, which return proper GeoJSON directly via fetch.
      try {
        const geojson = await queryArcgisOnline(lat, lng, { returnGeometry: true, format: 'geojson' });
        return geojson?.features?.[0] ?? null;
      } catch (fallbackError) {
        throw new Error(
          `Primary FEMA source failed: ${fetchError.message} / ${jsonpError.message}; ArcGIS Online fallback also failed: ${fallbackError.message}`
        );
      }
    }
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
