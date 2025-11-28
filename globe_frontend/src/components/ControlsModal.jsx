import React, { useEffect, useRef, useCallback } from 'react';

/**
 * PUBLIC_INTERFACE
 * Accessible modal for Gesture Controls.
 * Glass/blur backdrop, centered card with rounded-xl corners, subtle border,
 * drop-shadow-xl, smooth open/close animations, focus trap, ESC to close,
 * and backdrop click to close.
 *
 * Reference image for visual guidance:
 * /attachments/20251128_024540_image.png
 */
export default function ControlsModal({
  open,
  onClose,
  title = 'Gesture Controls',
  subtitle = 'Interact with the globe hands-free',
  children,
}) {
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);
  const firstFocusableRef = useRef(null);
  const lastFocusableRef = useRef(null);
  const prevActive = useRef(null);

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  // Setup focus trap and key handling
  useEffect(() => {
    if (!open) return;

    prevActive.current = document.activeElement;
    const el = dialogRef.current;
    if (!el) return;

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
      '[contenteditable]',
    ].join(',');

    const setupFocus = () => {
      const focusables = el.querySelectorAll(focusableSelectors);
      if (focusables.length) {
        firstFocusableRef.current = focusables[0];
        lastFocusableRef.current = focusables[focusables.length - 1];
        // Ensure the Close button receives initial focus for quick escape
        if (closeBtnRef.current) {
          closeBtnRef.current.focus();
        } else {
          firstFocusableRef.current.focus();
        }
      } else {
        el.focus();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleClose();
      } else if (e.key === 'Tab') {
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

    // Add enter animation by toggling class
    requestAnimationFrame(() => {
      el.classList.add('controls-modal--enter');
    });

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (prevActive.current && prevActive.current.focus) {
        prevActive.current.focus();
      }
    };
  }, [open, handleClose]);

  // Backdrop click closes when clicking outside of the card
  const onBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="controls-modal-backdrop controls-modal-backdrop--enter"
      role="presentation"
      onMouseDown={onBackdropClick}
      aria-hidden="false"
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="controls-modal-title"
        aria-describedby={subtitle ? 'controls-modal-subtitle' : undefined}
        tabIndex={-1}
        className="controls-modal-card"
      >
        <header className="controls-modal-header">
          <div className="controls-modal-titles">
            <h2 id="controls-modal-title" className="controls-modal-title">
              {title}
            </h2>
            {subtitle ? (
              <p id="controls-modal-subtitle" className="controls-modal-subtitle">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close controls"
            className="icon-btn"
            onClick={handleClose}
            ref={closeBtnRef}
            title="Close"
          >
            <span aria-hidden="true" className="icon-x">
              ×
            </span>
          </button>
        </header>

        <div className="controls-modal-content">{children}</div>

        <footer className="controls-modal-footer">
          <div className="spacer" />
          <button type="button" className="btn btn-primary-ghost" onClick={handleClose}>
            Got it
          </button>
        </footer>
      </section>
    </div>
  );
}
