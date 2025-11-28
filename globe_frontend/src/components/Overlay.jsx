import React from 'react';

/**
 * Floating overlay with theme styles showing status and last hit lat/lon.
 */
// PUBLIC_INTERFACE
export default function Overlay({ lastHit, experimentsEnabled }) {
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

        <div className="overlay-section">
          <div className="section-title">Placeholders</div>
          <ul className="placeholder-list">
            <li>Weather overlay (clouds, precipitation) - coming soon</li>
            <li>Day/Night terminator shader - coming soon</li>
            <li>Country selection and info - coming soon</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
