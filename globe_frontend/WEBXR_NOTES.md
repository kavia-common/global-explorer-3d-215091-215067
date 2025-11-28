WebXR usage
- VR mode requires a compatible device and HTTPS.
- Toggle is visible when VITE_EXPERIMENTS_ENABLED=true.
- If XR is unsupported (navigator.xr is absent), the button shows "VR Unavailable" and an explanatory message is displayed on click.
- XR features are only enabled after the Canvas renderer is created; the scene is wrapped in <XR> at runtime once the WebGL renderer exists to avoid initialization errors.

Environment variables:
- VITE_EXPERIMENTS_ENABLED: "true" to enable the VR button.

Run:
- npm run dev (served on port 3000 via vite.config.js)
- Open the app and use mouse to orbit/zoom. Click the globe to see lat/lon in the overlay.
