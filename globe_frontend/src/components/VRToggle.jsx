import React, { useCallback, useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Button to request WebXR immersive-vr session via the underlying WebGL renderer.
 * Note: Requires HTTPS and a compatible device/browser.
 */
// PUBLIC_INTERFACE
export default function VRToggle({ enabled, xrSupported }) {
  const { gl } = useThree();
  const [message, setMessage] = useState('');

  useEffect(() => {
    setMessage('');
  }, [enabled, xrSupported]);

  const startVR = useCallback(async () => {
    if (!enabled) {
      setMessage('Experiments disabled. Set VITE_EXPERIMENTS_ENABLED=true to try VR.');
      return;
    }
    if (!xrSupported || !navigator.xr) {
      setMessage('WebXR not supported on this device/browser.');
      return;
    }
    try {
      // three.js renderer exposes xr; request immersive-vr
      await gl.xr.setSession(await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] }));
      setMessage('Entering VR… If nothing happens, ensure HTTPS and XR device.');
    } catch (e) {
      setMessage('Failed to start VR session. Check browser permissions and HTTPS.');
    }
  }, [enabled, xrSupported, gl]);

  return (
    <div className="vr-toggle">
      <button
        className="btn btn-primary"
        type="button"
        onClick={startVR}
        aria-disabled={!enabled}
      >
        {enabled ? (xrSupported ? 'Enter VR' : 'VR Unavailable') : 'VR (Experiments Off)'}
      </button>
      {message && <div className="vr-msg" role="status">{message}</div>}
    </div>
  );
}
