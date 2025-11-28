import React, { useEffect, useRef, useCallback } from 'react';

/**
 * PUBLIC_INTERFACE
 * Accessible modal component used to display gesture controls.
 * - Focus trap
 * - ESC to close
 * - Close button
 * - Backdrop click to close
 * - Ocean Professional theme styling with blur and subtle shadow
 */
export default function ControlsModal({ open, onClose, title = 'Controls', children }) {
  const dialogRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const lastFocusableRef = useRef(null);
  const prevActive = useRef(null);

  // Close handler
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // ESC key to close and focus trap
  useEffect(() => {
    if (!open) return;

    prevActive.current = document.activeElement;

    const el = dialogRef.current;
    if (!el) return;

    // Gather focusable elements
    const focusableSelectors = [
      'a[href]',
      'area[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'iframe',
      'object',
      'embed',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable]'
    ].join(',');

    const setupFocus = () => {
      const focusables = el.querySelectorAll(focusableSelectors);
      if (focusables.length) {
        firstFocusableRef.current = focusables[0];
        lastFocusableRef.current = focusables[focusables.length - 1];
        firstFocusableRef.current.focus();
      } else {
        el.focus();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      } else if (e.key === 'Tab') {
        // Trap focus inside
        const first = firstFocusableRef.current;
        const last = lastFocusableRef.current;
        if (!first || !last) return;

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    setupFocus();
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Restore focus to previous element
      if (prevActive.current && prevActive.current.focus) {
        prevActive.current.focus();
      }
    };
  }, [open, handleClose]);

  if (!open) return null;

  const onBackdropClick = (e) => {
    // Only close if clicking on the backdrop, not the dialog content
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <div
      className="controls-modal-backdrop"
      role="presentation"
      onMouseDown={onBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 50,
        display: 'grid',
        placeItems: 'center',
        padding: '16px',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="controls-modal-title"
        tabIndex={-1}
        className="controls-modal"
        style={{
          width: '100%',
          maxWidth: 560,
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(37, 99, 235, 0.35)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
          color: 'var(--text)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
      >
        <div
          className="controls-modal-header"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderBottom: '1px solid rgba(148,163,184,0.2)',
            background:
              'linear-gradient(90deg, rgba(37, 99, 235, 0.18), rgba(148, 163, 184, 0.10))',
          }}
        >
          <h2
            id="controls-modal-title"
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 0.2,
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close controls"
            className="btn"
            onClick={handleClose}
            style={{
              padding: '6px 10px',
              borderRadius: 10,
              borderColor: 'rgba(37, 99, 235, 0.5)',
            }}
          >
            Close
          </button>
        </div>

        <div
          className="controls-modal-content"
          style={{
            padding: 14,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
