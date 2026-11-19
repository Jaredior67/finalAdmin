import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowLeft } from 'lucide-react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export const Modal = ({ isOpen, onClose, onBack, title, subtitle = null, children, footer, maxWidth = '680px' }) => {
  const titleId = useId();
  const cardRef = useRef(null);
  const prevFocusRef = useRef(null);

  // Stable ref to onClose so the useEffect never re-runs just because
  // the parent passes a fresh arrow function on each render.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Guard: only auto-focus once per open.
  const didFocusRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      didFocusRef.current = false;
      return undefined;
    }

    prevFocusRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    const card = cardRef.current;
    const focusables = () => (card
      ? [...card.querySelectorAll(FOCUSABLE)].filter(el => !el.disabled && el.offsetParent !== null)
      : []);

    let focusRaf = null;
    if (!didFocusRef.current) {
      didFocusRef.current = true;
      focusRaf = requestAnimationFrame(() => {
        const initial = focusables()[0] || card;
        if (initial && typeof initial.focus === 'function') initial.focus();
      });
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
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
      if (focusRaf) cancelAnimationFrame(focusRaf);
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      if (prevFocusRef.current && typeof prevFocusRef.current.focus === 'function') {
        prevFocusRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalNode = (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
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
        <div className="modal-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0 }}>
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
            <div>
              <h3 className="modal-title" id={titleId} style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#071746' }}>{title}</h3>
              {subtitle && <div style={{ fontSize: '12.5px', color: 'var(--text-muted, #64748b)', fontWeight: '500', marginTop: '3px' }}>{subtitle}</div>}
            </div>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-sunken)'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#64748b'; }}
          >
            <X size={16} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: '24px 28px' }}>
          {children}
        </div>
        {footer && (
          <div className="modal-footer" style={{ padding: '16px 28px', borderTop: '1px solid #e2e8f0', background: '#ffffff', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
