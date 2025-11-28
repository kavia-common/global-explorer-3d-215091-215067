import React, { useState, useCallback, useMemo } from 'react';
import ControlsModal from './ControlsModal.jsx';
import GestureControls from './GestureControls.jsx';

/**
 * Floating overlay with theme styles showing status, last hit lat/lon, and selected country.
 */
// PUBLIC_INTERFACE
export default function Overlay({
  lastHit,
  experimentsEnabled,
  sunMode,
  onSunModeChange,
  gestureStatus = 'disconnected',
  gestureLastEvent = null,
  gesturesEnabled = true,
  onToggleGestures,
}) {
  /** 
   * This overlay presents app status and globe interaction details.
   * It also exposes a control for the day/night terminator mode:
   * - "real" (simulate real-time orbit over the day)
   * - "fixed" (a fixed sun direction for demos)
   */
  const country = lastHit?.country || null;

  // Controls modal state
  const [controlsOpen, setControlsOpen] = useState(false);
  const openControls = useCallback(() => setControlsOpen(true), []);
  const closeControls = useCallback(() => setControlsOpen(false), []);

  const statusClass = useMemo(() => {
    if (gestureStatus === 'connected') return 'badge badge-ok';
    if (gestureStatus === 'connecting') return 'badge badge-warn';
    return 'badge badge-error';
  }, [gestureStatus]);

  const lastGestureText = useMemo(() => {
    if (!gestureLastEvent) return '—';
    const { name, phase } = gestureLastEvent;
    return `${name}${phase ? `.${phase}` : ''}`;
  }, [gestureLastEvent]);

  return (
    <div className="overlay-root">
      <div className="overlay-card">
        <div
          className="overlay-title"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
        >
          <span>Global Explorer</span>
          <button
            type="button"
            className="btn"
            onClick={openControls}
            aria-haspopup="dialog"
            aria-expanded={controlsOpen}
            aria-controls="controls-modal"
            title="View gesture controls"
            style={{
              padding: '6px 10px',
              borderRadius: 10,
              borderColor: 'rgba(37, 99, 235, 0.5)',
            }}
          >
            Controls
          </button>
        </div>

        <div className="overlay-row">
          <span className="label">Experiments:</span>
          <span className={`pill ${experimentsEnabled ? 'ok' : 'warn'}`}>
            {experimentsEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        <div className="overlay-row">
          <span className="label">Gestures:</span>
          <span className={statusClass} aria-live="polite">
            {gestureStatus === 'connected' ? 'Connected' : gestureStatus === 'connecting' ? 'Connecting' : 'Disconnected'}
          </span>
        </div>

        <div className="overlay-row">
          <span className="label">Gesture Ctrl:</span>
          <button
            type="button"
            className="btn"
            onClick={onToggleGestures}
            aria-pressed={!!gesturesEnabled}
            title="Enable or disable gesture controls at runtime"
            style={{
              borderColor: gesturesEnabled ? 'var(--color-primary)' : 'rgba(37, 99, 235, 0.4)',
            }}
          >
            {gesturesEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div className="overlay-row">
          <span className="label">Last Gesture:</span>
          <span className="value">{lastGestureText}</span>
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

      {/* Modal mounted at root overlay to avoid z-index issues */}
      <ControlsModal
        open={controlsOpen}
        onClose={closeControls}
        title="Gesture Controls"
      >
        <div id="controls-modal" />
        <GestureControls />
      </ControlsModal>
    </div>
  );
}
