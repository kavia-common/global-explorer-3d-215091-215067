import React from 'react';

/**
 * Floating overlay with theme styles showing status, last hit lat/lon, and selected country.
 */
// PUBLIC_INTERFACE
export default function Overlay({ lastHit, experimentsEnabled, sunMode, onSunModeChange }) {
  /** 
   * This overlay presents app status and globe interaction details.
   * It also exposes a control for the day/night terminator mode:
   * - "real" (simulate real-time orbit over the day)
   * - "fixed" (a fixed sun direction for demos)
   */
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
          <div className="section-title">Day/Night Terminator</div>
          <div className="overlay-row" role="group" aria-label="Sun mode">
            <span className="label">Sun Mode:</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn"
                onClick={() => onSunModeChange?.('real')}
                aria-pressed={sunMode === 'real'}
                style={{
                  borderColor: sunMode === 'real' ? 'var(--color-primary)' : 'rgba(37, 99, 235, 0.4)',
                }}
              >
                Real-time
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => onSunModeChange?.('fixed')}
                aria-pressed={sunMode === 'fixed'}
                style={{
                  borderColor: sunMode === 'fixed' ? 'var(--color-primary)' : 'rgba(37, 99, 235, 0.4)',
                }}
              >
                Fixed
              </button>
            </div>
          </div>
        </div>

        <div className="overlay-section">
          <div className="section-title">Notes</div>
          <ul className="placeholder-list">
            <li>Weather overlay (clouds, precipitation) - coming soon</li>
            <li>Day/Night shader with soft terminator and city lights</li>
            <li>Additional country details - coming soon</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
