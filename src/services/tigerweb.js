// TIGERweb (Census Bureau ArcGIS REST service) supports CORS, so this
// service uses a normal browser fetch() — no JSONP or proxy needed.
const TIGERWEB_TRACTS_URL =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/8/query';

/**
 * Fetch the Census tract boundary polygon for a given GEOID as GeoJSON.
 *
 * @param {string} geoid - 11-digit Census tract GEOID (state+county+tract).
 * @returns {Promise<object|null>} A GeoJSON Feature for the tract, or null if not found.
 */
export async function fetchTractPolygon(geoid) {
  if (!geoid) return null;

  const params = new URLSearchParams({
    where: `GEOID='${geoid}'`,
    outFields: '*',
    returnGeometry: 'true',
    f: 'geojson',
  });

  const response = await fetch(`${TIGERWEB_TRACTS_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`TIGERweb request failed with status ${response.status}`);
  }

  const geojson = await response.json();
  const feature = geojson?.features?.[0];
  return feature ?? null;
}
