import { jsonp } from './jsonp';

const CENSUS_GEOCODER_URL =
  'https://geocoding.geo.census.gov/geocoder/geographies/address';

// The Census Geocoder does not return Access-Control-Allow-Origin headers,
// so it cannot be called with fetch() from a browser on a different origin.
// JSONP is the only way to call it directly from a static, backend-less SPA.
const BENCHMARK = 'Public_AR_Current';
const VINTAGE = 'Current_Current';
const LAYERS = 'Census Tracts';

/**
 * Look up the Census tract for a parsed street address using the Census
 * Bureau Geocoder, via JSONP (no proxy, no backend).
 *
 * @param {{ street: string, city: string, state: string, zip: string }} address
 * @returns {Promise<{
 *   matched: boolean,
 *   coordinates: { x: number, y: number } | null,
 *   matchedAddress: string | null,
 *   tract: { GEOID: string, STATE: string, COUNTY: string, TRACT: string, NAME: string, BASENAME: string } | null,
 * }>}
 */
export async function geocodeCensusTract({ street, city, state, zip }) {
  const params = new URLSearchParams({
    street: street || '',
    city: city || '',
    state: state || '',
    zip: zip || '',
    benchmark: BENCHMARK,
    vintage: VINTAGE,
    layers: LAYERS,
    format: 'jsonp',
  });

  const url = `${CENSUS_GEOCODER_URL}?${params.toString()}`;
  const data = await jsonp(url);

  const matches = data?.result?.addressMatches;
  if (!matches || matches.length === 0) {
    return { matched: false, coordinates: null, matchedAddress: null, tract: null };
  }

  const match = matches[0];
  const coordinates = match.coordinates
    ? { x: match.coordinates.x, y: match.coordinates.y }
    : null;

  const tractGeography = match.geographies?.['Census Tracts']?.[0] ?? null;
  const tract = tractGeography
    ? {
        GEOID: tractGeography.GEOID,
        STATE: tractGeography.STATE,
        COUNTY: tractGeography.COUNTY,
        TRACT: tractGeography.TRACT,
        NAME: tractGeography.NAME,
        BASENAME: tractGeography.BASENAME,
      }
    : null;

  return {
    matched: true,
    coordinates,
    matchedAddress: match.matchedAddress ?? null,
    tract,
  };
}
