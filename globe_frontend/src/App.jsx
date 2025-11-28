import React, { useMemo, useState } from 'react';
import GlobeCanvas from './components/GlobeCanvas.jsx';
import Overlay from './components/Overlay.jsx';
import VRToggle from './components/VRToggle.jsx';

// PUBLIC_INTERFACE
export default function App() {
  /** Main application shell with Ocean Professional theme overlay and 3D globe canvas. */
  const experimentsEnabled = useMemo(
    () => (import.meta.env?.VITE_EXPERIMENTS_ENABLED === 'true'),
    []
  );

  const [lastHit, setLastHit] = useState(null);
  const [xrSupported, setXrSupported] = useState(false);

  return (
    <div className="app-root">
      <GlobeCanvas
        onHit={(hit) => setLastHit(hit)}
        onXRSupport={(supported) => setXrSupported(supported)}
      />
      <Overlay
        lastHit={lastHit}
        experimentsEnabled={experimentsEnabled}
      />
      <VRToggle
        enabled={experimentsEnabled}
        xrSupported={xrSupported}
      />
    </div>
  );
}
