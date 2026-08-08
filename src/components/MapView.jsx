import { useEffect, useRef } from 'react';
import { Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { getFemaTileUrl, getFloodZoneColor } from '../services/fema';

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 }; // Continental US centroid
const DEFAULT_ZOOM = 4;
const SELECTED_ZOOM = 16;

/** Renders the Census tract boundary via google.maps.Data with survey-style outline. */
function TractLayer({ geojson, visible }) {
  const map = useMap();
  const dataRef = useRef(null);

  useEffect(() => {
    if (!map) return undefined;
    const data = new window.google.maps.Data({ map: null });
    data.setStyle({
      fillColor: '#3f6b4a',
      fillOpacity: 0.1,
      strokeColor: '#3f6b4a',
      strokeWeight: 2,
      strokeOpacity: 0.9,
      clickable: false,
    });
    dataRef.current = data;
    return () => {
      data.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    const data = dataRef.current;
    if (!data) return;
    data.forEach((feature) => data.remove(feature));
    if (geojson) {
      data.addGeoJson(geojson);
    }
  }, [geojson]);

  useEffect(() => {
    const data = dataRef.current;
    if (!data) return;
    data.setMap(visible ? map : null);
  }, [visible, map]);

  return null;
}

/** Renders the FEMA flood-zone polygon at the selected point, colored by zone. */
function FloodPolygonLayer({ geojson, visible }) {
  const map = useMap();
  const dataRef = useRef(null);

  useEffect(() => {
    if (!map) return undefined;
    const data = new window.google.maps.Data({ map: null });
    data.setStyle((feature) => {
      const zone = feature.getProperty('FLD_ZONE');
      const color = getFloodZoneColor(zone);
      return {
        fillColor: color,
        fillOpacity: 0.35,
        strokeColor: color,
        strokeWeight: 2,
        clickable: false,
      };
    });
    dataRef.current = data;
    return () => {
      data.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    const data = dataRef.current;
    if (!data) return;
    data.forEach((feature) => data.remove(feature));
    if (geojson) {
      data.addGeoJson(geojson);
    }
  }, [geojson]);

  useEffect(() => {
    const data = dataRef.current;
    if (!data) return;
    data.setMap(visible ? map : null);
  }, [visible, map]);

  return null;
}

/** Optional broad FEMA flood-zone tile overlay via google.maps.ImageMapType. */
function FemaTileLayer({ visible }) {
  const map = useMap();
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!map) return undefined;
    const imageMapType = new window.google.maps.ImageMapType({
      getTileUrl: getFemaTileUrl,
      tileSize: new window.google.maps.Size(256, 256),
      opacity: 0.55,
      name: 'FEMA Flood Zones',
      maxZoom: 20,
      minZoom: 0,
    });
    overlayRef.current = imageMapType;
    return () => {
      const idx = map.overlayMapTypes.getArray().indexOf(imageMapType);
      if (idx !== -1) map.overlayMapTypes.removeAt(idx);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !overlayRef.current) return;
    const overlays = map.overlayMapTypes;
    const idx = overlays.getArray().indexOf(overlayRef.current);
    if (visible && idx === -1) {
      overlays.push(overlayRef.current);
    } else if (!visible && idx !== -1) {
      overlays.removeAt(idx);
    }
  }, [visible, map]);

  return null;
}

export default function MapView({
  markerPosition,
  tractGeoJson,
  floodGeoJson,
  showTractLayer,
  showFloodPolygonLayer,
  showFemaTiles,
}) {
  const center = markerPosition ?? DEFAULT_CENTER;
  const zoom = markerPosition ? SELECTED_ZOOM : DEFAULT_ZOOM;

  return (
    <Map
      className="map-view"
      defaultCenter={DEFAULT_CENTER}
      defaultZoom={DEFAULT_ZOOM}
      center={markerPosition ? center : undefined}
      zoom={markerPosition ? zoom : undefined}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      clickableIcons={false}
    >
      <FemaTileLayer visible={showFemaTiles} />
      <TractLayer geojson={tractGeoJson} visible={showTractLayer} />
      <FloodPolygonLayer geojson={floodGeoJson} visible={showFloodPolygonLayer} />
      {markerPosition && (
        <Marker position={markerPosition} title="Selected property" />
      )}
    </Map>
  );
}
