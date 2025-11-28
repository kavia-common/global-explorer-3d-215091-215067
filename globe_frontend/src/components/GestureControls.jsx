import React from 'react';

/**
 * PUBLIC_INTERFACE
 * GestureControls renders the list of supported hand gestures with icon and description.
 * Icons are loaded from /assets/gestures/*.png
 */
export default function GestureControls() {
  const gestures = [
    {
      key: 'thumbs_up',
      name: 'Thumbs Up',
      pill: 'Enable',
      icon: '/assets/gestures/thumbs_up.png',
      description: 'Toggle gesture control on.',
      accent: '#10b981',
    },
    {
      key: 'thumbs_down',
      name: 'Thumbs Down',
      pill: 'Disable',
      icon: '/assets/gestures/thumbs_down.png',
      description: 'Turn recognition off.',
      accent: '#EF4444',
    },
    {
      key: 'fist',
      name: 'Fist',
      pill: 'Navigation',
      icon: '/assets/gestures/fist.png',
      description: 'Hold to drag/orbit the globe.',
      accent: 'var(--color-secondary)',
    },
    {
      key: 'pinch_in',
      name: 'Pinch-In',
      pill: 'Zoom',
      icon: '/assets/gestures/pinch_in.png',
      description: 'Pinch to zoom in/out smoothly.',
      accent: 'var(--color-primary)',
    },
    {
      key: 'rotate',
      name: 'Rotate',
      pill: 'Rotation',
      icon: '/assets/gestures/rotate.png',
      description: 'Twist wrist to spin the globe.',
      accent: '#38bdf8',
    },
  ];

  return (
    <div className="gesture-grid">
      {gestures.map((g) => (
        <article key={g.key} className="gesture-card" aria-label={g.name}>
          <div className="gesture-icon-wrap" aria-hidden="true" style={{ borderColor: g.accent }}>
            <img
              src={g.icon}
              alt=""
              className="gesture-icon"
              width={72}
              height={72}
              loading="lazy"
            />
          </div>
          <div className="gesture-texts">
            <div className="gesture-header">
              <h3 className="gesture-title">{g.name}</h3>
              {g.pill && (
                <span
                  className="gesture-pill"
                  style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    color: '#F59E0B',
                    borderColor: '#F59E0B',
                  }}
                >
                  {g.pill}
                </span>
              )}
            </div>
            <p className="gesture-desc">{g.description}</p>
          </div>
        </article>
      ))}
      <div className="gesture-note">
        Tip: Ensure good lighting and keep your hand fully in view of your camera for best
        recognition accuracy.
      </div>
    </div>
  );
}
