import React from 'react';

/**
 * Floating overlay with theme styles showing status, last hit lat/lon, and selected country.
 */
// PUBLIC_INTERFACE
export default function Overlay({ lastHit, experimentsEnabled }) {
  const country = lastHit?.country || null;

  return (
    <div className="overlay-root">
      <div className="overlay-card">
        <div className="overlay-title">Global Explorer</div>
        <div className="overlay-row">
          <span className="label">Experiments:</span>
          <span className={`pill ${experimentsEnabled ? 'ok' : 'warn'}`}>
            {experimentsEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="overlay-row">
          <span className="label">Last Hit:</span>
          <span className="value">
            {lastHit ? `${lastHit.lat}, ${lastHit.lon}` : '—'}
          </span>
        </div>
        <div className="overlay-row">
          <span className="label">Country:</span>
          <span className="value" style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
            {country ? `${country.name} (${country.iso})` : '—'}
          </span>
        </div>

        <div className="overlay-section">
          <div className="section-title">Placeholders</div>
          <ul className="placeholder-list">
            <li>Weather overlay (clouds, precipitation) - coming soon</li>
            <li>Day/Night terminator shader - coming soon</li>
            <li>Additional country details - coming soon</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
