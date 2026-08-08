import { useEffect, useRef } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';

/**
 * A plain <input> wired to the Google Places Autocomplete widget.
 *
 * The full Census/FEMA/TIGERweb lookup pipeline is only triggered when the
 * user picks a suggestion (the `place_changed` event) — not on arbitrary
 * text entry — per the required data flow.
 */
export default function AddressSearch({ onPlaceSelected, status }) {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const placesLibrary = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLibrary || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new placesLibrary.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: 'us' },
      fields: ['formatted_address', 'address_components', 'geometry'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place?.geometry) {
        // User pressed Enter without picking a suggestion — ignore.
        return;
      }
      onPlaceSelected(place);
    });

    autocompleteRef.current = autocomplete;
  }, [placesLibrary, onPlaceSelected]);

  return (
    <div className="address-search" role="search">
      <label className="address-search__label" htmlFor="address-search-input">
        Property address
      </label>
      <input
        id="address-search-input"
        ref={inputRef}
        type="text"
        className="address-search__input"
        placeholder="Enter a U.S. property address…"
        autoComplete="off"
        aria-describedby="address-search-status"
      />
      <span id="address-search-status" className="visually-hidden" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
