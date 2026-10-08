import React, { useEffect, useId, useRef } from 'react';
import { X, ArrowLeft } from 'lucide-react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export const Modal = ({ isOpen, onClose, onBack, title, children, footer, maxWidth = '680px' }) => {
  const titleId = useId();
  const cardRef = useRef(null);
  const prevFocusRef = useRef(null);

  // Stable ref to onClose so the useEffect never re-runs just because
  // the parent passes a fresh arrow function on each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Guard: only auto-focus once per open.
  //
  // React 18 Strict Mode intentionally runs every effect TWICE:
  //   mount → cleanup → mount again (all synchronously before paint).
  //
  // Before this fix the sequence was:
  //   1. Effect runs → initial.focus() → focus goes to first button/input
  //   2. Strict Mode cleanup: remove listener, return focus to opener
  //   3. Effect runs AGAIN → initial.focus() AGAIN → focus goes to first button
  //
  // The user then clicks an input and starts typing. On the very next
  // keystroke, React re-renders the parent (because state changed), which
  // can cause the modal to re-mount in Strict Mode, triggering the cycle
  // again and stealing focus from the input mid-word.
  //
  // Fix: RAF + didFocusRef so the auto-focus fires only once per open,
  // and Strict Mode's first cleanup cancels the pending RAF before it fires.
  const didFocusRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset guard on close so the next open will auto-focus again.
      didFocusRef.current = false;
      return undefined;
    }

    // Save what was focused before the modal opened so we can restore it.
    prevFocusRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const card = cardRef.current;
    const focusables = () => (card
      ? [...card.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled && el.offsetParent !== null)
      : []);

    if (!didFocusRef.current) {
      // First (real) run: schedule initial focus via RAF.
      // Strict Mode's cleanup will cancelAnimationFrame before it fires,
      // so the focus() never runs on the first (discarded) mount.
      didFocusRef.current = true;
      const raf = requestAnimationFrame(() => {
        const initial = focusables()[0] || card;
        if (initial && typeof initial.focus === 'function') initial.focus();
      });

      return () => {
        cancelAnimationFrame(raf);
        document.body.style.overflow = '';
        if (prevFocusRef.current && typeof prevFocusRef.current.focus === 'function') {
          prevFocusRef.current.focus();
        }
      };
    }

    // Second (real) run or any later re-run caused by isOpen toggling:
    // attach the keyboard handler without moving focus again.
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      // Focus trap — Tab cycles inside the dialog only.
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      if (prevFocusRef.current && typeof prevFocusRef.current.focus === 'function') {
        prevFocusRef.current.focus();
      }
    };

  // Only re-run when the modal opens/closes. onClose is stable via ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    // Backdrop: clicking it closes the modal.
    // aria-hidden so screen readers don't navigate to a dead zone.
    <div
      className="modal-backdrop"
      onClick={onClose}
      aria-hidden="true"
    >
      {/* Card: the actual dialog. role/aria-modal live here, not on the backdrop. */}
      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="modal-card"
        style={{ width: '100%', maxWidth: `min(${maxWidth}, calc(100vw - 24px))` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {onBack && (
              <button
                type="button"
                className="btn-icon"
                onClick={onBack}
                aria-label="Go back"
                title="Go back"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 11px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexShrink: 0
                }}
              >
                <ArrowLeft size={16} />
                <span>Back</span>
              </button>
            )}
            <h3 className="modal-title" id={titleId} style={{ margin: 0 }}>{title}</h3>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close modal"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
