// Parses a Google Places `address_components` array into the discrete
// fields the Census Geocoder's address endpoint expects.
const COMPONENT_TYPES = {
  STREET_NUMBER: 'street_number',
  ROUTE: 'route',
  LOCALITY: 'locality',
  // Some places (independent cities, unincorporated areas) don't carry
  // `locality`; fall back to these in order.
  SUBLOCALITY: 'sublocality',
  ADMIN_AREA_3: 'administrative_area_level_3',
  STATE: 'administrative_area_level_1',
  ZIP: 'postal_code',
};

function findComponent(components, type) {
  return components.find((component) => component.types.includes(type));
}

/**
 * Extract street / city / state / zip from a Google Places address_components array.
 *
 * @param {Array<{ long_name: string, short_name: string, types: string[] }>} addressComponents
 * @returns {{ street: string, city: string, state: string, zip: string }}
 */
export function parseAddressComponents(addressComponents = []) {
  const streetNumber = findComponent(addressComponents, COMPONENT_TYPES.STREET_NUMBER);
  const route = findComponent(addressComponents, COMPONENT_TYPES.ROUTE);
  const locality =
    findComponent(addressComponents, COMPONENT_TYPES.LOCALITY) ||
    findComponent(addressComponents, COMPONENT_TYPES.SUBLOCALITY) ||
    findComponent(addressComponents, COMPONENT_TYPES.ADMIN_AREA_3);
  const state = findComponent(addressComponents, COMPONENT_TYPES.STATE);
  const zip = findComponent(addressComponents, COMPONENT_TYPES.ZIP);

  const street = [streetNumber?.long_name, route?.long_name].filter(Boolean).join(' ');

  return {
    street,
    city: locality?.long_name ?? '',
    state: state?.short_name ?? '',
    zip: zip?.long_name ?? '',
  };
}

/**
 * Build the full parsed-address payload used to drive the Census/FEMA/TIGERweb
 * lookup pipeline from a selected Google Places result.
 *
 * @param {google.maps.places.PlaceResult} place
 * @returns {{
 *   street: string, city: string, state: string, zip: string,
 *   formattedAddress: string, lat: number, lng: number
 * } | null}
 */
export function buildAddressPayload(place) {
  if (!place?.geometry?.location) return null;

  const { street, city, state, zip } = parseAddressComponents(place.address_components);

  return {
    street,
    city,
    state,
    zip,
    formattedAddress: place.formatted_address ?? '',
    lat: place.geometry.location.lat(),
    lng: place.geometry.location.lng(),
  };
}
