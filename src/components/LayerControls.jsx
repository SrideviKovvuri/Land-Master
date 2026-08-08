const CONTROLS = [
  { key: 'showFemaTiles', label: 'FEMA flood tiles' },
  { key: 'showTractLayer', label: 'Selected Census tract' },
  { key: 'showFloodPolygonLayer', label: 'FEMA flood polygon' },
];

/** Independent toggles for each map layer. The property marker is always shown. */
export default function LayerControls({ layers, onToggle }) {
  return (
    <fieldset className="layer-controls">
      <legend className="layer-controls__title">Map layers</legend>
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
    </fieldset>
  );
}
