import { useCallback, useState } from 'react';
import { APIProvider, useApiIsLoaded } from '@vis.gl/react-google-maps';
import AddressSearch from './components/AddressSearch';
import MapView from './components/MapView';
import LayerControls from './components/LayerControls';
import MapLegend from './components/MapLegend';
import ReadoutPanel from './components/ReadoutPanel';
import { buildAddressPayload } from './utils/addressParser';
import { geocodeCensusTract } from './services/censusGeocoder';
import { fetchTractPolygon } from './services/tigerweb';
import { fetchFloodAttributes, fetchFloodPolygon } from './services/fema';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const INITIAL_SOURCES = {
  census: { status: 'idle' },
  tigerweb: { status: 'idle' },
  fema: { status: 'idle' },
};

const INITIAL_LAYERS = {
  showFemaTiles: false,
  showTractLayer: true,
  showFloodPolygonLayer: true,
};

function AppShell() {
  const mapsApiLoaded = useApiIsLoaded();
  const [address, setAddress] = useState(null);
  const [sources, setSources] = useState(INITIAL_SOURCES);
  const [layers, setLayers] = useState(INITIAL_LAYERS);

  const runTigerweb = useCallback(async (geoid) => {
    setSources((prev) => ({ ...prev, tigerweb: { status: 'loading' } }));
    try {
      const feature = await fetchTractPolygon(geoid);
      setSources((prev) => ({ ...prev, tigerweb: { status: 'success', feature } }));
    } catch (err) {
      setSources((prev) => ({ ...prev, tigerweb: { status: 'error', error: err.message } }));
    }
  }, []);

  const runFema = useCallback(async (point) => {
    setSources((prev) => ({ ...prev, fema: { status: 'loading' } }));
    try {
      const [attrResult, feature] = await Promise.all([
        fetchFloodAttributes(point),
        fetchFloodPolygon(point),
      ]);
      setSources((prev) => ({
        ...prev,
        fema: {
          status: 'success',
          hasFeature: attrResult.hasFeature,
          attributes: attrResult.attributes,
          feature,
        },
      }));
    } catch (err) {
      setSources((prev) => ({ ...prev, fema: { status: 'error', error: err.message } }));
    }
  }, []);

  const handlePlaceSelected = useCallback(
    async (place) => {
      const payload = buildAddressPayload(place);
      if (!payload) return;

      setAddress(payload);
      setSources({ census: { status: 'loading' }, tigerweb: { status: 'idle' }, fema: { status: 'idle' } });

      try {
        const result = await geocodeCensusTract(payload);

        if (!result.matched) {
          setSources((prev) => ({ ...prev, census: { status: 'unmatched' } }));
          return;
        }

        setSources((prev) => ({
          ...prev,
          census: {
            status: 'success',
            tract: result.tract,
            coordinates: result.coordinates,
            matchedAddress: result.matchedAddress,
          },
        }));

        // TIGERweb and FEMA are independent — a failure in one must never
        // block the other, so they run in parallel with isolated state.
        const point = { lat: result.coordinates.y, lng: result.coordinates.x };
        runTigerweb(result.tract?.GEOID);
        runFema(point);
      } catch (err) {
        setSources((prev) => ({ ...prev, census: { status: 'error', error: err.message } }));
      }
    },
    [runTigerweb, runFema]
  );

  const handleLayerToggle = useCallback((key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const markerPosition = address ? { lat: address.lat, lng: address.lng } : null;
  const tractGeoJson = sources.tigerweb.feature ?? null;
  const floodGeoJson = sources.fema.feature ?? null;

  return (
    <div className="app-shell">
      <MapView
        markerPosition={markerPosition}
        tractGeoJson={tractGeoJson}
        floodGeoJson={floodGeoJson}
        showTractLayer={layers.showTractLayer}
        showFloodPolygonLayer={layers.showFloodPolygonLayer}
        showFemaTiles={layers.showFemaTiles}
      />

      <div className="app-shell__top-bar">
        <div className="app-shell__brand">
          <span className="brand__mark">Land Master</span>
          <span className="brand__subtitle">Parcel &amp; flood reconnaissance</span>
        </div>
        <AddressSearch onPlaceSelected={handlePlaceSelected} status={sources.census.status} />
      </div>

      <div className="app-shell__layer-controls">
        <LayerControls layers={layers} onToggle={handleLayerToggle} />
        <MapLegend />
      </div>

      <ReadoutPanel
        address={address}
        sources={sources}
        mapsStatus={mapsApiLoaded ? 'success' : 'loading'}
      />
    </div>
  );
}

export default function App() {
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="config-error">
        <h1>Missing Google Maps API key</h1>
        <p>
          Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in a local <code>.env</code> file (see{' '}
          <code>.env.example</code>) and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <AppShell />
    </APIProvider>
  );
}
