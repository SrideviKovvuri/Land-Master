import { useState } from 'react';

const STATUS_LABELS = {
  idle: 'Idle',
  loading: 'Loading…',
  success: 'Complete',
  error: 'Error',
  unmatched: "Couldn't match",
};

function SourceStatus({ label, state }) {
  const status = state?.status ?? 'idle';
  return (
    <li className={`source-status source-status--${status}`}>
      <span className="source-status__label">{label}</span>
      <span className="source-status__value">{STATUS_LABELS[status] ?? status}</span>
    </li>
  );
}

function FloodStatusChip({ fema }) {
  if (fema.status === 'error') {
    return <span className="status-chip status-chip--error">Flood data unavailable</span>;
  }
  if (fema.status !== 'success') return null;

  const inSfha = fema.hasFeature && (fema.attributes?.SFHA_TF === 'T' || fema.attributes?.SFHA_TF === 'Y');
  return inSfha ? (
    <span className="status-chip status-chip--warning">In SFHA</span>
  ) : (
    <span className="status-chip status-chip--ok">Outside mapped SFHA</span>
  );
}

function DataRow({ label, value }) {
  return (
    <div className="data-row">
      <span className="data-row__label">{label}</span>
      <span className="data-row__value mono">{value ?? '—'}</span>
    </div>
  );
}

export default function ReadoutPanel({ address, sources, mapsStatus }) {
  const [collapsed, setCollapsed] = useState(false);
  const { census, tigerweb, fema } = sources;
  const attrs = fema.attributes ?? {};

  return (
    <section
      className={`readout-panel${collapsed ? ' readout-panel--collapsed' : ''}`}
      aria-label="Property readout"
    >
      <header className="readout-panel__header">
        <h2 className="readout-panel__title">Readout</h2>
        <button
          type="button"
          className="readout-panel__toggle"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-expanded={!collapsed}
          aria-controls="readout-panel-body"
        >
          {collapsed ? 'Expand' : 'Minimize'}
        </button>
      </header>

      <div id="readout-panel-body" hidden={collapsed}>
        <ul className="source-status-list" aria-label="Data source status">
          <SourceStatus label="Google Maps" state={{ status: mapsStatus }} />
          <SourceStatus label="Census" state={census} />
          <SourceStatus label="TIGERweb" state={tigerweb} />
          <SourceStatus label="FEMA" state={fema} />
        </ul>

        {!address && (
          <p className="readout-panel__empty">
            Search and select a U.S. property address to see its Census tract and FEMA flood details.
          </p>
        )}

        {address && (
          <div className="readout-panel__sections">
            <section className="readout-section">
              <h3 className="readout-section__title">Property</h3>
              <DataRow label="Address" value={address.formattedAddress} />
              <DataRow label="Latitude" value={address.lat?.toFixed(6)} />
              <DataRow label="Longitude" value={address.lng?.toFixed(6)} />
            </section>

            <section className="readout-section">
              <div className="readout-section__title-row">
                <h3 className="readout-section__title">Flood</h3>
                <FloodStatusChip fema={fema} />
              </div>
              {fema.status === 'loading' && <p className="readout-section__note">Querying FEMA NFHL…</p>}
              {fema.status === 'error' && (
                <p className="readout-section__note readout-section__note--error">{fema.error}</p>
              )}
              {fema.status === 'success' && !fema.hasFeature && (
                <p className="readout-section__note">
                  No FEMA flood hazard feature was returned for this point — treated as outside a mapped
                  Special Flood Hazard Area.
                </p>
              )}
              {fema.status === 'success' && fema.hasFeature && (
                <>
                  <DataRow label="FLD_ZONE" value={attrs.FLD_ZONE} />
                  <DataRow label="ZONE_SUBTY" value={attrs.ZONE_SUBTY} />
                  <DataRow label="SFHA_TF" value={attrs.SFHA_TF} />
                  <DataRow label="STATIC_BFE" value={attrs.STATIC_BFE} />
                  <DataRow label="DEPTH" value={attrs.DEPTH} />
                  <DataRow label="V_DATUM" value={attrs.V_DATUM} />
                </>
              )}
            </section>

            <section className="readout-section">
              <h3 className="readout-section__title">Census tract</h3>
              {census.status === 'loading' && <p className="readout-section__note">Querying Census Geocoder…</p>}
              {census.status === 'unmatched' && (
                <p className="readout-section__note readout-section__note--error">
                  Couldn't match that address.
                </p>
              )}
              {census.status === 'error' && (
                <p className="readout-section__note readout-section__note--error">{census.error}</p>
              )}
              {census.status === 'success' && census.tract && (
                <>
                  <DataRow label="GEOID" value={census.tract.GEOID} />
                  <DataRow label="Name" value={census.tract.NAME} />
                  <DataRow label="State" value={census.tract.STATE} />
                  <DataRow label="County" value={census.tract.COUNTY} />
                </>
              )}
              {tigerweb.status === 'error' && (
                <p className="readout-section__note readout-section__note--error">
                  Tract boundary unavailable: {tigerweb.error}
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </section>
  );
}
