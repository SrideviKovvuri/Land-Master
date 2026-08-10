const CONTROLS = [
  { key: 'showFemaTiles', label: 'FEMA flood tiles' },
  { key: 'showTractLayer', label: 'Selected Census tract' },
  { key: 'showFloodPolygonLayer', label: 'FEMA flood polygon' },
];

/**
 * Independent toggles for each map layer, in a collapsible <details> panel
 * so it can be minimized on small screens instead of crowding the map.
 * The property marker is always shown regardless of these toggles.
 */
export default function LayerControls({ layers, onToggle }) {
  return (
    <details className="layer-controls" open>
      <summary className="layer-controls__title">Map layers</summary>
      <div className="layer-controls__body">
        {CONTROLS.map(({ key, label }) => (
          <label className="layer-controls__item" key={key}>
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => onToggle(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </details>
  );
}
