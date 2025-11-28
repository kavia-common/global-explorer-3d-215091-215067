WebXR usage
- VR mode requires a compatible device and HTTPS.
- Toggle is visible when VITE_EXPERIMENTS_ENABLED=true.
- If XR is unsupported, the button will display an unavailable state and an explanatory message upon click.

Environment variables:
- VITE_EXPERIMENTS_ENABLED: "true" to enable the VR button.

Run:
- npm run dev (served on port 3000 via vite.config.js)
- Open the app and use mouse to orbit/zoom. Click the globe to see lat/lon in the overlay.
