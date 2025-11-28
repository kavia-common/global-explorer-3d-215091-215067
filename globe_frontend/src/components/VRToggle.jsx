import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';

/**
 * Button to request WebXR immersive-vr session via the underlying WebGL renderer.
 * Note: Requires HTTPS and a compatible device/browser.
 */
// PUBLIC_INTERFACE
export default function VRToggle({ enabled, xrSupported }) {
  const { gl } = useThree();
  const [message, setMessage] = useState('');
  const [navXrPresent, setNavXrPresent] = useState(false);

  useEffect(() => {
    setMessage('');
    setNavXrPresent(!!globalThis?.navigator?.xr);
  }, [enabled, xrSupported]);

  const disabledReason = useMemo(() => {
    if (!enabled) return 'Experiments disabled. Set VITE_EXPERIMENTS_ENABLED=true to try VR.';
    if (!xrSupported) return 'WebXR is not available (isSessionSupported=false).';
    if (!navXrPresent) return 'navigator.xr not present in this environment.';
    if (!gl || !gl.xr) return 'Renderer not ready yet.';
    return '';
  }, [enabled, xrSupported, navXrPresent, gl]);

  const isDisabled = !!disabledReason;

  const startVR = useCallback(async () => {
    if (isDisabled) {
      setMessage(disabledReason);
      console.info('[XR] VRToggle prevented start:', disabledReason);
      return;
    }
    try {
      // Ensure XR is enabled on the renderer only when available.
      gl.xr.enabled = true;
      const session = await globalThis.navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor'],
      });
      // three.js WebXRManager handles the session; only call when manager exists.
      await gl.xr.setSession(session);
      setMessage('Entering VR… If nothing happens, ensure HTTPS, a compatible XR device, and grant permissions.');
    } catch (e) {
      console.info('[XR] requestSession/setSession failed:', e);
      setMessage('Failed to start VR session. Check browser permissions and HTTPS.');
    }
  }, [gl, isDisabled, disabledReason]);

  return (
    <div className="vr-toggle">
      <button
        className="btn btn-primary"
        type="button"
        onClick={startVR}
        aria-disabled={isDisabled}
        title={isDisabled ? disabledReason : 'Start immersive VR session'}
        style={isDisabled ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
      >
        {!enabled
          ? 'VR (Experiments Off)'
          : !xrSupported
          ? 'VR Unavailable'
          : 'Enter VR'}
      </button>
      {message && <div className="vr-msg" role="status">{message}</div>}
    </div>
  );
}
