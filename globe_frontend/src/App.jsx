import React, { useMemo, useState } from 'react';
import GlobeCanvas from './components/GlobeCanvas.jsx';
import Overlay from './components/Overlay.jsx';
import VRToggle from './components/VRToggle.jsx';
import useGestureWS from './hooks/useGestureWS.js';

// PUBLIC_INTERFACE
export default function App() {
  /** Main application shell with Ocean Professional theme overlay and 3D globe canvas. */
  const experimentsEnabled = useMemo(
    () => (import.meta.env?.VITE_EXPERIMENTS_ENABLED === 'true'),
    []
  );

  const [lastHit, setLastHit] = useState(null);
  const [xrSupported, setXrSupported] = useState(false);

  // Sun mode: 'real' (time-driven) or 'fixed' (static direction)
  const [sunMode, setSunMode] = useState('real');

  // Gesture hook for status/toggle surfaced to overlay UX
  const { status: gestureStatus, lastEvent: gestureLastEvent, enabled: gesturesEnabled, setEnabled: setGesturesEnabled } = useGestureWS({ enabledDefault: true });

  return (
    <div className="app-root">
      <GlobeCanvas
        onHit={(hit) => setLastHit(hit)}
        onXRSupport={(supported) => setXrSupported(supported)}
        sunMode={sunMode}
      />
      <Overlay
        lastHit={lastHit}
        experimentsEnabled={experimentsEnabled}
        sunMode={sunMode}
        onSunModeChange={setSunMode}
        gestureStatus={gestureStatus}
        gestureLastEvent={gestureLastEvent}
        gesturesEnabled={gesturesEnabled}
        onToggleGestures={() => setGesturesEnabled((v) => !v)}
      />
      <VRToggle
        enabled={experimentsEnabled}
        xrSupported={xrSupported}
      />
    </div>
  );
}
