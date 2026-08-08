const LEGEND_ITEMS = [
  { color: '#2f6fb0', label: 'A / AE — high risk (SFHA)' },
  { color: '#a3324d', label: 'VE — coastal high-risk' },
  { color: '#8fae86', label: 'X — minimal risk' },
  { color: '#8a8f8a', label: 'Unknown / unmapped' },
];

export default function MapLegend() {
  return (
    <div className="map-legend" aria-label="Flood zone legend">
      <p className="map-legend__title">Flood zones</p>
      <ul className="map-legend__list">
        {LEGEND_ITEMS.map(({ color, label }) => (
          <li className="map-legend__item" key={label}>
            <span className="map-legend__swatch" style={{ backgroundColor: color }} aria-hidden="true" />
            <span>{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
