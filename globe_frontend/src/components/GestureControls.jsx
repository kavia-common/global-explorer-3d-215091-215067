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
      icon: '/assets/gestures/thumbs_up.png',
      description: 'Enable gesture control. Acts like a toggle to start recognition.',
      accent: '#10b981',
    },
    {
      key: 'thumbs_down',
      name: 'Thumbs Down',
      icon: '/assets/gestures/thumbs_down.png',
      description: 'Disable gesture control and pause recognition.',
      accent: '#EF4444',
    },
    {
      key: 'fist',
      name: 'Fist',
      icon: '/assets/gestures/fist.png',
      description: 'Hold to drag/orbit the globe surface.',
      accent: 'var(--color-secondary)',
    },
    {
      key: 'pinch_in',
      name: 'Pinch-In',
      icon: '/assets/gestures/pinch_in.png',
      description: 'Pinch to zoom in/out smoothly.',
      accent: 'var(--color-primary)',
    },
    {
      key: 'rotate',
      name: 'Rotate',
      icon: '/assets/gestures/rotate.png',
      description: 'Twist your wrist to rotate the globe around its axis.',
      accent: '#38bdf8',
    },
  ];

  return (
    <div
      className="gesture-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      {gestures.map((g) => (
        <div
          key={g.key}
          className="gesture-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            borderRadius: 12,
            background: 'rgba(2, 6, 23, 0.35)',
            border: '1px solid rgba(148,163,184,0.25)',
            boxShadow: '0 10px 24px rgba(0,0,0,0.35)',
            minHeight: 72,
          }}
        >
          <div
            className="gesture-icon-wrap"
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background:
                'linear-gradient(180deg, rgba(148,163,184,0.15), rgba(2,6,23,0.1))',
              border: `1px solid ${g.accent}`,
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              flex: '0 0 auto',
            }}
          >
            <img
              src={g.icon}
              alt=""
              width={36}
              height={36}
              style={{ objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
            />
          </div>
          <div className="gesture-texts" style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>{g.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{g.description}</div>
          </div>
        </div>
      ))}
      <div
        className="gesture-note"
        style={{
          gridColumn: '1 / -1',
          marginTop: 4,
          padding: 10,
          borderRadius: 10,
          border: '1px dashed rgba(148,163,184,0.3)',
          background: 'rgba(15,23,42,0.35)',
          color: 'var(--muted)',
          fontSize: 12,
        }}
      >
        Tip: Ensure good lighting and keep your hand fully in view of your camera for best recognition accuracy.
      </div>
    </div>
  );
}
